import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Card } from '../../../shared/ui/card/card';
import { AoCard } from '../../../shared/ui/ao-card/ao-card';
import type { AoItem } from '../../../core/ao/ao.model';
import type { AoListItem } from '../ao-list-item.model';

/**
 * Liste présentationnelle des AO favoris.
 *
 * Affiche un état vide ou la grille des cartes. Les actions sont remontées
 * au parent via des outputs — aucun appel HTTP ni accès à un service.
 */
@Component({
  selector: 'app-ao-veille-favorites-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, AoCard],
  template: `
    @if (items().length === 0) {
      <app-card>
        <p class="text-sm text-surface-900/70 text-center py-8">
          Aucun favori pour l'instant. Cliquez sur l'étoile d'un AO pour le
          retrouver ici.
        </p>
      </app-card>
    } @else {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        @for (item of items(); track item.ao.id) {
          <app-ao-card
            [ao]="item.ao"
            [isFavorite]="item.isFavorite"
            [favoriteBusy]="false"
            [isImported]="item.isImported"
            [projectId]="item.projectId"
            [isNew]="item.isNew"
            [cctpBusy]="item.cctpBusy"
            (favoriteToggled)="favoriteToggled.emit($event)"
            (analyseRequested)="analyseRequested.emit($event)"
            (createProjectRequested)="createProjectRequested.emit($event)"
            (cctpFileSelected)="cctpFileSelected.emit($event)"
          />
        }
      </div>
    }
  `,
})
export class AoVeilleFavoritesList {
  readonly items = input.required<ReadonlyArray<AoListItem>>();

  readonly favoriteToggled = output<AoItem>();
  readonly analyseRequested = output<AoItem>();
  readonly createProjectRequested = output<AoItem>();
  readonly cctpFileSelected = output<{ ao: AoItem; file: File }>();
}
