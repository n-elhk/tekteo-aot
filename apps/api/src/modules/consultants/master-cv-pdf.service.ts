import { Injectable, NotFoundException } from '@nestjs/common';
import type { CvData, CvTemplateValue } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GenerationHistoryService } from '../generation-history/generation-history.service';
import { TemplateFillerService } from './template-filler.service';
import { PdfRendererService } from './pdf-renderer.service';
import { buildCvFilename } from './cv-pdf-filename.util';

/**
 * Rend le CV maître d'un consultant en PDF, à la volée.
 * Aucun fichier persisté, aucune ligne GeneratedCv créée — le PDF est
 * un export ponctuel du contenu canonique (masterCvData) appliqué à
 * un template au choix.
 */
@Injectable()
export class MasterCvPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateFiller: TemplateFillerService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly history: GenerationHistoryService,
  ) {}

  async render(
    consultantId: string,
    template: CvTemplateValue,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const consultant = await this.prisma.consultant.findUnique({
      where: { id: consultantId },
      select: {
        id: true,
        lastName: true,
        masterCvData: true,
      },
    });
    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} introuvable`);
    }

    const filled = await this.templateFiller.fill(
      consultant.masterCvData as unknown as CvData,
      template,
    );
    const buffer = await this.pdfRenderer.render(filled.html);
    const filename = buildCvFilename(consultant.lastName, template, 'master');

    await this.history.record({
      module: 'cv',
      userId,
      modelUsed: filled.modelUsed,
      tokensUsed: filled.tokensUsed,
      outputContent: `PDF master rendu pour consultant ${consultant.id}`,
      inputData: {
        mode: 'render-master-pdf',
        consultantId: consultant.id,
        template,
      },
    });

    return { buffer, filename };
  }
}
