import type { DialogConfig } from '@angular/cdk/dialog';

/**
 * Configuration par défaut à étaler dans `Dialog.open(component, { ...APP_DIALOG_CONFIG, data })`
 * pour conserver l'habillage et l'accessibilité partagés (backdrop flouté, animation
 * pop-in, focus piégé, restauration du focus).
 */
export const APP_DIALOG_CONFIG = {
  ariaModal: true,
  hasBackdrop: true,
  backdropClass: 'app-dialog__backdrop',
  panelClass: 'app-dialog__panel',
  autoFocus: 'first-tabbable',
  restoreFocus: true,
  disableClose: false,
} satisfies Pick<
  DialogConfig,
  | 'ariaModal'
  | 'hasBackdrop'
  | 'backdropClass'
  | 'panelClass'
  | 'autoFocus'
  | 'restoreFocus'
  | 'disableClose'
>;
