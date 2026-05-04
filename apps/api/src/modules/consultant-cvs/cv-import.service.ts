import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CvImportTemplateValue } from '@org/schemas';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface FileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CvImportJobPayload {
  jobId: string;
  inputPath: string;
  templateId: CvImportTemplateValue;
}

@Injectable()
export class CvImportService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(CV_IMPORT_QUEUE) private readonly queue: Queue<CvImportJobPayload>,
  ) {
    this.uploadsDir = resolve(
      this.config.get<string>('UPLOADS_DIR', 'apps/api/uploads'),
    );
  }

  async createImport(
    userId: string,
    file: FileLike,
    templateId: CvImportTemplateValue,
  ) {
    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Format non supporté : seuls PDF et DOCX sont acceptés',
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Fichier trop volumineux (10 Mo max)');
    }

    const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const uuid = randomUUID();
    const importsDir = join(this.uploadsDir, 'cv-imports');
    await mkdir(importsDir, { recursive: true });
    const inputPath = join(importsDir, `${uuid}.${ext}`);
    await writeFile(inputPath, file.buffer);

    const job = await this.prisma.cvImportJob.create({
      data: {
        userId,
        templateId,
        inputPath,
        inputFilename: file.originalname,
        status: 'pending',
      },
    });

    await this.queue.add(
      CV_IMPORT_QUEUE,
      { jobId: job.id, inputPath, templateId },
      { removeOnComplete: { age: 86_400 }, removeOnFail: { age: 86_400 } },
    );

    return { jobId: job.id, status: job.status };
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.cvImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Import ${jobId} introuvable`);
    }
    return {
      jobId: job.id,
      status: job.status,
      templateId: job.templateId,
      inputFilename: job.inputFilename,
      cvId: job.cvId,
      error: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }
}
