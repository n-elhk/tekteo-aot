import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  applyEach,
  disabled,
  FormField,
  FormRoot,
  form,
  min,
  submit,
  required,
} from '@angular/forms/signals';
import { filter, firstValueFrom } from 'rxjs';
import {
  BpuLine,
  BpuLineType,
  BpuService,
  BpuUnit,
} from '../../core/bpu/bpu.service';
import { ToastService } from '../../core/notifications/toast.service';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog/confirm-dialog';

const UNITS: ReadonlyArray<{ value: BpuUnit; label: string }> = [
  { value: 'jour', label: 'Jour' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'mois', label: 'Mois' },
];

const LINE_TYPES: ReadonlyArray<{ value: BpuLineType; label: string }> = [
  { value: 'bpu', label: 'BPU' },
  { value: 'dpgf', label: 'DPGF' },
];

interface BpuLineFormModel {
  profileTitle: string;
  experienceLevel: string;
  unit: BpuUnit;
  quantity: number;
  unitPrice: number;
  tva: number;
  phase: string;
  lineType: BpuLineType;
  orderIndex: number;
}

function toFormModel(line: BpuLine): BpuLineFormModel {
  return {
    profileTitle: line.profileTitle ?? '',
    experienceLevel: line.experienceLevel ?? 'confirme',
    unit: (line.unit as BpuUnit) ?? 'jour',
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unitPrice) || 0,
    tva: Number(line.tva) || 20,
    phase: line.phase ?? '',
    lineType: line.lineType,
    orderIndex: line.orderIndex,
  };
}

function emptyLine(
  lineType: BpuLineType,
  orderIndex: number,
): BpuLineFormModel {
  return {
    profileTitle: '',
    experienceLevel: 'confirme',
    unit: 'jour',
    quantity: 0,
    unitPrice: 0,
    tva: 20,
    phase: '',
    lineType,
    orderIndex,
  };
}

/**
 * Panneau d'édition des lignes BPU/DPGF d'un projet.
 *
 * Deux onglets (BPU et DPGF) avec édition via Signal Forms.
 * Les modifications sont enregistrées en bulk via le bouton Enregistrer.
 */
@Component({
  selector: 'app-bpu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Button, FormRoot, FormField],
  templateUrl: './bpu-panel.html',
})
export class BpuPanel {
  private readonly bpuService = inject(BpuService);
  private readonly toaster = inject(ToastService);
  private readonly dialog = inject(Dialog);
  private readonly authStore = inject(AuthStore);

  readonly projectId = input.required<string>();

  protected readonly canEdit = this.authStore.canEdit;
  protected readonly units = UNITS;
  protected readonly lineTypes = LINE_TYPES;
  protected readonly activeType = signal<BpuLineType>('bpu');

  protected readonly resource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.bpuService.listByProject(params),
    defaultValue: [],
  });

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(
    () => this.resource.error() !== undefined,
  );

  protected readonly model = linkedSignal({
    source: () => this.resource.value(),
    computation: (lines) => ({ lines: lines.map(toFormModel) }),
  });

  protected readonly bpuForm = form(
    this.model,
    (path) => {
      disabled(path, () => !this.canEdit());
      applyEach(path.lines, (line) => {
        required(line.profileTitle);
        min(line.quantity, 0, { message: 'Quantité invalide' });
        min(line.unitPrice, 0, { message: 'Prix unitaire HT invalide' });
        min(line.tva, 0, { message: 'TVA invalide' });
      });
    },
    {
      submission: {
        action: async () => {
          const lineType = this.activeType();
          const lines: BpuLineFormModel[] = this.model()
            .lines.filter((l) => l.lineType === lineType)
            .map((l, idx) => ({ ...l, orderIndex: idx }));

          const dto = {
            lineType,
            replace: true as const,
            lines: lines.map((l) => ({
              profileTitle: l.profileTitle,
              experienceLevel: l.experienceLevel,
              unit: l.unit,
              quantity: Number(l.quantity) || 0,
              unitPrice: Number(l.unitPrice) || 0,
              tva: Number(l.tva) || 20,
              lineType: l.lineType,
              phase: l.phase ? l.phase : undefined,
              orderIndex: l.orderIndex,
            })),
          };

          try {
            await firstValueFrom(
              this.bpuService.bulkUpsert(this.projectId(), dto),
            );
            this.toaster.success({ title: 'Lignes enregistrées' });
            this.resource.reload();
            return undefined;
          } catch {
            this.toaster.error({
              title: 'Enregistrement impossible',
              description: 'Veuillez réessayer.',
            });
            return undefined;
          }
        },
      },
    },
  );

  protected readonly visibleCount = computed(
    () =>
      this.model().lines.filter((l) => l.lineType === this.activeType()).length,
  );

  protected readonly total = computed(() =>
    this.model()
      .lines.filter((l) => l.lineType === this.activeType())
      .reduce((sum, line) => sum + lineTotal(line), 0),
  );

  protected switchType(type: BpuLineType): void {
    this.activeType.set(type);
  }

  protected addLine(): void {
    const type = this.activeType();
    const orderIndex = this.model().lines.filter(
      (l) => l.lineType === type,
    ).length;
    this.model.update((m) => ({
      lines: [...m.lines, emptyLine(type, orderIndex)],
    }));
  }

  protected deleteLine(index: number): void {
    const line = this.model().lines[index];
    if (!line) return;

    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(
      ConfirmDialog,
      {
        ...APP_DIALOG_CONFIG,
        data: {
          title: 'Supprimer cette ligne ?',
          description: line.profileTitle
            ? `« ${line.profileTitle} » sera supprimée.`
            : 'Cette ligne sera supprimée.',
          confirmLabel: 'Supprimer',
          variant: 'danger',
        },
      },
    );

    ref.closed.pipe(filter(Boolean)).subscribe(() => {
      this.model.update((m) => ({
        lines: m.lines.filter((_, idx) => idx !== index),
      }));
    });
  }

  protected onSubmit(): void {
    void submit(this.bpuForm);
  }

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected lineTotalFormatted(line: BpuLineFormModel): string {
    return this.formatPrice(lineTotal(line));
  }
}

function lineTotal(line: {
  quantity: number | string;
  unitPrice: number | string;
}): number {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}
