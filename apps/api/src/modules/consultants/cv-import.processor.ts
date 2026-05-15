import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import mammoth from 'mammoth';
import { Prisma } from '../../generated/prisma/client';
import type { CvData, CvTemplateValue } from '@org/schemas';
import { AnthropicService } from '../../common/anthropic/anthropic.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CV_IMPORT_QUEUE } from '../../common/queue/queue.module';
import { parseLlmJson } from '../../common/utils/llm-json.util';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { CvImportEventService } from './cv-import-event.service';
import type { CvImportJobPayload } from './cv-import.service';
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
    const { jobId, kind } = job.data;
    this.logger.log(`Processing CV ${kind} ${jobId}`);

    const importJob = await this.prisma.cvImportJob.findUnique({
      where: { id: jobId },
    });
    if (!importJob) {
      this.logger.warn(`CvImportJob ${jobId} introuvable, on ignore`);
      return;
    }

    if (kind !== 'import') {
      throw new Error(
        `Unsupported job kind '${kind}' — generate flow moved to CvVariantPdfService`,
      );
    }

    await this.markStatus(jobId, 'processing');
    try {
      await this.runImportPipeline(importJob);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.prisma.cvImportJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message.slice(0, 2000) },
      });
      this.events.emit(jobId, {
        status: 'failed',
        error: message.slice(0, 2000),
      });
      throw err;
    }
  }

  // -----------------------------------------------------------
  // Pipeline IMPORT (upload fichier)
  // -----------------------------------------------------------

  private async runImportPipeline(importJob: {
    id: string;
    userId: string;
    inputPath: string | null;
    inputFilename: string | null;
    template: CvTemplateValue;
  }): Promise<void> {
    if (!importJob.inputPath) {
      throw new Error('extraction_failed: inputPath manquant pour un job import');
    }

    const generation = await this.extract(importJob.inputPath);
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed =
      generation.usage.inputTokens + generation.usage.outputTokens;

    const identity = (cvData.identity ?? {}) as Record<string, unknown>;
    const firstName = stringOr(identity.firstName, 'Inconnu');
    const lastName = stringOr(identity.lastName, 'Inconnu');
    const email = stringOr(identity.email, null);
    if (!email) {
      throw new Error(
        'extraction_failed: aucun email extrait du CV — création impossible',
      );
    }

    const consultant = await this.prisma.consultant.create({
      data: {
        firstName,
        lastName,
        email,
        phone: stringOr(identity.phone, null),
        role: stringOr(identity.role, null),
        location: stringOr(identity.location, null),
        masterCvData: cvData as unknown as Prisma.InputJsonValue,
        createdById: importJob.userId,
      },
    });

    await this.prisma.cvImportJob.update({
      where: { id: importJob.id },
      data: { consultantId: consultant.id },
    });
    this.events.emit(importJob.id, {
      status: 'processing',
      consultantId: consultant.id,
    });

    await this.history.record({
      module: 'cv',
      userId: importJob.userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Import depuis ${importJob.inputFilename ?? '(inconnu)'} → consultant ${consultant.id}`,
      inputData: {
        mode: 'import-file',
        template: importJob.template,
        inputFilename: importJob.inputFilename,
      },
    });

    // NOTE: l'ancien pipeline générait automatiquement un PDF "tekteo" après import.
    // Ce n'est plus possible : un PDF est rendu pour une VARIANTE, pas un consultant
    // brut. L'utilisateur devra créer une variante depuis l'UI puis lancer le rendu.
    // → on marque le job comme done.
    await this.markStatus(importJob.id, 'done');
    this.events.emit(importJob.id, {
      status: 'done',
      consultantId: consultant.id,
    });
  }

  private async markStatus(
    jobId: string,
    status: 'processing' | 'done' | 'failed',
  ) {
    await this.prisma.cvImportJob.update({
      where: { id: jobId },
      data: { status },
    });
    this.events.emit(jobId, { status });
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
        throw new Error('extraction_failed: DOCX vide ou illisible');
      }
      return this.anthropic.generate({
        systemPrompt: FORMAT_SYSTEM_PROMPT,
        userMessage: buildFormatPrompt(text),
        maxTokens: 8192,
      });
    }

    throw new Error(`extraction_failed: format non supporté ${ext}`);
  }
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
