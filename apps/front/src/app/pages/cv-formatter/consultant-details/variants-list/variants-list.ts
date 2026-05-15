import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { CvVariant } from '../../../../core/cv-variants/cv-variant.model';

@Component({
  selector: 'app-variants-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variants().length === 0) {
      <div class="rounded-xl border border-dashed border-surface-200 bg-surface-50/50 p-8 text-center">
        <p class="text-sm font-medium text-surface-900">Aucune variante</p>
        <p class="mt-1 text-xs text-surface-900/60">
          Créez une variante depuis le bouton « Nouvelle variante » pour
          adapter ce CV à une fiche de poste précise.
        </p>
      </div>
    } @else {
      <ul class="flex flex-col gap-2">
        @for (v of variants(); track v.id) {
          <li>
            <article class="group rounded-xl border border-surface-200/70 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-[0_18px_40px_-16px_rgb(59_99_255/0.2)]">
              <div class="flex items-start justify-between gap-3">
                <a
                  [routerLink]="['/cv-formatter', 'variants', v.id]"
                  class="min-w-0 flex-1"
                >
                  <p class="truncate font-medium text-surface-900 group-hover:text-brand-800">
                    {{ v.name }}
                  </p>
                  <p class="mt-0.5 truncate text-xs text-surface-900/60">
                    {{ v.jobProfile.title }}
                  </p>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span class="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                      {{ templateLabel(v.template) }}
                    </span>
                    @if (v.generatedCvs[0]; as g) {
                      <span [class]="pdfStatusClass(g.status)">
                        @switch (g.status) {
                          @case ('success') { ● PDF prêt }
                          @case ('processing') { ○ Génération… }
                          @case ('pending') { ○ En attente }
                          @case ('failed') { ✕ Échec }
                        }
                      </span>
                    } @else {
                      <span class="rounded-full bg-surface-100 px-2 py-0.5 text-surface-900/50">
                        Aucun PDF
                      </span>
                    }
                    <span class="text-surface-900/40">
                      · {{ v.updatedAt | date: 'dd MMM yyyy' }}
                    </span>
                  </div>
                </a>
                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-surface-900/50 hover:bg-brand-50 hover:text-brand-700 transition"
                    title="Régénérer (IA)"
                    aria-label="Régénérer la variante"
                    (click)="regenerate.emit(v.id)"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-3M20 14a8 8 0 01-14 3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-surface-900/50 hover:bg-accent-400/20 hover:text-accent-600 transition"
                    title="Générer le PDF"
                    aria-label="Générer le PDF"
                    (click)="generatePdf.emit(v.id)"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h4M14 3h-7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-surface-900/50 hover:bg-red-50 hover:text-red-600 transition"
                    title="Supprimer"
                    aria-label="Supprimer la variante"
                    (click)="delete.emit(v.id)"
                  >
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          </li>
        }
      </ul>
    }
  `,
})
export class VariantsList {
  readonly variants = input.required<CvVariant[]>();
  readonly regenerate = output<string>();
  readonly generatePdf = output<string>();
  readonly delete = output<string>();

  protected templateLabel(t: string): string {
    return t === 'tekteo' ? 'Tekteo' : 'Anonyme';
  }

  protected pdfStatusClass(status: string): string {
    const base = 'rounded-full px-2 py-0.5 font-medium';
    switch (status) {
      case 'success':
        return `${base} bg-emerald-50 text-emerald-700`;
      case 'processing':
      case 'pending':
        return `${base} bg-amber-50 text-amber-700`;
      case 'failed':
        return `${base} bg-red-50 text-red-700`;
      default:
        return `${base} bg-surface-100 text-surface-900/60`;
    }
  }
}
