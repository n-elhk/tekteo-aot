import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ConsultantsStore } from './consultants.store';
import { CvImportSection } from './cv-import-section/cv-import-section';
import { ConsultantManualForm } from './consultant-manual-form/consultant-manual-form';
import { Button } from '../../shared/ui/button/button';

type Panel = 'none' | 'import' | 'manual';

@Component({
  selector: 'app-cv-formatter',
  imports: [
    RouterLink,
    DatePipe,
    CvImportSection,
    ConsultantManualForm,
    Button,
  ],
  providers: [ConsultantsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-6">
      <header class="flex justify-between items-center">
        <h1 class="text-2xl font-semibold">Consultants</h1>
        <div class="flex gap-2">
          <app-button
            variant="secondary"
            (click)="togglePanel('import')"
          >
            Importer un CV
          </app-button>
          <app-button
            variant="secondary"
            (click)="togglePanel('manual')"
          >
            Créer manuellement
          </app-button>
        </div>
      </header>

      @if (panel() === 'import') {
        <section
          class="border rounded p-4 bg-white"
          aria-label="Import de CV"
        >
          <app-cv-import-section (imported)="onImported()" />
        </section>
      }

      @if (panel() === 'manual') {
        <section
          class="border rounded p-4 bg-white"
          aria-label="Création manuelle d'un consultant"
        >
          <app-consultant-manual-form (created)="onCreated()" />
        </section>
      }

      @if (store.loading()) {
        <p>Chargement…</p>
      } @else {
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2">Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Variantes</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            @for (c of store.items(); track c.id) {
              <tr class="border-b hover:bg-gray-50">
                <td class="py-2">
                  <a
                    class="text-blue-600 hover:underline"
                    [routerLink]="['/cv-formatter', 'consultants', c.id]"
                  >
                    {{ c.firstName }} {{ c.lastName }}
                  </a>
                </td>
                <td>{{ c.email }}</td>
                <td>{{ c.role ?? '—' }}</td>
                <td>{{ c._count.variants }}</td>
                <td>{{ c.createdAt | date: 'dd/MM/yyyy' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="py-6 text-center text-gray-500">
                  Aucun consultant. Importez un CV pour commencer.
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class CvFormatterPage implements OnInit {
  protected readonly store = inject(ConsultantsStore);
  protected readonly panel = signal<Panel>('none');

  ngOnInit() {
    void this.store.loadPage(1);
  }

  protected togglePanel(target: Exclude<Panel, 'none'>): void {
    this.panel.update((current) => (current === target ? 'none' : target));
  }

  protected onImported(): void {
    void this.store.loadPage(this.store.page());
  }

  protected onCreated(): void {
    // Le composant manual-form navigue vers la fiche détail après création,
    // donc pas besoin de recharger la liste ici. On ferme tout de même le panneau.
    this.panel.set('none');
  }
}
