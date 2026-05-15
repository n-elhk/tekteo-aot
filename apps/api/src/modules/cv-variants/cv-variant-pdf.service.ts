import { Injectable } from '@nestjs/common';
import type { CvData } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { TemplateFillerService } from '../consultants/template-filler.service';
import { PdfRendererService } from '../consultants/pdf-renderer.service';
import { buildCvFilename } from '../consultants/cv-pdf-filename.util';
import { GeneratedCvsService } from './generated-cvs.service';

@Injectable()
export class CvVariantPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateFiller: TemplateFillerService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly generatedCvs: GeneratedCvsService,
    private readonly history: GenerationHistoryService,
  ) {}

  async render(variantId: string, userId: string) {
    const variant = await this.prisma.cvVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: { consultant: true },
    });

    const generated = await this.generatedCvs.createPending(variant.id, userId);
    await this.generatedCvs.markProcessing(generated.id);

    try {
      const filled = await this.templateFiller.fill(
        variant.cvData as unknown as CvData,
        variant.template,
      );
      const pdfBuffer = await this.pdfRenderer.render(filled.html);
      const filename = buildCvFilename(variant.consultant.lastName, variant.template);
      const stored = await this.generatedCvs.storePdf(
        generated.id,
        variant.id,
        pdfBuffer,
        filename,
      );
      await this.generatedCvs.markSuccess(generated.id, stored, filename);

      await this.history.record({
        module: 'cv',
        userId,
        modelUsed: filled.modelUsed,
        tokensUsed: filled.tokensUsed,
        outputContent: `PDF rendu pour variante ${variant.id}`,
        inputData: {
          mode: 'render-pdf',
          variantId: variant.id,
          template: variant.template,
        },
      });

      return await this.prisma.generatedCv.findUniqueOrThrow({
        where: { id: generated.id },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.generatedCvs.markFailed(generated.id, msg);
      throw err;
    }
  }
}

