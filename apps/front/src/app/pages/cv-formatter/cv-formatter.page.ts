import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { CvImportSection } from './cv-import-section/cv-import-section';
import { ConsultantListSection } from './consultant-list-section/consultant-list-section';
import { ConsultantManualForm } from './consultant-manual-form/consultant-manual-form';

type Tab = 'import' | 'manual';

/**
 * Page d'accueil "Gérer vos consultants" : simple coquille qui orchestre
 * la composition de trois sections autonomes (import, manuel, liste).
 *
 * Aucune logique métier ici — on se contente de :
 * - gérer l'onglet actif (import / manuel)
 * - relayer les événements `imported` / `created` vers la liste
 *   via `viewChild.required` + méthode publique `reload()`.
 */
@Component({
  selector: 'app-cv-formatter-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, CvImportSection, ConsultantManualForm, ConsultantListSection],
  template: `
    <div class="space-y-6">
      <!-- En-tête -->
      <header class="space-y-1">
        <p class="text-sm font-medium text-brand-700">Consultants</p>
        <h1 class="text-3xl font-semibold tracking-tight text-surface-900">
          Gérer vos consultants
        </h1>
        <p class="text-sm text-surface-900/60">
          Importez plusieurs CV ou créez un consultant manuellement, puis
          générez des CV PDF à partir de vos templates.
        </p>
      </header>

      <!-- Bloc création (tabs) -->
      @if (canEdit()) {
        <app-card title="Ajouter un consultant">
          <div class="flex border-b border-surface-200 -mt-2 mb-4">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium transition"
              [class]="
                tab() === 'import'
                  ? 'border-b-2 border-brand-700 text-brand-700'
                  : 'text-surface-900/60 hover:text-surface-900'
              "
              (click)="setTab('import')"
            >
              Importer un document
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium transition"
              [class]="
                tab() === 'manual'
                  ? 'border-b-2 border-brand-700 text-brand-700'
                  : 'text-surface-900/60 hover:text-surface-900'
              "
              (click)="setTab('manual')"
            >
              Créer manuellement
            </button>
          </div>

          @if (tab() === 'import') {
            <app-cv-import-section (imported)="onImportFinished()" />
          } @else {
            <app-consultant-manual-form (created)="onManualCreated()" />
          }
        </app-card>
      }

      <!-- Liste paginée -->
      <app-card title="Consultants enregistrés">
        <app-consultant-list-section [canEdit]="canEdit()" />
      </app-card>
    </div>
  `,
})
export class CvFormatterPage {
  private readonly authStore = inject(AuthStore);
  private readonly listSection = viewChild.required(ConsultantListSection);

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly tab = signal<Tab>('import');

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  protected onImportFinished(): void {
    this.listSection().reload();
  }

  protected onManualCreated(): void {
    this.listSection().reload();
  }
}
