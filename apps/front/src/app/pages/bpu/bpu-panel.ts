import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { filter, finalize, switchMap, tap } from 'rxjs';
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

/**
 * Panneau d'édition des lignes BPU/DPGF d'un projet.
 *
 * Deux onglets (BPU et DPGF) avec édition inline et auto-totaux.
 */
@Component({
  selector: 'app-bpu-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Button],
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
  protected readonly busyId = signal<string | null>(null);

  protected readonly resource = rxResource({
    params: () => this.projectId(),
    stream: ({ params }) => this.bpuService.listByProject(params),
  });

  protected readonly allLines = computed<BpuLine[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly visibleLines = computed<BpuLine[]>(() => {
    const type = this.activeType();
    return this.allLines()
      .filter((line) => line.lineType === type)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  });

  protected readonly total = computed(() =>
    this.visibleLines().reduce((sum, line) => sum + lineTotal(line), 0),
  );

  protected switchType(type: BpuLineType): void {
    this.activeType.set(type);
  }

  protected addLine(): void {
    const projectId = this.projectId();
    const orderIndex = this.visibleLines().length;
    this.bpuService
      .create(projectId, {
        lineType: this.activeType(),
        orderIndex,
        profileTitle: '',
        experienceLevel: 'confirme',
        unit: 'jour',
        quantity: 0,
        unitPrice: 0,
      })
      .subscribe({
        next: () => this.resource.reload(),
        error: () =>
          this.toaster.error({
            title: 'Création impossible',
            description: 'Veuillez réessayer.',
          }),
      });
  }

  protected updateField<K extends keyof BpuLine>(line: BpuLine, field: K, value: BpuLine[K]): void {
    if (this.busyId() === line.id) return;
    this.busyId.set(line.id);
    this.bpuService
      .update(line.id, { [field]: value } as Record<string, unknown> as never)
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.resource.reload();
        },
        error: () => {
          this.busyId.set(null);
          this.toaster.error({
            title: 'Mise à jour impossible',
            description: 'Veuillez réessayer.',
          });
        },
      });
  }

  protected onTextField(line: BpuLine, field: 'profileTitle' | 'phase', value: string): void {
    this.updateField(line, field, value as never);
  }

  protected onUnitChange(line: BpuLine, value: string): void {
    this.updateField(line, 'unit', value as BpuUnit);
  }

  protected onNumberField(
    line: BpuLine,
    field: 'quantity' | 'unitPrice',
    value: string,
  ): void {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    this.updateField(line, field, num as never);
  }

  protected deleteLine(line: BpuLine): void {
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      ...APP_DIALOG_CONFIG,
      data: {
        title: 'Supprimer cette ligne ?',
        description: line.profileTitle
          ? `« ${line.profileTitle} » sera supprimée.`
          : 'Cette ligne sera supprimée.',
        confirmLabel: 'Supprimer',
        variant: 'danger',
      },
    });

    ref.closed
      .pipe(
        filter(Boolean),
        tap(() => this.busyId.set(line.id)),
        switchMap(() => this.bpuService.remove(line.id)),
        tap(() => {
          this.toaster.success({ title: 'Ligne supprimée' });
          this.resource.reload();
        }),
        finalize(() => this.busyId.set(null)),
      )
      .subscribe({
        error: () =>
          this.toaster.error({
            title: 'Suppression impossible',
            description: 'Veuillez réessayer.',
          }),
      });
  }

  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected lineTotalFormatted(line: BpuLine): string {
    return this.formatPrice(lineTotal(line));
  }
}

function lineTotal(line: BpuLine): number {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}
