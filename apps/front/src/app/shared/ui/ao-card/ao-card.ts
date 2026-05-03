import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { AoItem } from '../../../core/ao/ao.model';

/**
 * Carte présentationnelle d'un appel d'offres BOAMP.
 *
 * Émet des événements vers le parent : aucun appel HTTP ni mutation interne.
 * Le parent décide de l'effet (analyse, ajout aux favoris, navigation…).
 */
@Component({
  selector: 'app-ao-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article
      class="group flex flex-col gap-3 rounded-2xl border border-surface-200/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_18px_40px_-16px_rgb(59_99_255/0.25)]"
    >
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium uppercase tracking-wider text-brand-700">
            {{ ao().source }}
            @if (ao().typeMarche) { · {{ ao().typeMarche }} }
            @if (ao().procedure) { · {{ ao().procedure }} }
          </p>
          <h3 class="mt-1 text-sm font-semibold text-surface-900 leading-snug line-clamp-3">
            {{ ao().title }}
          </h3>
          @if (ao().buyer; as buyer) {
            <p class="mt-1 text-xs text-surface-900/60 truncate">
              {{ buyer }}
            </p>
          }
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full p-2 transition"
          [class]="
            isFavorite()
              ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
              : 'bg-surface-100 text-surface-900/40 hover:bg-amber-50 hover:text-amber-500'
          "
          [attr.aria-label]="isFavorite() ? 'Retirer des favoris' : 'Ajouter aux favoris'"
          [attr.aria-pressed]="isFavorite()"
          [disabled]="favoriteBusy()"
          (click)="favoriteToggled.emit(ao())"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" [attr.fill]="isFavorite() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.5L13.85 8.3l5.3.77-3.83 3.74.9 5.27L11.48 15.6 6.74 18.08l.9-5.27L3.81 9.07l5.3-.77z" />
          </svg>
        </button>
      </header>

      <dl class="grid grid-cols-2 gap-2 text-xs">
        @if (formattedDeadline(); as deadline) {
          <div class="flex flex-col">
            <dt class="font-medium text-surface-900/50">Date limite</dt>
            <dd class="font-semibold" [class]="isUrgent() ? 'text-red-600' : 'text-surface-900'">
              {{ deadline }}
            </dd>
          </div>
        }
        @if (ao().department; as department) {
          <div class="flex flex-col">
            <dt class="font-medium text-surface-900/50">Département</dt>
            <dd class="font-semibold text-surface-900">{{ department }}</dd>
          </div>
        }
      </dl>

      <footer class="flex items-center gap-2">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-2 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-800 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          (click)="analyseRequested.emit(ao())"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" transform="translate(7 0)" />
          </svg>
          Analyser
        </button>
        @if (ao().url; as url) {
          <a
            [href]="url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-medium text-surface-900 hover:border-brand-300 hover:text-brand-700 transition"
          >
            Source
          </a>
        }
      </footer>
    </article>
  `,
})
export class AoCard {
  readonly ao = input.required<AoItem>();
  readonly isFavorite = input<boolean>(false);
  readonly favoriteBusy = input<boolean>(false);

  readonly favoriteToggled = output<AoItem>();
  readonly analyseRequested = output<AoItem>();

  protected readonly formattedDeadline = computed(() => {
    const value = this.ao().deadline;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  });

  protected readonly isUrgent = computed(() => {
    const value = this.ao().deadline;
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const diffMs = date.getTime() - Date.now();
    return diffMs > 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
  });
}
