import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ConsultantCvsService } from '../../core/consultant-cvs/consultant-cvs.service';
import type { ConsultantCv } from '../../core/consultant-cvs/consultant-cv.model';
import { ToastService } from '../../core/notifications/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog/confirm-dialog';
import { CvImportPage } from './cv-import.page';

const MIN_TEXT_LENGTH = 50;
const MAX_TEXT_LENGTH = 50000;

/**
 * Page CV Formatter : permet de coller le contenu textuel d'un CV (extrait
 * d'un PDF / Word côté utilisateur) et de le structurer via Claude.
 *
 * Affiche également la liste des CV déjà persistés.
 */
@Component({
  selector: 'app-cv-formatter-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, DatePipe, CvImportPage],
  templateUrl: './cv-formatter.page.html',
})
export class CvFormatterPage {
  private readonly cvsService = inject(ConsultantCvsService);
  private readonly toaster = inject(ToastService);
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(AppDialogService);

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly minTextLength = MIN_TEXT_LENGTH;
  protected readonly maxTextLength = MAX_TEXT_LENGTH;

  protected readonly text = signal('');
  protected readonly persist = signal(true);
  protected readonly running = signal(false);
  protected readonly removingId = signal<string | null>(null);

  protected readonly characters = computed(() => this.text().length);
  protected readonly canSubmit = computed(
    () =>
      !this.running() &&
      this.characters() >= MIN_TEXT_LENGTH &&
      this.characters() <= MAX_TEXT_LENGTH,
  );

  protected readonly resource = rxResource({
    stream: () => this.cvsService.list(),
  });

  protected readonly cvs = computed<ConsultantCv[]>(() => this.resource.value() ?? []);
  protected readonly listLoading = computed(() => this.resource.isLoading());
  protected readonly listError = computed(() => this.resource.error() !== undefined);

  protected onTextChange(value: string): void {
    this.text.set(value);
  }

  protected onPersistChange(checked: boolean): void {
    this.persist.set(checked);
  }

  protected formatFromText(): void {
    if (!this.canSubmit()) return;
    this.running.set(true);
    this.cvsService.formatFromText({ cvText: this.text(), persist: this.persist() }).subscribe({
      next: (response) => {
        this.running.set(false);
        if (response.cv) {
          this.toaster.success({
            title: 'CV créé',
            description: response.cv.consultantName ?? 'CV structuré et enregistré',
          });
          this.text.set('');
          this.resource.reload();
        } else {
          this.toaster.success({
            title: 'CV structuré',
            description: 'Le CV a été extrait sans persistance.',
          });
        }
      },
      error: (error: unknown) => {
        this.running.set(false);
        this.toaster.error({
          title: 'Extraction impossible',
          description: extractErrorMessage(error),
        });
      },
    });
  }

  protected async deleteCv(cv: ConsultantCv, event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (this.removingId()) return;
    const ref = this.dialog.open<ConfirmDialog, void, boolean>(ConfirmDialog, {
      data: undefined,
      providers: [
        {
          provide: ConfirmDialog.DATA,
          useValue: {
            title: 'Supprimer ce CV ?',
            description: cv.consultantName
              ? `Le CV de « ${cv.consultantName} » sera définitivement supprimé.`
              : 'Ce CV sera définitivement supprimé.',
            confirmLabel: 'Supprimer',
            variant: 'danger' as const,
          },
        },
      ],
    });
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;
    this.removingId.set(cv.id);
    this.cvsService.remove(cv.id).subscribe({
      next: () => {
        this.removingId.set(null);
        this.toaster.success({ title: 'CV supprimé' });
        this.resource.reload();
      },
      error: () => {
        this.removingId.set(null);
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        });
      },
    });
  }

  protected initials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
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
