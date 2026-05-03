import { ChangeDetectionStrategy, Component, InjectionToken, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { ModalShell } from '../modal-shell/modal-shell';
import { Button } from '../button/button';

export interface ConfirmDialogData {
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: 'primary' | 'danger';
}

/**
 * Boîte de dialogue de confirmation générique.
 *
 * À ouvrir via {@link AppDialogService.open} en fournissant {@link ConfirmDialog.DATA}
 * dans les `providers` de configuration. La promesse retournée résout `true`
 * si l'utilisateur confirme, `false` (ou `undefined`) sinon.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button],
  template: `
    <app-modal-shell [title]="data.title" [subtitle]="data.description ?? null">
      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">
          {{ data.cancelLabel ?? 'Annuler' }}
        </app-button>
        <app-button [variant]="data.variant === 'danger' ? 'danger' : 'primary'" (click)="confirm()">
          {{ data.confirmLabel ?? 'Confirmer' }}
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class ConfirmDialog {
  static readonly DATA = new InjectionToken<ConfirmDialogData>('ConfirmDialogData');

  protected readonly data = inject(ConfirmDialog.DATA);
  private readonly dialogRef = inject(DialogRef<boolean, ConfirmDialog>);

  protected confirm(): void {
    this.dialogRef.close(true);
  }
  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
