import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ConsultantsStore } from './consultants.store';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import type { ConsultantListItem } from '../../core/consultants/consultant.model';

@Component({
  selector: 'app-consultants',
  imports: [RouterLink, DatePipe, Button, Card],
  providers: [ConsultantsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- En-tête -->
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-medium text-brand-700">Mes consultants</p>
          <h1 class="mt-1 text-3xl font-semibold tracking-tight text-surface-900">
            Roster des consultants
          </h1>
          <p class="mt-1 text-sm text-surface-900/60">
            @if (!store.loading()) {
              {{ store.total() }} consultant{{ store.total() > 1 ? 's' : '' }} ·
              {{ totalVariants() }} variante{{ totalVariants() > 1 ? 's' : '' }} de CV générée{{ totalVariants() > 1 ? 's' : '' }}.
            } @else {
              Chargement&hellip;
            }
          </p>
        </div>
        <a routerLink="/consultants/new">
          <app-button variant="primary">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter un consultant
          </app-button>
        </a>
      </header>

      <!-- Recherche -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label class="relative flex-1 max-w-md">
          <span class="sr-only">Rechercher un consultant</span>
          <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-900/40" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="search"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            placeholder="Rechercher par nom, email, rôle…"
            class="block w-full rounded-xl border border-surface-200 bg-white pl-9 pr-3 py-2.5 text-sm shadow-sm placeholder:text-surface-900/40 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
          />
        </label>
      </div>

      <!-- États -->
      @if (store.error(); as msg) {
        <app-card>
          <div class="flex items-center justify-between gap-3" role="alert">
            <p class="text-sm text-red-700">{{ msg }}</p>
            <app-button variant="secondary" (click)="store.loadPage(store.page())">Réessayer</app-button>
          </div>
        </app-card>
      } @else if (store.loading() && store.items().length === 0) {
        <div class="grid gap-3">
          @for (placeholder of [1, 2, 3, 4]; track placeholder) {
            <div class="h-20 animate-pulse rounded-2xl bg-surface-100"></div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <app-card>
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 14a4 4 0 10-8 0M12 11a4 4 0 110-8 4 4 0 010 8zM4 21a8 8 0 0116 0" />
              </svg>
            </span>
            <p class="mt-4 text-base font-medium text-surface-900">
              @if (store.items().length === 0) {
                Aucun consultant pour le moment.
              } @else {
                Aucun consultant ne correspond à votre recherche.
              }
            </p>
            <p class="mt-1 max-w-sm text-sm text-surface-900/60">
              Importez un CV existant ou créez un consultant manuellement pour démarrer.
            </p>
            @if (store.items().length === 0) {
              <a routerLink="/consultants/new" class="mt-6">
                <app-button variant="primary">Ajouter un consultant</app-button>
              </a>
            }
          </div>
        </app-card>
      } @else {
        <ul class="grid grid-cols-1 gap-3">
          @for (c of filtered(); track c.id) {
            <li>
              <a
                [routerLink]="['/consultants', c.id]"
                class="group flex w-full items-center gap-4 rounded-2xl border border-surface-200/70 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_18px_40px_-16px_rgb(59_99_255/0.25)]"
              >
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 font-semibold text-brand-700">
                  {{ initials(c) }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold text-surface-900 group-hover:text-brand-800">
                    {{ c.firstName }} {{ c.lastName }}
                  </p>
                  @if (c.role) {
                    <p class="truncate text-sm text-surface-900/60">{{ c.role }}</p>
                  }
                  <p class="mt-0.5 truncate text-xs text-surface-900/40">
                    {{ c.email }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-3 text-sm">
                  @if (c._count.variants; as nb) {
                    <span class="hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 sm:inline-flex">
                      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      {{ nb }} variante{{ nb > 1 ? 's' : '' }}
                    </span>
                  } @else {
                    <span class="hidden rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-900/60 sm:inline-flex">
                      Sans variante
                    </span>
                  }
                  <span class="hidden items-center gap-1.5 text-surface-900/60 sm:inline-flex">
                    <svg viewBox="0 0 24 24" class="h-4 w-4 text-surface-900/40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    {{ c.createdAt | date: 'dd MMM yyyy' }}
                  </span>
                  <svg viewBox="0 0 24 24" class="h-4 w-4 text-surface-900/30 transition group-hover:translate-x-0.5 group-hover:text-brand-700" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class ConsultantsPage {
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

  protected readonly totalVariants = computed(() =>
    this.store.items().reduce((acc, c) => acc + (c._count.variants), 0),
  );

  protected initials(c: ConsultantListItem): string {
    const first = c.firstName?.[0] ?? '';
    const last = c.lastName?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }
}
