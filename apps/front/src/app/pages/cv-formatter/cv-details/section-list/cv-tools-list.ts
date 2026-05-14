import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Liste plate d'outils / technologies sous forme de badges.
 */
@Component({
  selector: 'app-cv-tools-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-2">
      @for (tool of tools(); track tool) {
        <span
          class="inline-flex items-center rounded-full bg-surface-100 px-3 py-1 text-sm font-medium text-surface-900/80 ring-1 ring-surface-200/70 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-100"
        >
          {{ tool }}
        </span>
      }
    </div>
  `,
})
export class CvToolsList {
  readonly tools = input.required<ReadonlyArray<string>>();
}
