import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

/**
 * Coquille réutilisable pour les boîtes de dialogue ouvertes via {@link AppDialogService}.
 *
 * Fournit en-tête, contenu projeté et pied de page accessibles. Le composant
 * parent reste maître de son contenu : il ne reçoit aucune information
 * sur la dialogue elle-même hors de l'événement {@link closeRequested}.
 */
@Component({
  selector: 'app-modal-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block surface-card rounded-2xl overflow-hidden focus:outline-none',
    role: 'dialog',
    '[attr.aria-labelledby]': 'titleId()',
    '[attr.aria-describedby]': 'descriptionId()',
    tabindex: '-1',
  },
  template: `
    <header class="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-surface-200/70">
      <div class="min-w-0">
        <h2 [id]="titleId()" class="text-lg font-semibold text-surface-900 truncate">
          {{ title() }}
        </h2>
        @if (subtitle(); as s) {
          <p [id]="descriptionId()" class="mt-1 text-sm text-surface-900/60">{{ s }}</p>
        }
      </div>
      <button
        type="button"
        class="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-surface-900/60 hover:text-surface-900 hover:bg-surface-100 transition"
        aria-label="Fermer la fenêtre"
        (click)="onClose()"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <div class="px-6 py-5 text-surface-900/80">
      <ng-content />
    </div>

    <footer class="px-6 pb-5 pt-1">
      <ng-content select="[modalFooter]" />
    </footer>
  `,
})
export class ModalShell {
  private readonly dialogRef = inject(DialogRef, { optional: true });
  private static counter = 0;
  private readonly uid = ++ModalShell.counter;

  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);

  /** Émis quand l'utilisateur clique sur la croix. Ignoré si une `DialogRef` est disponible. */
  readonly closeRequested = output<void>();

  protected titleId(): string {
    return `app-modal-title-${this.uid}`;
  }
  protected descriptionId(): string {
    return `app-modal-desc-${this.uid}`;
  }

  protected onClose(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
      return;
    }
    this.closeRequested.emit();
  }
}
