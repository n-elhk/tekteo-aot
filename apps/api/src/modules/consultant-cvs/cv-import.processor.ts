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
import { GeneratedCvsService } from './generated-cvs.service';
import { PdfRendererService } from './pdf-renderer.service';
import { TemplateFillerService } from './template-filler.service';
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
    private readonly templateFiller: TemplateFillerService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly generatedCvs: GeneratedCvsService,
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

    await this.markStatus(jobId, 'processing');

    try {
      if (kind === 'import') {
        await this.runImportPipeline(importJob);
      } else {
        await this.runGeneratePipeline(importJob);
      }
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

    // 1. Extraction texte + structuration (Claude)
    const generation = await this.extract(importJob.inputPath);
    const cvData = parseLlmJson<CvData>(generation.content);
    const tokensUsed =
      generation.usage.inputTokens + generation.usage.outputTokens;

    // 2. Création du profil consultant
    const consultant = await this.prisma.consultantCv.create({
      data: {
        cvData: cvData as unknown as Prisma.InputJsonValue,
        consultantName: extractIdentityName(cvData),
        consultantTitle: extractIdentityRole(cvData),
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

    // 3. Historique génération
    await this.history.record({
      module: 'cv',
      userId: importJob.userId,
      modelUsed: generation.modelUsed,
      tokensUsed,
      outputContent: `Import depuis ${importJob.inputFilename ?? '(inconnu)'} → consultant ${consultant.id}`,
      inputData: {
        mode: 'import-from-file',
        template: importJob.template,
        inputFilename: importJob.inputFilename,
      },
    });

    // 4. Pipeline de génération (template → Claude → Puppeteer → storage)
    await this.runGenerationSteps(
      importJob.id,
      importJob.userId,
      consultant.id,
      consultant.consultantName,
      cvData,
      importJob.template,
    );
  }

  // -----------------------------------------------------------
  // Pipeline GENERATE (depuis page détail)
  // -----------------------------------------------------------

  private async runGeneratePipeline(importJob: {
    id: string;
    userId: string;
    consultantId: string | null;
    template: CvTemplateValue;
  }): Promise<void> {
    if (!importJob.consultantId) {
      throw new Error(
        'generate_failed: consultantId manquant pour un job generate',
      );
    }

    const consultant = await this.prisma.consultantCv.findUnique({
      where: { id: importJob.consultantId },
    });
    if (!consultant) {
      throw new Error(
        `generate_failed: consultant ${importJob.consultantId} introuvable`,
      );
    }

    await this.runGenerationSteps(
      importJob.id,
      importJob.userId,
      consultant.id,
      consultant.consultantName,
      consultant.cvData as unknown as CvData,
      importJob.template,
    );
  }

  // -----------------------------------------------------------
  // Étapes communes : fill template → render PDF → store
  // -----------------------------------------------------------

  private async runGenerationSteps(
    jobId: string,
    userId: string,
    consultantId: string,
    consultantName: string | null,
    cvData: CvData,
    template: CvTemplateValue,
  ): Promise<void> {
    const generatedCv = await this.generatedCvs.createPending(
      consultantId,
      template,
      userId,
    );

    await this.prisma.cvImportJob.update({
      where: { id: jobId },
      data: { generatedCvId: generatedCv.id },
    });
    this.events.emit(jobId, {
      status: 'processing',
      generatedCvId: generatedCv.id,
    });

    try {
      await this.generatedCvs.markProcessing(generatedCv.id);

      // 1. Claude remplit le template
      let filled;
      try {
        filled = await this.templateFiller.fill(cvData, template);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`template_fill_failed: ${msg}`);
      }

      // 2. Puppeteer rend le PDF
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfRenderer.render(filled.html);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`pdf_render_failed: ${msg}`);
      }

      // 3. Stockage
      const filename = buildFilename(consultantName, template);
      let stored;
      try {
        stored = await this.generatedCvs.storePdf(
          generatedCv.id,
          consultantId,
          pdfBuffer,
          filename,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`storage_write_failed: ${msg}`);
      }

      // 4. Marquer success + finaliser le job
      await this.generatedCvs.markSuccess(generatedCv.id, stored, filename);
      await this.markStatus(jobId, 'done');
      this.events.emit(jobId, {
        status: 'done',
        consultantId,
        generatedCvId: generatedCv.id,
      });

      // 5. Historique IA
      await this.history.record({
        module: 'cv',
        userId,
        modelUsed: filled.modelUsed,
        tokensUsed: filled.tokensUsed,
        outputContent: `Génération PDF ${template} pour consultant ${consultantId}`,
        inputData: {
          mode: 'fill-template',
          template,
          generatedCvId: generatedCv.id,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.generatedCvs.markFailed(generatedCv.id, message);
      throw err;
    }
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

function buildFilename(name: string | null, template: string): string {
  const slug = (name ?? 'consultant')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'consultant';
  return `${slug}_${template}.pdf`;
}
