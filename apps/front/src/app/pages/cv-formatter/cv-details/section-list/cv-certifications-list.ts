import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvCertification } from '@org/schemas';

/**
 * Liste des certifications avec badge d'année.
 */
@Component({
  selector: 'app-cv-certifications-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2">
      @for (cert of certifications(); track $index) {
        <li
          class="flex items-center gap-3 rounded-xl border border-surface-200/70 bg-white px-3 py-2"
        >
          <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
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
                d="M12 15l-3.09 1.62.59-3.44L7 10.74l3.45-.5L12 7l1.55 3.24 3.45.5-2.5 2.44.59 3.44z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 19l4 2 4-2"
              />
            </svg>
          </span>
          <p class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900">
            {{ cert.name }}
          </p>
          @if (cert.year; as year) {
            <span
              class="inline-flex flex-shrink-0 items-center rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-semibold text-surface-900/70"
            >
              {{ year }}
            </span>
          }
        </li>
      }
    </ul>
  `,
})
export class CvCertificationsList {
  readonly certifications = input.required<ReadonlyArray<CvCertification>>();
}
