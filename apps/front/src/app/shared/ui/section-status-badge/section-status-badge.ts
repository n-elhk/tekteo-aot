import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SectionStatus } from '@org/types';

interface Visual {
  readonly label: string;
  readonly classes: string;
}

const VISUALS: Record<SectionStatus, Visual> = {
  brouillon: { label: 'Brouillon', classes: 'bg-surface-100 text-surface-900/70 ring-surface-200' },
  valide: { label: 'Validée', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
};

/** Pastille du statut d'une section (brouillon / validée). */
@Component({
  selector: 'app-section-status-badge',
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
export class SectionStatusBadge {
  readonly status = input.required<SectionStatus>();
  protected readonly visual = computed(() => VISUALS[this.status()]);
}
