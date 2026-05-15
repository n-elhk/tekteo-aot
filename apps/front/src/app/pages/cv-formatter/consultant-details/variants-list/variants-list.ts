import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { CvVariant } from '../../../../core/cv-variants/cv-variant.model';

@Component({
  selector: 'app-variants-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="text-left border-b">
          <th class="py-2">Nom</th>
          <th>Fiche de poste</th>
          <th>Template</th>
          <th>Dernière modif.</th>
          <th>Statut PDF</th>
          <th class="w-px"></th>
        </tr>
      </thead>
      <tbody>
        @for (v of variants(); track v.id) {
          <tr class="border-b hover:bg-gray-50">
            <td class="py-2">
              <a class="text-blue-600 hover:underline" [routerLink]="['/cv-formatter', 'variants', v.id]">
                {{ v.name }}
              </a>
            </td>
            <td>{{ v.jobProfile.title }}</td>
            <td>{{ v.template }}</td>
            <td>{{ v.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ v.generatedCvs[0]?.status ?? '—' }}</td>
            <td class="whitespace-nowrap">
              <button class="px-2 py-1 text-xs border rounded mr-1" (click)="regenerate.emit(v.id)">Régénérer</button>
              <button class="px-2 py-1 text-xs border rounded mr-1" (click)="generatePdf.emit(v.id)">PDF</button>
              <button class="px-2 py-1 text-xs border rounded text-red-600" (click)="delete.emit(v.id)">Supprimer</button>
            </td>
          </tr>
        }
        @empty {
          <tr><td colspan="6" class="py-6 text-center text-gray-500">Aucune variante. Créez-en une depuis « Nouvelle variante ».</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class VariantsList {
  readonly variants = input.required<CvVariant[]>();
  readonly regenerate = output<string>();
  readonly generatePdf = output<string>();
  readonly delete = output<string>();
}
