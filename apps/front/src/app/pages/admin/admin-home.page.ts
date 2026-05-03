import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '../../shared/ui/card/card';

interface AdminTile {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

const TILES: ReadonlyArray<AdminTile> = [
  {
    path: '/admin/users',
    label: 'Utilisateurs',
    description: 'Gérer les comptes, les rôles et les accès.',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    path: '/admin/prompts',
    label: 'Prompts système',
    description: 'Configurer les invites IA utilisées par la plateforme.',
    icon: 'M3 10h11M9 21V3M21 6L17 2 13 6M17 2v18',
  },
  {
    path: '/admin/section-templates',
    label: 'Modèles de section',
    description: 'Catalogue des modèles réutilisables pour la rédaction.',
    icon: 'M4 6h16M4 12h16M4 18h10',
  },
  {
    path: '/admin/pricing-grids',
    label: 'Grilles de TJM',
    description: 'Référentiel de tarifs journaliers par profil et niveau.',
    icon: 'M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2m0-8v1m0 6v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

/** Page d'index de l'administration : grille d'accès aux outils. */
@Component({
  selector: 'app-admin-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card],
  template: `
    <div class="space-y-6">
      <header class="space-y-1">
        <p class="text-sm font-medium text-brand-700">Administration</p>
        <h1 class="text-3xl font-semibold tracking-tight text-surface-900">
          Pilotage de la plateforme
        </h1>
        <p class="text-sm text-surface-900/60">
          Réservé aux administrateurs. Sélectionnez l'outil souhaité ci-dessous.
        </p>
      </header>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (tile of tiles; track tile.path) {
          <a [routerLink]="tile.path" class="block">
            <app-card>
              <div class="flex items-start gap-4">
                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800">
                  <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="tile.icon" />
                  </svg>
                </span>
                <div class="min-w-0">
                  <p class="text-base font-semibold text-surface-900">{{ tile.label }}</p>
                  <p class="mt-1 text-sm text-surface-900/60">{{ tile.description }}</p>
                </div>
              </div>
            </app-card>
          </a>
        }
      </div>
    </div>
  `,
})
export class AdminHomePage {
  protected readonly tiles = TILES;
}
