import { join } from 'node:path';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AbstractStorageService,
  type StoredFile,
} from '../../common/storage/storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const STORAGE_SCOPE_ROOT = 'cv-outputs';

@Injectable()
export class GeneratedCvsService {
  private readonly logger = new Logger(GeneratedCvsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AbstractStorageService,
  ) {}

  createPending(variantId: string, userId: string) {
    return this.prisma.generatedCv.create({
      data: {
        variantId,
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

  storePdf(
    generatedCvId: string,
    variantId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<StoredFile> {
    return this.storage.save(
      join(STORAGE_SCOPE_ROOT, variantId),
      `${generatedCvId}.pdf`,
      buffer,
    );
  }

  async findOne(id: string, variantId: string) {
    const cv = await this.prisma.generatedCv.findFirst({
      where: { id, variantId },
    });
    if (!cv) throw new NotFoundException(`CV généré ${id} introuvable`);
    return cv;
  }

  async getDownload(id: string, variantId: string) {
    const cv = await this.findOne(id, variantId);
    if (cv.status !== 'success' || !cv.outputPath) {
      throw new ConflictException("Le CV n'est pas encore généré ou a échoué");
    }
    return {
      stream: this.storage.createReadStream(cv.outputPath),
      filename: cv.filename ?? `cv_${id}.pdf`,
    };
  }

  async remove(id: string, variantId: string) {
    const cv = await this.findOne(id, variantId);
    if (cv.outputPath) {
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(`Suppression fichier ${cv.outputPath} échouée : ${err}`);
      }
    }
    await this.prisma.generatedCv.delete({ where: { id } });
  }

  async purgeForVariant(variantId: string) {
    const cvs = await this.prisma.generatedCv.findMany({
      where: { variantId, outputPath: { not: null } },
      select: { id: true, outputPath: true },
    });
    for (const cv of cvs) {
      if (!cv.outputPath) continue;
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(`Purge fichier ${cv.outputPath} échouée : ${err}`);
      }
    }
  }

  async purgeForConsultant(consultantId: string) {
    const cvs = await this.prisma.generatedCv.findMany({
      where: { variant: { consultantId }, outputPath: { not: null } },
      select: { id: true, outputPath: true },
    });
    for (const cv of cvs) {
      if (!cv.outputPath) continue;
      try {
        await this.storage.remove(cv.outputPath);
      } catch (err) {
        this.logger.warn(`Purge fichier ${cv.outputPath} échouée : ${err}`);
      }
    }
  }
}
