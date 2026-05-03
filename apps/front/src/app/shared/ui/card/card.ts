import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Carte translucide réutilisable, utilisée comme conteneur pour
 * afficher des regroupements d'information (statistiques, listes…).
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block surface-card rounded-2xl p-5',
  },
  template: `
    @if (title(); as t) {
      <header class="flex items-center justify-between gap-3 mb-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-surface-900/60">{{ t }}</h3>
        <ng-content select="[cardAction]" />
      </header>
    }
    <div class="text-surface-900">
      <ng-content />
    </div>
  `,
})
export class Card {
  readonly title = input<string | null>(null);
}
