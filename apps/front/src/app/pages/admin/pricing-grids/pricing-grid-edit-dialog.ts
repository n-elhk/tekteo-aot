import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  min,
  minLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { ExperienceLevelValue } from '@org/schemas';
import {
  PricingGrid,
  PricingGridsService,
} from '../../../core/pricing-grids/pricing-grids.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { ModalShell } from '../../../shared/ui/modal-shell/modal-shell';
import { Button } from '../../../shared/ui/button/button';

interface Model {
  profileTitle: string;
  experienceLevel: ExperienceLevelValue;
  dailyRate: number;
  region: string;
  validFrom: string;
  validTo: string;
}

export interface PricingGridEditDialogData {
  readonly grid: PricingGrid | null;
}

const LEVELS: ReadonlyArray<{ value: ExperienceLevelValue; label: string }> = [
  { value: 'junior', label: 'Junior' },
  { value: 'confirme', label: 'Confirmé' },
  { value: 'senior', label: 'Senior' },
  { value: 'expert', label: 'Expert' },
];

/** Dialogue de création / édition d'une grille de TJM. */
@Component({
  selector: 'app-pricing-grid-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalShell, Button, FormRoot, FormField],
  template: `
    <app-modal-shell
      [title]="data.grid ? 'Modifier la grille' : 'Nouvelle grille de TJM'"
      [subtitle]="data.grid?.profileTitle ?? null"
    >
      <form [formRoot]="gridForm" (submit)="onSubmit()" novalidate class="space-y-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Profil *</span>
          <input
            type="text"
            [formField]="gridForm.profileTitle"
            class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="Ex. Développeur Backend Java"
          />
          @if (gridForm.profileTitle().touched() && gridForm.profileTitle().errors().length > 0) {
            <span class="text-xs font-medium text-red-600">
              {{ gridForm.profileTitle().errors()[0].message }}
            </span>
          }
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Niveau *</span>
            <select
              [formField]="gridForm.experienceLevel"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            >
              @for (level of levels; track level.value) {
                <option [value]="level.value">{{ level.label }}</option>
              }
            </select>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">TJM (€) *</span>
            <input
              type="number"
              inputmode="decimal"
              [formField]="gridForm.dailyRate"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
              placeholder="650"
            />
            @if (gridForm.dailyRate().touched() && gridForm.dailyRate().errors().length > 0) {
              <span class="text-xs font-medium text-red-600">
                {{ gridForm.dailyRate().errors()[0].message }}
              </span>
            }
          </label>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-medium text-surface-900">Région</span>
          <input
            type="text"
            [formField]="gridForm.region"
            class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            placeholder="Ex. Île-de-France"
          />
        </label>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Valide du</span>
            <input
              type="date"
              [formField]="gridForm.validFrom"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-surface-900">Valide jusqu'au</span>
            <input
              type="date"
              [formField]="gridForm.validTo"
              class="block w-full rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none transition"
            />
            @if (gridForm.validTo().touched() && gridForm.validTo().errors().length > 0) {
              <span class="text-xs font-medium text-red-600">
                {{ gridForm.validTo().errors()[0].message }}
              </span>
            }
          </label>
        </div>
      </form>

      <div modalFooter class="flex justify-end gap-2">
        <app-button variant="ghost" (click)="cancel()">Annuler</app-button>
        <app-button
          variant="primary"
          [disabled]="!canSubmit()"
          [loading]="gridForm().submitting()"
          (click)="onSubmit()"
        >
          {{ data.grid ? 'Enregistrer' : 'Créer la grille' }}
        </app-button>
      </div>
    </app-modal-shell>
  `,
})
export class PricingGridEditDialog {
  protected readonly data = inject<PricingGridEditDialogData>(DIALOG_DATA);
  private readonly dialogRef = inject(
    DialogRef<PricingGrid | null, PricingGridEditDialog>,
  );
  private readonly service = inject(PricingGridsService);
  private readonly toaster = inject(ToastService);

  protected readonly levels = LEVELS;
  protected readonly model = signal<Model>(buildInitial(this.data));

  protected readonly gridForm = form(
    this.model,
    (path) => {
      required(path.profileTitle, { message: 'Le profil est requis' });
      minLength(path.profileTitle, 2, { message: 'Au moins 2 caractères' });
      maxLength(path.profileTitle, 200, { message: 'Au maximum 200 caractères' });
      validate(path.profileTitle, ({ value }) =>
        value().length > 0 && value().trim().length === 0
          ? { kind: 'blank', message: 'Ne peut contenir que des espaces' }
          : undefined,
      );
      min(path.dailyRate, 1, { message: 'Le TJM doit être positif' });
      maxLength(path.region, 120, { message: 'Au maximum 120 caractères' });
      validate(path.validTo, ({ value, valueOf }) => {
        const to = value();
        const from = valueOf(path.validFrom);
        return to && from && to < from
          ? {
              kind: 'dateRange',
              message: 'La date de fin doit être postérieure à la date de début',
            }
          : undefined;
      });
    },
    {
      submission: {
        action: async () => {
          const m = this.model();
          const dto = {
            profileTitle: m.profileTitle.trim(),
            experienceLevel: m.experienceLevel,
            dailyRate: m.dailyRate,
            ...(m.region.trim() ? { region: m.region.trim() } : {}),
            ...(m.validFrom ? { validFrom: m.validFrom } : {}),
            ...(m.validTo ? { validTo: m.validTo } : {}),
          };
          try {
            const saved = await firstValueFrom(
              this.data.grid
                ? this.service.update(this.data.grid.id, dto)
                : this.service.create(dto),
            );
            this.toaster.success({
              title: this.data.grid ? 'Grille mise à jour' : 'Grille créée',
            });
            this.dialogRef.close(saved);
            return undefined;
          } catch {
            this.toaster.error({
              title: 'Action impossible',
              description: 'Veuillez réessayer dans un instant.',
            });
            return undefined;
          }
        },
        onInvalid: (field) => {
          field().markAsTouched();
        },
      },
    },
  );

  protected readonly canSubmit = computed(
    () => this.gridForm().valid() && !this.gridForm().submitting(),
  );

  protected onSubmit(): void {
    void submit(this.gridForm);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}

function buildInitial(data: PricingGridEditDialogData): Model {
  if (data.grid) {
    return {
      profileTitle: data.grid.profileTitle,
      experienceLevel: data.grid.experienceLevel,
      dailyRate: Number(data.grid.dailyRate) || 0,
      region: data.grid.region,
      validFrom: data.grid.validFrom?.slice(0, 10) ?? '',
      validTo: data.grid.validTo?.slice(0, 10) ?? '',
    };
  }
  return {
    profileTitle: '',
    experienceLevel: 'confirme',
    dailyRate: 0,
    region: 'Île-de-France',
    validFrom: '',
    validTo: '',
  };
}
