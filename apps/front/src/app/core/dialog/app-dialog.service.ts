import { Injectable, Type, inject } from '@angular/core';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';

/**
 * Façade autour du `Dialog` du CDK pour fournir des paramètres par défaut
 * cohérents avec la charte de l'application (animations, ARIA, focus).
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialog = inject(Dialog);

  open<TComponent, TData = unknown, TResult = unknown>(
    component: Type<TComponent>,
    config: DialogConfig<TData, DialogRef<TResult, TComponent>> = {},
  ): DialogRef<TResult, TComponent> {
    return this.dialog.open<TResult, TData, TComponent>(
      component as ComponentType<TComponent>,
      {
        ariaModal: true,
        hasBackdrop: true,
        backdropClass: 'app-dialog__backdrop',
        panelClass: 'app-dialog__panel',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        disableClose: false,
        ...config,
      },
    );
  }
}
