import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/ui/button/button';

/** Page d'erreur 404 — affichée pour toute route inconnue. */
@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <p class="text-sm font-semibold uppercase tracking-wider text-brand-700">Erreur 404</p>
      <h1 class="mt-2 text-4xl font-semibold tracking-tight text-surface-900">
        Cette page s'est <span class="gradient-text">évaporée</span>.
      </h1>
      <p class="mt-3 max-w-md text-sm text-surface-900/60">
        Le contenu que vous cherchez n'existe plus ou a été déplacé.
        Retournons sur le tableau de bord.
      </p>
      <div class="mt-8">
        <a routerLink="/dashboard">
          <app-button variant="primary" size="lg">Retour au tableau de bord</app-button>
        </a>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
