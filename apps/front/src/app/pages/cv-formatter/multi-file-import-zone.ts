import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type {
  CvJobEventDto,
  CvTemplateValue,
} from '../../core/consultant-cvs/consultant-cv.model';
import { ToastService } from '../../core/notifications/toast.service';
import { Button } from '../../shared/ui/button/button';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

interface FileEntry {
  readonly file: File;
  jobId: string | null;
  status: 'idle' | 'pending' | 'processing' | 'done' | 'failed';
  consultantId: string | null;
  error: string | null;
}

@Component({
  selector: 'app-multi-file-import-zone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, RouterLink],
  templateUrl: './multi-file-import-zone.html',
})
export class MultiFileImportZone {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);

  protected readonly entries = signal<FileEntry[]>([]);
  protected readonly template = signal<CvTemplateValue>('tekteo');
  protected readonly running = signal(false);

  protected readonly canSubmit = computed(
    () => !this.running() && this.entries().length > 0,
  );

  readonly imported = output<void>();

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files) return;
    this.addFiles(Array.from(files));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected onTemplateChange(value: string): void {
    if (value === 'tekteo' || value === 'anonyme') {
      this.template.set(value);
    }
  }

  protected removeEntry(index: number): void {
    if (this.running()) return;
    this.entries.update((list) => list.filter((_, i) => i !== index));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const files = this.entries().map((e) => e.file);
    this.running.set(true);

    this.cvsService
      .importMultipleFiles(files, this.template())
      .pipe(
        tap(({ jobs }) => {
          this.entries.update((list) =>
            list.map((entry, i) => ({
              ...entry,
              jobId: jobs[i]?.jobId ?? null,
              status: 'pending',
            })),
          );
          jobs.forEach(({ jobId }, i) => this.watchJob(jobId, i));
        }),
        catchError((err: unknown) => {
          this.running.set(false);
          this.toaster.error({
            title: 'Import impossible',
            description: extractErrorMessage(err),
          });
          return of(null);
        }),
      )
      .subscribe();
  }

  private watchJob(jobId: string, entryIndex: number): void {
    this.cvsService
      .watchImportJob(jobId)
      .pipe(
        tap((update: Partial<CvJobEventDto>) => {
          this.entries.update((list) =>
            list.map((entry, i) => {
              if (i !== entryIndex) return entry;
              const status =
                update.status === 'done' || update.status === 'failed'
                  ? update.status
                  : update.status ?? entry.status;
              return {
                ...entry,
                status,
                consultantId: update.consultantId ?? entry.consultantId,
                error: update.error ?? null,
              };
            }),
          );
          if (this.allDone()) {
            this.running.set(false);
            this.imported.emit();
          }
        }),
        catchError(() => {
          this.entries.update((list) =>
            list.map((entry, i) =>
              i === entryIndex
                ? { ...entry, status: 'failed', error: 'Connexion perdue' }
                : entry,
            ),
          );
          if (this.allDone()) this.running.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  private allDone(): boolean {
    return this.entries().every(
      (e) => e.status === 'done' || e.status === 'failed',
    );
  }

  private addFiles(files: File[]): void {
    const existing = this.entries();
    const accepted: FileEntry[] = [];
    for (const file of files) {
      if (existing.length + accepted.length >= MAX_FILES) {
        this.toaster.error({
          title: 'Trop de fichiers',
          description: `Maximum ${MAX_FILES} fichiers par import.`,
        });
        break;
      }
      if (!this.isAccepted(file)) continue;
      if (file.size > MAX_FILE_SIZE) {
        this.toaster.error({
          title: 'Fichier trop volumineux',
          description: `${file.name} dépasse la limite de 10 Mo.`,
        });
        continue;
      }
      accepted.push({
        file,
        jobId: null,
        status: 'idle',
        consultantId: null,
        error: null,
      });
    }
    if (accepted.length > 0) {
      this.entries.update((list) => [...list, ...accepted]);
    }
  }

  private isAccepted(file: File): boolean {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_MIME_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
      this.toaster.error({
        title: 'Format non supporté',
        description: `${file.name} : seuls PDF et DOCX sont acceptés.`,
      });
      return false;
    }
    return true;
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { error?: { message?: unknown }; message?: unknown };
    if (typeof e.error?.message === 'string') return e.error.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Une erreur inattendue est survenue.';
}
