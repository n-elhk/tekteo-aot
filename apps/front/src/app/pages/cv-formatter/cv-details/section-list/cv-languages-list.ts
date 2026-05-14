import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvLanguage } from '@org/schemas';

/**
 * Liste des langues avec indicateur de niveau en pastilles (1 à 5).
 */
@Component({
  selector: 'app-cv-languages-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="grid gap-3 sm:grid-cols-2">
      @for (lang of languages(); track $index) {
        <li class="flex items-center justify-between gap-3 rounded-xl bg-surface-50 px-3 py-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-surface-900">
              {{ lang.name }}
            </p>
            @if (lang.levelLabel; as label) {
              <p class="mt-0.5 truncate text-xs text-surface-900/60">{{ label }}</p>
            }
          </div>
          @if (dotsFor(lang.dots); as arr) {
            <div class="flex flex-shrink-0 items-center gap-1" [attr.aria-label]="ariaLevel(lang)">
              @for (filled of arr; track $index) {
                @if (filled) {
                  <span
                    class="inline-block h-2.5 w-2.5 rounded-full bg-brand-600"
                    aria-hidden="true"
                  ></span>
                } @else {
                  <span
                    class="inline-block h-2.5 w-2.5 rounded-full bg-surface-200"
                    aria-hidden="true"
                  ></span>
                }
              }
            </div>
          }
        </li>
      }
    </ul>
  `,
})
export class CvLanguagesList {
  readonly languages = input.required<ReadonlyArray<CvLanguage>>();

  protected dotsFor(value: number | undefined): ReadonlyArray<boolean> | null {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    const filled = Math.max(0, Math.min(5, Math.round(value)));
    return [0, 1, 2, 3, 4].map((i) => i < filled);
  }

  protected ariaLevel(lang: CvLanguage): string {
    const dots = typeof lang.dots === 'number' ? Math.round(lang.dots) : 0;
    return `Niveau ${dots} sur 5`;
  }
}
