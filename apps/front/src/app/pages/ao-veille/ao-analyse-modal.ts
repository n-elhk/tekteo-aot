import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import type { AoItem } from '../../core/ao/ao.model';
import { ModalShell } from '../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../shared/ui/button/button';
import { extractTextFromFile } from '../../core/files/extract-text';
import { ToastService } from '../../core/notifications/toast.service';

export interface AoAnalyseModalData {
  readonly ao: AoItem;
}

export interface AoAnalyseModalResult {
  readonly rcText: string | null;
}

/**
 * Modale de confirmation de lancement d'analyse IA pour un AO.
 *
 * Permet de joindre optionnellement un RC/CCTP/AE extrait localement avant
 * de confirmer. À la fermeture, retourne `null` (annulation) ou le texte
 * éventuellement extrait via {@link AoAnalyseModalResult}.
 */
@Component({
  selector: 'app-ao-analyse-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button],
  template: `
    <app-modal-shell
      title="Analyse IA approfondie"
      subtitle="Faisabilité + détection d'AO truqué"
    >
      <div class="space-y-4">
        <div class="rounded-xl bg-surface-100/70 px-3 py-2 text-xs text-surface-900/70">
          <p class="line-clamp-2">{{ data.ao.title }}</p>
        </div>

        <label
          class="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
        >
          <input
            type="file"
            accept=".pdf,.docx"
            class="hidden"
            [disabled]="extracting()"
            (change)="onFileChange($event)"
          />
          @if (extracting()) {
            <span class="inline-flex items-center gap-2 text-sm font-medium text-brand-700">
              <span class="h-4 w-4 rounded-full border-2 border-brand-500 border-r-transparent animate-spin" aria-hidden="true"></span>
              Extraction en cours…
            </span>
          } @else if (rcText() !== null) {
            <div class="flex w-full items-center justify-between gap-3 text-left">
              <div class="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>RC chargé ({{ formattedLength(rcText()!) }} caractères)</span>
              </div>
              <button
                type="button"
                class="rounded-full p-1 text-surface-900/60 hover:bg-surface-100 hover:text-surface-900 transition"
                aria-label="Retirer le RC chargé"
                (click)="$event.preventDefault(); $event.stopPropagation(); clearRc()"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          } @else {
            <svg viewBox="0 0 24 24" class="h-8 w-8 text-surface-900/40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span class="text-sm font-medium text-surface-900">Déposer un RC, CCTP ou AE</span>
            <span class="text-xs text-surface-900/60">.pdf ou .docx</span>
          }
        </label>
      </div>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button variant="primary" [disabled]="extracting()" (click)="confirm()">
          Analyser →
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class AoAnalyseModal {
  protected readonly data = inject<AoAnalyseModalData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<AoAnalyseModalResult, AoAnalyseModal>);
  private readonly toaster = inject(ToastService);

  protected readonly extracting = signal(false);
  protected readonly rcText = signal<string | null>(null);

  protected onFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    this.extracting.set(true);
    extractTextFromFile(file)
      .then((text) => {
        this.extracting.set(false);
        this.rcText.set(text);
      })
      .catch((error: unknown) => {
        this.extracting.set(false);
        this.toaster.error({
          title: 'Extraction impossible',
          description: extractErrorMessage(error),
        });
      });
  }

  protected clearRc(): void {
    this.rcText.set(null);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    const text = this.rcText();
    this.dialogRef.close({ rcText: text && text.trim() ? text : null });
  }

  protected formattedLength(text: string): string {
    const length = text.length;
    if (length < 1000) return `${length}`;
    return `${Math.round(length / 1000)} k`;
  }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Une erreur inattendue est survenue.';
}
