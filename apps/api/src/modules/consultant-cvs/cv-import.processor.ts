import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import mammoth from 'mammoth';
import { Prisma } from '../../generated/prisma/client';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import type { CvData } from '@org/schemas';
import type { CvImportJobPayload } from './cv-import.service';
import { CvImportEventService } from './cv-import-event.service';
import {
  FORMAT_SYSTEM_PROMPT,
  buildFormatPrompt,
} from './cv-prompts';

@Processor(CV_IMPORT_QUEUE)
export class CvImportProcessor extends WorkerHost {
  private readonly logger = new Logger(CvImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
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
      const generation = await this.extract(inputPath);
      const cvData = parseLlmJson<CvData>(generation.content);
      const tokensUsed =
        generation.usage.inputTokens + generation.usage.outputTokens;

      const cv = await this.prisma.consultantCv.create({
        data: {
          cvData: cvData as unknown as Prisma.InputJsonValue,
          consultantName: extractIdentityName(cvData),
          consultantTitle: extractIdentityRole(cvData),
          createdById: importJob.userId,
        },
      });

      await this.prisma.cvImportJob.update({
        where: { id: jobId },
        data: { status: 'done', cvId: cv.id },
      });

      this.events.emit(jobId, { status: 'done', cvId: cv.id });

      await this.history.record({
        module: 'cv',
        userId: importJob.userId,
        modelUsed: generation.modelUsed,
        tokensUsed,
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

  private async extract(inputPath: string) {
    const ext = extname(inputPath).toLowerCase();
    const buffer = await readFile(inputPath);

    if (ext === '.pdf') {
      return this.anthropic.generate({
        systemPrompt: FORMAT_SYSTEM_PROMPT,
        userMessage: buildFormatPrompt(
          'Le contenu du CV est joint en pièce jointe (PDF). Analyse-le et extrais les données.',
        ),
        maxTokens: 8192,
        attachments: [
          {
            name: 'cv.pdf',
            mediaType: 'application/pdf',
            data: buffer.toString('base64'),
          },
        ],
      });
    }

    if (ext === '.docx') {
      const { value } = await mammoth.extractRawText({ buffer });
      const text = value.trim();
      if (!text) {
        throw new Error('Le fichier DOCX est vide ou illisible');
      }
      return this.anthropic.generate({
        systemPrompt: FORMAT_SYSTEM_PROMPT,
        userMessage: buildFormatPrompt(text),
        maxTokens: 8192,
      });
    }

    throw new Error(`Format de fichier non supporté : ${ext}`);
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
