import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { Prisma } from '../../generated/prisma/client';
import { CvWorkerService } from '../../common/cv-worker/cv-worker.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import type { CvData } from '@org/schemas';
import type { CvImportJobPayload } from './cv-import.service';
import { CvImportEventService } from './cv-import-event.service';

@Processor(CV_IMPORT_QUEUE)
export class CvImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CvImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cvWorker: CvWorkerService,
    private readonly history: GenerationHistoryService,
    private readonly events: CvImportEventService,
  ) {
    super();
  }

  async process(job: Job<CvImportJobPayload>): Promise<void> {
    const { jobId, inputPath, templateId } = job.data;
    this.logger.log(`Processing CV import ${jobId}`);

    const importJob = await this.prisma.cvImportJob.findUnique({
      where: { id: jobId },
    });
    if (!importJob) {
      this.logger.warn(`CvImportJob ${jobId} introuvable, on ignore`);
      return;
    }

    await this.prisma.cvImportJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });
    this.events.emit(jobId, { status: 'processing' });

    try {
      const result = await this.cvWorker.processFromFile({
        jobId,
        inputPath,
        templateId,
      });

      const cv = await this.prisma.consultantCv.create({
        data: {
          cvData: result.cvData as unknown as Prisma.InputJsonValue,
          consultantName: extractIdentityName(result.cvData),
          consultantTitle: extractIdentityRole(result.cvData),
          createdById: importJob.userId,
        },
      });

      await this.prisma.cvImportJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          outputPath: result.outputPath,
          cvId: cv.id,
        },
      });

      this.events.emit(jobId, {
        status: 'done',
        cvId: cv.id,
        downloadUrl: `/consultant-cvs/import-jobs/${jobId}/download`,
      });

      await this.history.record({
        module: 'cv',
        userId: importJob.userId,
        modelUsed: result.modelUsed,
        tokensUsed: result.tokensUsed,
        outputContent: `Import depuis ${importJob.inputFilename} → CV ${cv.id}`,
        inputData: {
          mode: 'import-from-file',
          templateId,
          inputFilename: importJob.inputFilename,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import ${jobId} failed: ${message}`);
      await this.prisma.cvImportJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message.slice(0, 2000) },
      });
      this.events.emit(jobId, { status: 'failed', error: message.slice(0, 2000) });
      throw err;
    }
  }
}

function extractIdentityName(cvData: CvData): string | null {
  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const parts = (['firstName', 'lastName'] as const)
    .map((k) => identity[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return parts.length > 0 ? parts.join(' ') : null;
}

function extractIdentityRole(cvData: CvData): string | null {
  const identity = (cvData.identity ?? {}) as Record<string, unknown>;
  const role = identity['role'];
  return typeof role === 'string' && role.trim().length > 0 ? role : null;
}
