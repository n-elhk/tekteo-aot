import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ProjectStatus } from '@org/types';

interface StatusVisual {
  readonly label: string;
  readonly classes: string;
}

const STATUS: Record<ProjectStatus, StatusVisual> = {
  brouillon: { label: 'Brouillon', classes: 'bg-surface-100 text-surface-900/70 ring-surface-200' },
  en_cours: { label: 'En cours', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  finalise: { label: 'Finalisé', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  soumis: { label: 'Soumis', classes: 'bg-brand-50 text-brand-800 ring-brand-200' },
};

/** Pastille colorée représentant le statut d'un projet AO. */
@Component({
  selector: 'app-project-status-badge',
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
export class ProjectStatusBadge {
  readonly status = input.required<ProjectStatus>();
  protected readonly visual = computed(() => STATUS[this.status()]);
}
