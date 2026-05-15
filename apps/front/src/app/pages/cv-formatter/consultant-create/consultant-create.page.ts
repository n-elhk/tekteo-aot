import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CvImportSection } from '../cv-import-section/cv-import-section';
import { ConsultantManualForm } from '../consultant-manual-form/consultant-manual-form';
import { Card } from '../../../shared/ui/card/card';

type Mode = 'pick' | 'import' | 'manual';

@Component({
  selector: 'app-consultant-create',
  imports: [RouterLink, CvImportSection, ConsultantManualForm, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <header class="flex items-center gap-3">
        <a
          routerLink="/cv-formatter"
          class="text-sm text-blue-600 hover:underline"
        >
          ← Consultants
        </a>
        <span class="text-gray-300">·</span>
        <h1 class="text-2xl font-semibold">Ajouter un consultant</h1>
      </header>

      @if (mode() === 'pick') {
        <p class="text-gray-600 text-sm">
          Importez un CV existant pour extraire automatiquement les
          informations, ou créez un consultant manuellement.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            class="text-left bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:shadow-md transition-all group"
            (click)="mode.set('import')"
          >
            <div class="flex items-center gap-3 mb-3">
              <span
                class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:bg-blue-100 transition-colors"
                aria-hidden="true"
              >
                ↑
              </span>
              <h2 class="text-lg font-semibold">Importer un CV</h2>
            </div>
            <p class="text-sm text-gray-600">
              Glissez un fichier PDF ou DOCX. Claude extrait
              automatiquement l'identité, les compétences, les
              expériences, les formations.
            </p>
          </button>

          <button
            type="button"
            class="text-left bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-blue-500 hover:shadow-md transition-all group"
            (click)="mode.set('manual')"
          >
            <div class="flex items-center gap-3 mb-3">
              <span
                class="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xl group-hover:bg-purple-100 transition-colors"
                aria-hidden="true"
              >
                ✎
              </span>
              <h2 class="text-lg font-semibold">Créer manuellement</h2>
            </div>
            <p class="text-sm text-gray-600">
              Saisissez l'identité du consultant et son CV maître via
              un formulaire structuré.
            </p>
          </button>
        </div>
      } @else if (mode() === 'import') {
        <app-card title="Importer un CV">
          <button
            type="button"
            class="text-sm text-blue-600 hover:underline mb-4"
            (click)="mode.set('pick')"
          >
            ← Choisir une autre méthode
          </button>
          <app-cv-import-section (imported)="onDone()" />
        </app-card>
      } @else {
        <app-card title="Création manuelle">
          <button
            type="button"
            class="text-sm text-blue-600 hover:underline mb-4"
            (click)="mode.set('pick')"
          >
            ← Choisir une autre méthode
          </button>
          <app-consultant-manual-form (created)="onDone()" />
        </app-card>
      }
    </div>
  `,
})
export class ConsultantCreatePage {
  private readonly router = inject(Router);
  protected readonly mode = signal<Mode>('pick');

  protected onDone() {
    // Les sous-composants naviguent eux-mêmes vers la fiche détail après création.
    // Fallback : on retourne à la liste si on est toujours sur la page.
    void this.router.navigate(['/cv-formatter']);
  }
}
