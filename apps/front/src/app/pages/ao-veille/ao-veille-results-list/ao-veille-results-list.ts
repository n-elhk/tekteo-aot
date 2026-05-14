import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '../../../shared/ui/card/card';
import { AoCard } from '../../../shared/ui/ao-card/ao-card';
import type { AoItem } from '../../../core/ao/ao.model';
import type { AoListItem } from '../ao-list-item.model';

/**
 * Liste présentationnelle des résultats de recherche d'AO.
 *
 * Affiche les différents états (initial, erreur, chargement, vide, résultats)
 * et la pagination. Les actions sur chaque carte sont remontées vers le parent
 * via des outputs — aucun appel HTTP ni accès à un service.
 */
@Component({
  selector: 'app-ao-veille-results-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, AoCard],
  template: `
    @if (!hasSearched()) {
      <app-card>
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <span
            class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-7 w-7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12l2 2 4-4M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
          </span>
          <p class="mt-4 text-base font-medium text-surface-900">
            Lancez votre première recherche
          </p>
          <p class="mt-1 max-w-sm text-sm text-surface-900/60">
            Affinez les critères ci-dessus puis cliquez sur
            <strong>Rechercher</strong>
            pour interroger le BOAMP en temps réel.
          </p>
        </div>
      </app-card>
    } @else if (hasError()) {
      <app-card>
        <p class="text-sm text-red-700" role="alert">
          Le service BOAMP est temporairement indisponible. Réessayez dans
          quelques instants.
        </p>
      </app-card>
    } @else if (isLoading()) {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (placeholder of placeholders; track placeholder) {
          <div class="h-48 animate-pulse rounded-2xl bg-surface-100"></div>
        }
      </div>
    } @else if (items().length === 0) {
      <app-card>
        <p class="text-sm text-surface-900/70 text-center py-8">
          Aucun appel d'offres ne correspond à vos critères. Essayez d'élargir
          la recherche.
        </p>
      </app-card>
    } @else {
      <div class="space-y-3">
        <div
          class="flex items-center justify-between text-sm text-surface-900/60"
        >
          <p>{{ totalCount() }} résultats</p>
          <a
            routerLink="/analyses-ao"
            class="font-medium text-brand-700 hover:text-brand-800"
          >
            Voir mes analyses précédentes →
          </a>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (item of items(); track item.ao.id) {
            <app-ao-card
              [ao]="item.ao"
              [isFavorite]="item.isFavorite"
              [favoriteBusy]="false"
              [isImported]="item.isImported"
              [isNew]="item.isNew"
              [cctpBusy]="item.cctpBusy"
              (favoriteToggled)="favoriteToggled.emit($event)"
              (analyseRequested)="analyseRequested.emit($event)"
              (createProjectRequested)="createProjectRequested.emit($event)"
              (cctpFileSelected)="cctpFileSelected.emit($event)"
            />
          }
        </div>

        @if (totalPages() > 1) {
          <nav
            class="flex items-center justify-center gap-2"
            aria-label="Pagination"
          >
            <button
              type="button"
              [disabled]="currentPage() <= 1"
              (click)="goToPage(currentPage() - 1)"
              class="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-medium text-surface-900 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Précédent
            </button>
            <span class="text-sm text-surface-900/70">
              Page {{ currentPage() }} sur {{ totalPages() }}
            </span>
            <button
              type="button"
              [disabled]="currentPage() >= totalPages()"
              (click)="goToPage(currentPage() + 1)"
              class="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-medium text-surface-900 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Suivant →
            </button>
          </nav>
        }
      </div>
    }
  `,
})
export class AoVeilleResultsList {
  readonly items = input.required<ReadonlyArray<AoListItem>>();
  readonly hasSearched = input.required<boolean>();
  readonly hasError = input.required<boolean>();
  readonly isLoading = input.required<boolean>();
  readonly totalCount = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();

  readonly favoriteToggled = output<AoItem>();
  readonly analyseRequested = output<AoItem>();
  readonly createProjectRequested = output<AoItem>();
  readonly cctpFileSelected = output<{ ao: AoItem; file: File }>();
  readonly pageChanged = output<number>();

  protected readonly placeholders = [1, 2, 3, 4, 5, 6] as const;

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.pageChanged.emit(page);
  }
}
