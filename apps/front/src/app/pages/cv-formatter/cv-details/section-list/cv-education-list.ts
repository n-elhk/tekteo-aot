import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvEducation } from '@org/schemas';

/**
 * Liste des formations (diplôme, école, année).
 */
@Component({
  selector: 'app-cv-education-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2">
      @for (edu of education(); track $index) {
        <li
          class="flex flex-col gap-1 rounded-xl border border-surface-200/70 bg-white px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
        >
          <div class="min-w-0 flex-1">
            @if (edu.degree; as degree) {
              <p class="truncate text-sm font-semibold text-surface-900">{{ degree }}</p>
            }
            @if (edu.school; as school) {
              <p class="mt-0.5 truncate text-xs text-surface-900/60">{{ school }}</p>
            }
          </div>
          @if (edu.year; as year) {
            <span
              class="inline-flex w-fit flex-shrink-0 items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
            >
              {{ year }}
            </span>
          }
        </li>
      }
    </ul>
  `,
})
export class CvEducationList {
  readonly education = input.required<ReadonlyArray<CvEducation>>();
}
