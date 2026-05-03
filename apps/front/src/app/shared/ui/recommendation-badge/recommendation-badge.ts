import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AoRecommendation } from '../../../core/ao/ao.model';

interface Visual {
  readonly label: string;
  readonly classes: string;
  readonly icon: string;
}

const VISUALS: Record<AoRecommendation, Visual> = {
  go: {
    label: 'GO',
    classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    icon: '✓',
  },
  caution: {
    label: 'PRUDENCE',
    classes: 'bg-amber-50 text-amber-800 ring-amber-200',
    icon: '!',
  },
  nogo: {
    label: 'NO-GO',
    classes: 'bg-red-50 text-red-800 ring-red-200',
    icon: '✕',
  },
};

/** Pastille compacte pour les recommandations IA d'analyses AO. */
@Component({
  selector: 'app-recommendation-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <span
      class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset"
      [class]="visual().classes"
    >
      <span aria-hidden="true">{{ visual().icon }}</span>
      {{ visual().label }}
    </span>
  `,
})
export class RecommendationBadge {
  readonly recommendation = input.required<AoRecommendation>();
  protected readonly visual = computed(() => VISUALS[this.recommendation()]);
}
