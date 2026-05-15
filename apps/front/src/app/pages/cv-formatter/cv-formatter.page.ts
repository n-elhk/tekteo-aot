import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ConsultantsStore } from './consultants.store';

@Component({
  selector: 'app-cv-formatter',
  imports: [RouterLink, DatePipe],
  providers: [ConsultantsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-6">
      <header class="flex justify-between items-center">
        <h1 class="text-2xl font-semibold">Consultants</h1>
        <!-- Bouton "Importer un CV" laissé au cv-import-section existant (à recâbler en Task 4.9) -->
      </header>

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

  ngOnInit() {
    void this.store.loadPage(1);
  }
}
