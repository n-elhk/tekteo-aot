import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { filter, switchMap, tap } from 'rxjs';
import type { SectionStatus } from '@org/types';
import { SectionsService, SectionWithTemplate } from '../../core/sections/sections.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { SectionStatusBadge } from '../../shared/ui/section-status-badge/section-status-badge';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog/confirm-dialog';
import {
  ALLOWED_ATTACHMENT_TYPES,
  AttachmentTooLargeError,
  FileAttachment,
  UnsupportedAttachmentError,
  readFileAsAttachment,
} from '../../core/files/file-attachment.helper';

/**
 * Éditeur de section : permet d'éditer le contenu, de générer ou ajuster
 * via Claude (avec pièces jointes), de basculer le statut et de sauvegarder.
 */
@Component({
  selector: 'app-section-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, SectionStatusBadge],
  templateUrl: './section-editor.page.html',
})
export class SectionEditorPage {
  private readonly sectionsService = inject(SectionsService);
  private readonly toaster = inject(ToastService);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);

  /** Paramètres injectés par le routeur via `withComponentInputBinding`. */
  readonly id = input.required<string>();
  readonly sectionId = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;

  protected readonly resource = rxResource({
    params: () => this.sectionId(),
    stream: ({ params }) => this.sectionsService.get(params),
  });

  /** Section chargée depuis le backend (lecture seule). */
  protected readonly loadedSection = computed<SectionWithTemplate | null>(
    () => this.resource.value() ?? null,
  );
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  // -- État éditable ---------------------------------------------------
  protected readonly content = signal('');
  protected readonly instructions = signal('');
  protected readonly attachments = signal<ReadonlyArray<FileAttachment>>([]);
  protected readonly status = signal<SectionStatus>('brouillon');

  protected readonly saving = signal(false);
  protected readonly generating = signal(false);
  protected readonly acceptedAttachmentMime = ALLOWED_ATTACHMENT_TYPES.join(',');

  protected readonly isDirty = computed(() => {
    const s = this.loadedSection();
    if (!s) return false;
    return this.content() !== s.content || this.status() !== s.status;
  });

  constructor() {
    // Synchronise les signaux locaux quand la section est (re)chargée.
    // `untracked` empêche les écritures de relancer l'effet en boucle.
    effect(() => {
      const section = this.loadedSection();
      if (!section) return;
      untracked(() => {
        this.content.set(section.content);
        this.status.set(section.status);
      });
    });
  }

  protected onContentChange(value: string): void {
    this.content.set(value);
  }
  protected onInstructionsChange(value: string): void {
    this.instructions.set(value);
  }
  protected onStatusChange(value: string): void {
    this.status.set(value as SectionStatus);
  }

  protected async onFilesPicked(input: HTMLInputElement): Promise<void> {
    const files = input.files;
    if (!files || files.length === 0) return;
    const collected: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        collected.push(await readFileAsAttachment(file));
      } catch (err) {
        const message =
          err instanceof UnsupportedAttachmentError || err instanceof AttachmentTooLargeError
            ? err.message
            : 'Lecture du fichier impossible.';
        this.toaster.error({ title: 'Pièce jointe ignorée', description: message });
      }
    }
    if (collected.length > 0) {
      this.attachments.update((current) => [...current, ...collected].slice(0, 5));
    }
    input.value = '';
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((current) => current.filter((_, i) => i !== index));
  }

  protected save(): void {
    const section = this.loadedSection();
    if (!section || this.saving()) return;
    this.saving.set(true);
    this.sectionsService
      .update(section.id, { content: this.content(), status: this.status() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toaster.success({ title: 'Section enregistrée' });
          this.resource.reload();
        },
        error: () => {
          this.saving.set(false);
          this.toaster.error({
            title: 'Sauvegarde impossible',
            description: 'Veuillez réessayer dans un instant.',
          });
        },
      });
  }

  protected generate(adjust: boolean): void {
    const section = this.loadedSection();
    if (!section || this.generating()) return;
    this.generating.set(true);
    this.sectionsService
      .generate(section.id, {
        ...(this.instructions().trim() ? { instructions: this.instructions().trim() } : {}),
        ...(this.attachments().length > 0
          ? { attachments: [...this.attachments()] }
          : {}),
        ...(adjust ? { baseContent: this.content() } : {}),
      })
      .subscribe({
        next: (result) => {
          this.generating.set(false);
          this.content.set(result.content);
          this.toaster.success({
            title: adjust ? 'Contenu ajusté' : 'Contenu généré',
            description: `Modèle utilisé : ${result.modelUsed}`,
          });
        },
        error: (error: unknown) => {
          this.generating.set(false);
          this.toaster.error({
            title: 'Génération impossible',
            description: extractErrorMessage(error),
          });
        },
      });
  }

  protected confirmDelete(): void {
    const section = this.loadedSection();
    if (!section) return;
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      ...APP_DIALOG_CONFIG,
      data: {
        title: 'Supprimer cette section ?',
        description: `« ${section.title} » sera définitivement supprimée.`,
        confirmLabel: 'Supprimer',
        variant: 'danger',
      },
    });

    ref.closed
      .pipe(
        filter(Boolean),
        switchMap(() => this.sectionsService.remove(section.id)),
        tap(() => {
          this.toaster.success({ title: 'Section supprimée' });
          this.router.navigate(['/projects', this.id()]);
        }),
      )
      .subscribe({
        error: () =>
          this.toaster.error({
            title: 'Suppression impossible',
            description: 'Veuillez réessayer dans un instant.',
          }),
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
