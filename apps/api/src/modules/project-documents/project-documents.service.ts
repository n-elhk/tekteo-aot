import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DocumentCategory } from '../../generated/prisma/client';
import type {
  DocumentFileTypeValue,
  UpdateDocumentDto,
} from '@org/schemas';
import { AbstractStorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.oasis.opendocument',
  'application/msword',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/zip',
] as const;

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class ProjectDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AbstractStorageService,
  ) {}

  findAllByProject(
    projectId: string,
    category?: DocumentCategory,
  ) {
    return this.prisma.projectDocument.findMany({
      where: { projectId, ...(category ? { category } : {}) },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async findOne(id: string) {
    const doc = await this.prisma.projectDocument.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${id} introuvable`);
    }
    return doc;
  }

  async upload(
    projectId: string,
    userId: string,
    file: Express.Multer.File,
    metadata: { fileType: DocumentFileTypeValue; category: DocumentCategory },
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `Fichier trop volumineux : max ${MAX_FILE_BYTES / 1024 / 1024} Mo`,
      );
    }
    if (!isAllowedMime(file.mimetype)) {
      throw new BadRequestException(
        `Type MIME non autorisé : ${file.mimetype}`,
      );
    }

    // Vérifier que le projet existe
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Projet ${projectId} introuvable`);
    }

    const stored = await this.storage.save(
      projectId,
      file.originalname,
      file.buffer,
    );

    return this.prisma.projectDocument.create({
      data: {
        projectId,
        fileName: file.originalname,
        fileType: metadata.fileType,
        category: metadata.category,
        storagePath: stored.storagePath,
        fileSize: stored.size,
        uploadedById: userId,
      },
      include: {
        uploadedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.projectDocument.update({
      where: { id },
      data: {
        ...(dto.fileType !== undefined && { fileType: dto.fileType }),
        ...(dto.category !== undefined && { category: dto.category }),
      },
    });
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    await this.storage.remove(doc.storagePath);
    return this.prisma.projectDocument.delete({ where: { id } });
  }

  async getDownloadInfo(id: string) {
    const doc = await this.findOne(id);
    return {
      doc,
      stream: this.storage.createReadStream(doc.storagePath),
    };
  }
}

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}
