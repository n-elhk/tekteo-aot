import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CvSkill } from '@org/schemas';

/**
 * Liste de compétences avec barres de niveau (0–100).
 */
@Component({
  selector: 'app-cv-skills-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="grid gap-3 sm:grid-cols-2">
      @for (skill of skills(); track $index) {
        <li class="flex items-center gap-3">
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900">
            {{ skill.name }}
          </span>
          @if (clampLevel(skill.level); as lvl) {
            <div
              class="relative h-2 w-24 flex-shrink-0 overflow-hidden rounded-full bg-surface-100"
              role="progressbar"
              [attr.aria-label]="'Niveau ' + skill.name"
              [attr.aria-valuenow]="lvl"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                class="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
                [style.width.%]="lvl"
              ></div>
            </div>
            <span class="w-9 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-surface-900/60">
              {{ lvl }}%
            </span>
          }
        </li>
      }
    </ul>
  `,
})
export class CvSkillsList {
  readonly skills = input.required<ReadonlyArray<CvSkill>>();

  protected clampLevel(value: number | undefined): number | null {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
