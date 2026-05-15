import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { CvTemplateValue } from '@org/schemas';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { PrismaService } from '../../common/prisma/prisma.service';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

interface FileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CvImportJobPayload {
  jobId: string;
  kind: 'import' | 'generate';
  inputPath?: string;
  consultantId?: string;
  template: CvTemplateValue;
}

@Injectable()
export class CvImportService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(CV_IMPORT_QUEUE)
    private readonly queue: Queue<CvImportJobPayload>,
  ) {
    this.uploadsDir = resolve(
      this.config.get<string>('UPLOADS_DIR', 'apps/api/uploads'),
    );
  }

  /**
   * Crée N jobs d'import (un par fichier) en parallèle.
   * Chaque fichier devient un profil consultant + un CV généré.
   */
  async createBulkImports(
    userId: string,
    files: FileLike[],
    template: CvTemplateValue,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new BadRequestException(
        `Maximum ${MAX_FILES_PER_REQUEST} fichiers par import`,
      );
    }
    files.forEach((f) => this.validateFile(f));

    const jobs = await Promise.all(
      files.map((file) => this.createSingleImport(userId, file, template)),
    );
    return { jobs };
  }

  /**
   * Crée un job de génération (depuis la page détail) — pas de fichier en input.
   */
  async createGenerationJob(
    userId: string,
    consultantId: string,
    template: CvTemplateValue,
  ) {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id: consultantId },
      select: { id: true },
    });
    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} introuvable`);
    }

    const job = await this.prisma.cvImportJob.create({
      data: {
        userId,
        kind: 'generate',
        template,
        consultantId,
        status: 'pending',
      },
    });

    await this.queue.add(
      CV_IMPORT_QUEUE,
      { jobId: job.id, kind: 'generate', consultantId, template },
      { removeOnComplete: { age: 86_400 }, removeOnFail: { age: 86_400 } },
    );

    return { jobId: job.id, status: job.status };
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.cvImportJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Import ${jobId} introuvable`);
    }
    return {
      jobId: job.id,
      kind: job.kind,
      status: job.status,
      template: job.template,
      consultantId: job.consultantId,
      generatedCvId: job.generatedCvId,
      inputFilename: job.inputFilename,
      error: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------

  private async createSingleImport(
    userId: string,
    file: FileLike,
    template: CvTemplateValue,
  ) {
    const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const uuid = randomUUID();
    const importsDir = join(this.uploadsDir, 'cv-imports');
    await mkdir(importsDir, { recursive: true });
    const inputPath = join(importsDir, `${uuid}.${ext}`);
    await writeFile(inputPath, file.buffer);

    const job = await this.prisma.cvImportJob.create({
      data: {
        userId,
        kind: 'import',
        template,
        inputPath,
        inputFilename: file.originalname,
        status: 'pending',
      },
    });

    await this.queue.add(
      CV_IMPORT_QUEUE,
      { jobId: job.id, kind: 'import', inputPath, template },
      { removeOnComplete: { age: 86_400 }, removeOnFail: { age: 86_400 } },
    );

    return { jobId: job.id, status: job.status };
  }

  private validateFile(file: FileLike): void {
    if (!file) {
      throw new BadRequestException('Fichier manquant');
    }
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Format non supporté pour ${file.originalname} : seuls PDF et DOCX sont acceptés`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Fichier ${file.originalname} trop volumineux (10 Mo max)`,
      );
    }
  }
}
