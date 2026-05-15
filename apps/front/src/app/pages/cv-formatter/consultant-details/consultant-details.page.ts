import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ConsultantDetailsStore } from './consultant-details.store';
import { VariantsList } from './variants-list/variants-list';
import {
  CreateVariantDialog,
  type CreateVariantDialogData,
} from '../create-variant-dialog';
import type { CreateCvVariantDto } from '../../../core/cv-variants/cv-variant.model';
import { APP_DIALOG_CONFIG } from '../../../core/dialog/dialog.config';

@Component({
  selector: 'app-consultant-details',
  imports: [RouterLink, VariantsList],
  providers: [ConsultantDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 flex flex-col gap-6">
      <a
        routerLink="/cv-formatter"
        class="text-sm text-blue-600 hover:underline"
        >← Retour à la liste</a
      >

      @if (store.loading()) {
        <p>Chargement…</p>
      } @else if (store.error(); as err) {
        <p class="text-red-600">{{ err }}</p>
      } @else if (store.consultant(); as c) {
        <header class="flex justify-between items-start">
          <div>
            <h1 class="text-2xl font-semibold">
              {{ c.firstName }} {{ c.lastName }}
            </h1>
            <p class="text-gray-600">{{ c.role ?? 'Rôle non renseigné' }}</p>
            <p class="text-sm text-gray-500">
              {{ c.email }}{{ c.phone ? ' · ' + c.phone : '' }}
            </p>
          </div>
          <button
            class="px-3 py-2 rounded bg-blue-600 text-white"
            (click)="openCreateVariant()"
          >
            Nouvelle variante
          </button>
        </header>

        <section>
          <h2 class="text-lg font-medium mb-2">Variantes</h2>
          <app-variants-list
            [variants]="store.variants()"
            (regenerate)="store.regenerateVariant($event)"
            (generatePdf)="store.triggerVariantPdf($event)"
            (delete)="onDelete($event)"
          />
        </section>
      }
    </div>
  `,
})
export class ConsultantDetailsPage {
  readonly id = input.required<string>();
  protected readonly store = inject(ConsultantDetailsStore);
  private readonly dialog = inject(Dialog);

  constructor() {
    this.store.load(this.id);
  }

  protected async openCreateVariant() {
    const consultant = this.store.consultant();
    if (!consultant) return;
    const ref = this.dialog.open<
      CreateCvVariantDto | undefined,
      CreateVariantDialogData
    >(CreateVariantDialog, {
      ...APP_DIALOG_CONFIG,
      data: {
        consultantId: consultant.id,
        consultantLabel: `${consultant.firstName} ${consultant.lastName}`,
      },
    });
    const result = await firstValueFrom(ref.closed);
    if (result) {
      this.store.createVariant(result);
    }
  }

  protected onDelete(id: string) {
    if (!confirm('Supprimer cette variante ?')) return;
    this.store.deleteVariant(id);
  }
}
