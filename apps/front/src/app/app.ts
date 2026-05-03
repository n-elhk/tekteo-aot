import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toaster } from './shared/ui/toaster/toaster';

/**
 * Coquille racine de l'application Tekteo.
 *
 * Monte le routeur ainsi que la pile de notifications globale.
 * Aucune logique métier ici.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Toaster],
  template: `
    <router-outlet />
    <app-toaster />
  `,
})
export class App {}
