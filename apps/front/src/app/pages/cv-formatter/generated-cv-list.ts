import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type {
  CvGenerationStatusValue,
  CvTemplateValue,
  GeneratedCvDto,
} from '@org/schemas';

interface StatusBadge {
  readonly label: string;
  readonly color: string;
  readonly bg: string;
}

const STATUS_BADGES: Record<CvGenerationStatusValue, StatusBadge> = {
  pending: { label: 'En attente', color: '#92400E', bg: '#FEF3C7' },
  processing: { label: 'En cours', color: '#92400E', bg: '#FEF3C7' },
  success: { label: 'Généré', color: '#065F46', bg: '#D1FAE5' },
  failed: { label: 'Échec', color: '#991B1B', bg: '#FEE2E2' },
};

const TEMPLATE_LABELS: Record<CvTemplateValue, string> = {
  tekteo: 'Tekteo',
  anonyme: 'Anonyme',
};

@Component({
  selector: 'app-generated-cv-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <ul class="space-y-2">
      @for (cv of cvs(); track cv.id) {
        <li
          class="flex items-center gap-4 rounded-xl border border-surface-200/70 bg-white px-4 py-3"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-surface-900">
                {{ templateLabel(cv.template) }}
              </span>
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                [style.background-color]="statusBadge(cv.status).bg"
                [style.color]="statusBadge(cv.status).color"
              >
                {{ statusBadge(cv.status).label }}
              </span>
            </div>
            <p class="text-xs text-surface-900/40 mt-0.5">
              {{ cv.createdAt | date: 'dd MMM y, HH:mm' }}
            </p>
            @if (cv.status === 'failed' && cv.errorMessage) {
              <p class="text-xs text-red-700 mt-1">{{ cv.errorMessage }}</p>
            }
          </div>

          <div class="flex items-center gap-1">
            @if (cv.status === 'success') {
              <button
                type="button"
                class="rounded-lg p-2 text-surface-900/50 hover:bg-brand-50 hover:text-brand-700 transition"
                aria-label="Télécharger le CV"
                (click)="download.emit(cv)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                  />
                </svg>
              </button>
            }
            @if (cv.status === 'failed' && canEdit()) {
              <button
                type="button"
                class="rounded-lg p-2 text-surface-900/50 hover:bg-amber-50 hover:text-amber-700 transition"
                aria-label="Régénérer le CV"
                (click)="regenerate.emit(cv)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.7-3.5M19 5a9 9 0 00-14.7 3.5"
                  />
                </svg>
              </button>
            }
            @if (canEdit()) {
              <button
                type="button"
                class="rounded-lg p-2 text-surface-900/40 hover:bg-red-50 hover:text-red-600 transition"
                aria-label="Supprimer le CV"
                (click)="remove.emit(cv)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 7h16"
                  />
                </svg>
              </button>
            }
          </div>
        </li>
      } @empty {
        <li
          class="rounded-xl border border-dashed border-surface-200 bg-surface-50/60 px-4 py-8 text-center"
        >
          <p class="text-sm text-surface-900/60">
            Aucun CV généré pour ce profil.
          </p>
        </li>
      }
    </ul>
  `,
})
export class GeneratedCvList {
  readonly cvs = input.required<ReadonlyArray<GeneratedCvDto>>();
  readonly canEdit = input(false);

  readonly download = output<GeneratedCvDto>();
  readonly regenerate = output<GeneratedCvDto>();
  readonly remove = output<GeneratedCvDto>();

  protected statusBadge(status: CvGenerationStatusValue): StatusBadge {
    return STATUS_BADGES[status];
  }

  protected templateLabel(template: CvTemplateValue): string {
    return TEMPLATE_LABELS[template];
  }
}
