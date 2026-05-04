import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type {
  CvImportJobDto,
  CvImportTemplateValue,
} from '../../core/consultant-cvs/consultant-cv.model';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Template = CvImportTemplateValue;

@Component({
  selector: 'app-cv-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Button],
  templateUrl: './cv-import.page.html',
})
export class CvImportPage {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);
  private sseSubscription: Subscription | null = null;

  protected readonly file = signal<File | null>(null);
  protected readonly template = signal<Template>('modern');
  protected readonly job = signal<Partial<CvImportJobDto> | null>(null);
  protected readonly running = signal(false);

  protected readonly canSubmit = computed(
    () => !this.running() && this.file() !== null,
  );
  protected readonly fileName = computed(() => this.file()?.name ?? '');
  protected readonly status = computed(() => this.job()?.status ?? null);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    if (!picked) {
      this.file.set(null);
      return;
    }
    const ext = '.' + picked.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_MIME_TYPES.has(picked.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
      this.toaster.error({
        title: 'Format non supporté',
        description: 'Seuls les fichiers PDF et DOCX sont acceptés.',
      });
      input.value = '';
      return;
    }
    if (picked.size > MAX_FILE_SIZE) {
      this.toaster.error({
        title: 'Fichier trop volumineux',
        description: 'La taille maximale est de 10 Mo.',
      });
      input.value = '';
      return;
    }
    this.file.set(picked);
  }

  protected onTemplateChange(value: string): void {
    if (value === 'modern' || value === 'classic') {
      this.template.set(value);
    }
  }

  protected submit(): void {
    const f = this.file();
    if (!f || this.running()) return;
    this.running.set(true);
    this.job.set(null);
    this.cvsService.importFromFile(f, this.template()).subscribe({
      next: ({ jobId }) => this.watchJob(jobId),
      error: (error: unknown) => {
        this.running.set(false);
        this.toaster.error({
          title: 'Import impossible',
          description: extractErrorMessage(error),
        });
      },
    });
  }

  protected openCv(): void {
    const current = this.job();
    if (!current?.cvId) return;
    this.router.navigate(['/cv', current.cvId]);
  }

  private watchJob(jobId: string): void {
    this.sseSubscription?.unsubscribe();
    this.sseSubscription = this.cvsService.watchImportJob(jobId).subscribe({
      next: (update) => {
        this.job.update((prev) => ({ ...prev, jobId, ...update }));
        if (update.status === 'done') {
          this.running.set(false);
          this.toaster.success({
            title: 'CV importé',
            description: 'Le CV a été extrait et enregistré.',
          });
        } else if (update.status === 'failed') {
          this.running.set(false);
          this.toaster.error({
            title: "Échec de l'import",
            description: update.error ?? 'Le worker a renvoyé une erreur.',
          });
        }
      },
      error: () => {
        this.running.set(false);
        this.toaster.error({
          title: 'Suivi du job impossible',
          description: 'La connexion temps réel a été perdue.',
        });
      },
    });
  }
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { message?: unknown }; message?: unknown };
    const inner = maybeError.error?.message;
    if (typeof inner === 'string') return inner;
    if (typeof maybeError.message === 'string') return maybeError.message;
  }
  return 'Une erreur inattendue est survenue.';
}
