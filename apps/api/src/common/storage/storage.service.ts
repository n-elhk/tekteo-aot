import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

export interface StoredFile {
  /** relative path under uploads root, e.g. "<projectId>/<uuid>.pdf" */
  storagePath: string;
  size: number;
  checksum: string;
}

/**
 * Abstract storage interface — implementation can be swapped
 * (local FS, MinIO, S3...) without touching consumers.
 */
export abstract class AbstractStorageService {
  abstract save(
    scope: string,
    originalName: string,
    buffer: Buffer,
  ): Promise<StoredFile>;
  abstract createReadStream(storagePath: string): Readable;
  abstract resolveAbsolutePath(storagePath: string): string;
  abstract remove(storagePath: string): Promise<void>;
}

@Injectable()
export class LocalStorageService
  extends AbstractStorageService
  implements OnModuleInit
{
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly rootDir: string;

  constructor(config: ConfigService) {
    super();
    const configured = config.get<string>('UPLOADS_DIR');
    this.rootDir = resolve(configured ?? 'apps/api/uploads');
  }

  async onModuleInit() {
    await mkdir(this.rootDir, { recursive: true });
    this.logger.log(`📁 Storage local prêt : ${this.rootDir}`);
  }

  async save(
    scope: string,
    originalName: string,
    buffer: Buffer,
  ): Promise<StoredFile> {
    const safeScope = sanitizeSegment(scope);
    const ext = extractExtension(originalName);
    const storedName = `${randomUUID()}${ext}`;
    const relPath = join(safeScope, storedName);
    const absPath = join(this.rootDir, relPath);

    // Ensure scope directory exists and refuse path traversal
    const resolvedAbsolute = resolve(absPath);
    if (!resolvedAbsolute.startsWith(this.rootDir + '/')) {
      throw new InternalServerErrorException(
        'Tentative de traversée de répertoire détectée',
      );
    }

    await mkdir(join(this.rootDir, safeScope), { recursive: true });
    await writeFile(absPath, buffer);

    const checksum = createHash('sha256').update(buffer).digest('hex');

    return { storagePath: relPath, size: buffer.length, checksum };
  }

  createReadStream(storagePath: string) {
    return createReadStream(this.resolveAbsolutePath(storagePath));
  }

  resolveAbsolutePath(storagePath: string): string {
    const absolute = resolve(this.rootDir, storagePath);
    if (!absolute.startsWith(this.rootDir + '/')) {
      throw new InternalServerErrorException(
        'Chemin de fichier invalide',
      );
    }
    return absolute;
  }

  async remove(storagePath: string): Promise<void> {
    const absolute = this.resolveAbsolutePath(storagePath);
    try {
      await stat(absolute);
      await unlink(absolute);
    } catch (error) {
      // File already gone — log but don't fail the API call
      this.logger.warn(
        `Fichier déjà absent ou suppression impossible : ${storagePath}`,
        error,
      );
    }
  }
}

// ----------------------------------------------------------
function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

function extractExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  const ext = name.slice(idx).toLowerCase();
  // Whitelist common extensions to avoid odd cases like ".php"
  if (!/^\.[a-z0-9]{1,8}$/.test(ext)) return '';
  return ext;
}
