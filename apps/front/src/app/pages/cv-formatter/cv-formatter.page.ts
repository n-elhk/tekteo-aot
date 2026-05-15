import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ConsultantsStore } from './consultants.store';
import { Button } from '../../shared/ui/button/button';
import type { ConsultantListItem } from '../../core/consultants/consultant.model';

@Component({
  selector: 'app-cv-formatter',
  imports: [RouterLink, DatePipe, Button],
  providers: [ConsultantsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <header class="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-3xl font-semibold text-gray-900">Consultants</h1>
          <p class="text-sm text-gray-500 mt-1">
            {{ totalLabel() }} · gérez les CV maîtres et leurs variantes.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="relative">
            <input
              type="search"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
              placeholder="Rechercher un nom, un email…"
              class="w-72 pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
            <span
              class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
              aria-hidden="true"
            >⌕</span>
          </div>
          <app-button
            variant="primary"
            (click)="goToNew()"
          >
            + Ajouter un consultant
          </app-button>
        </div>
      </header>

      @if (store.loading() && store.items().length === 0) {
        <div class="text-center py-16 text-gray-400">
          Chargement…
        </div>
      } @else if (store.error(); as err) {
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {{ err }}
        </div>
      } @else if (filtered().length === 0) {
        <div class="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          @if (search()) {
            <p class="text-gray-500">Aucun consultant ne correspond à « {{ search() }} ».</p>
          } @else {
            <p class="text-gray-700 font-medium">Aucun consultant pour l'instant</p>
            <p class="text-gray-500 text-sm mt-2 mb-6">
              Commencez par importer un CV ou en créer un manuellement.
            </p>
            <app-button variant="primary" (click)="goToNew()">
              + Ajouter un consultant
            </app-button>
          }
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (c of filtered(); track c.id) {
            <a
              [routerLink]="['/cv-formatter', 'consultants', c.id]"
              class="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-500 hover:shadow-md transition-all flex flex-col gap-3 group"
            >
              <div class="flex items-start gap-3">
                <span
                  class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold shrink-0"
                  aria-hidden="true"
                >
                  {{ initials(c) }}
                </span>
                <div class="flex-1 min-w-0">
                  <h2 class="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {{ c.firstName }} {{ c.lastName }}
                  </h2>
                  <p class="text-xs text-gray-500 truncate">{{ c.role ?? '—' }}</p>
                </div>
              </div>

              <p class="text-sm text-gray-600 truncate">
                {{ c.email }}
              </p>

              <div class="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                <span class="inline-flex items-center gap-1">
                  <span class="font-medium text-gray-700">{{ c._count?.variants ?? 0 }}</span>
                  variante{{ (c._count?.variants ?? 0) > 1 ? 's' : '' }}
                </span>
                <span>{{ c.createdAt | date: 'dd/MM/yyyy' }}</span>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class CvFormatterPage {
  private readonly router = inject(Router);
  protected readonly store = inject(ConsultantsStore);
  protected readonly search = signal('');

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const items = this.store.items();
    if (!term) return items;
    return items.filter((c) => {
      const haystack = [c.firstName, c.lastName, c.email, c.role, c.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  protected readonly totalLabel = computed(() => {
    const n = this.store.total();
    return n === 0
      ? '0 consultant'
      : `${n} consultant${n > 1 ? 's' : ''}`;
  });

  protected initials(c: ConsultantListItem): string {
    const first = c.firstName?.[0] ?? '';
    const last = c.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  protected goToNew() {
    void this.router.navigate(['/cv-formatter/new']);
  }
}
