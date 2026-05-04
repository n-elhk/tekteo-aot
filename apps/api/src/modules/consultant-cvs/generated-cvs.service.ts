import { join } from 'node:path';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CvTemplateValue } from '@org/schemas';
import {
  AbstractStorageService,
  type StoredFile,
} from '../../common/storage/storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const STORAGE_SCOPE_ROOT = 'cv';

@Injectable()
export class GeneratedCvsService {
  private readonly logger = new Logger(GeneratedCvsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AbstractStorageService,
  ) {}

  createPending(
    consultantId: string,
    template: CvTemplateValue,
    userId: string,
  ) {
    return this.prisma.generatedCv.create({
      data: {
        consultantId,
        template,
        status: 'pending',
        createdById: userId,
      },
    });
  }

  markProcessing(id: string) {
    return this.prisma.generatedCv.update({
      where: { id },
      data: { status: 'processing' },
    });
  }

  markSuccess(id: string, storedFile: StoredFile, filename: string) {
    return this.prisma.generatedCv.update({
      where: { id },
      data: {
        status: 'success',
        outputPath: storedFile.storagePath,
        filename,
      },
    });
  }

  markFailed(id: string, errorMessage: string) {
    return this.prisma.generatedCv.update({
      where: { id },
      data: {
        status: 'failed',
        errorMessage: errorMessage.slice(0, 2000),
      },
    });
  }

  /**
   * Persiste le buffer PDF dans le storage et lie le fichier au generatedCv.
   */
  storePdf(
    generatedCvId: string,
    consultantId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<StoredFile> {
    return this.storage.save(
      join(STORAGE_SCOPE_ROOT, consultantId),
      `${generatedCvId}.pdf`,
      buffer,
    );
  }

  async findOne(id: string, consultantId: string) {
    const cv = await this.prisma.generatedCv.findFirst({
      where: { id, consultantId },
    });
    if (!cv) {
      throw new NotFoundException(`CV généré ${id} introuvable`);
    }
    return cv;
  }

  async getDownload(id: string, consultantId: string) {
    const cv = await this.findOne(id, consultantId);
    if (cv.status !== 'success' || !cv.outputPath) {
      throw new ConflictException(
        "Le CV n'est pas encore généré ou a échoué",
      );
    }
    return {
      stream: this.storage.createReadStream(cv.outputPath),
      filename: cv.filename ?? `cv_${id}.pdf`,
    };
  }

  async remove(id: string, consultantId: string) {
    const cv = await this.findOne(id, consultantId);
    if (cv.outputPath) {
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(
          `Suppression fichier ${cv.outputPath} échouée : ${err}`,
        );
      }
    }
    await this.prisma.generatedCv.delete({ where: { id } });
  }

  /**
   * Purge les fichiers PDF d'un consultant avant la suppression cascade.
   */
  async purgeForConsultant(consultantId: string) {
    const cvs = await this.prisma.generatedCv.findMany({
      where: { consultantId, outputPath: { not: null } },
      select: { id: true, outputPath: true },
    });
    for (const cv of cvs) {
      if (!cv.outputPath) continue;
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(
          `Purge fichier ${cv.outputPath} échouée : ${err}`,
        );
      }
    }
  }
}
