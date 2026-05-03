import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ExperienceLevel } from '../../../core/job-profiles/job-profile.model';

interface Visual {
  readonly label: string;
  readonly classes: string;
}

const VISUALS: Record<ExperienceLevel, Visual> = {
  junior: { label: 'Junior', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  confirme: { label: 'Confirmé', classes: 'bg-brand-50 text-brand-800 ring-brand-200' },
  senior: { label: 'Senior', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  expert: { label: 'Expert', classes: 'bg-purple-50 text-purple-800 ring-purple-200' },
};

/** Pastille colorée du niveau d'expérience d'un consultant. */
@Component({
  selector: 'app-experience-level-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <span
      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
      [class]="visual().classes"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
      {{ visual().label }}
    </span>
  `,
})
export class ExperienceLevelBadge {
  readonly level = input.required<ExperienceLevel>();
  protected readonly visual = computed(() => VISUALS[this.level()]);
}
