import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
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
 * À ouvrir via `Dialog.open(ConfirmDialog, { data: { ... } })`. La promesse
 * issue de `closed` résout `true` si l'utilisateur confirme, `false` (ou
 * `undefined`) sinon.
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
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean, ConfirmDialog>);

  protected confirm(): void {
    this.dialogRef.close(true);
  }
  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
