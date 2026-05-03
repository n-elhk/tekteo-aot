import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  PricingGrid,
  PricingGridsService,
} from '../../../core/pricing-grids/pricing-grids.service';
import { AppDialogService } from '../../../core/dialog/app-dialog.service';
import { ToastService } from '../../../core/notifications/toast.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { ExperienceLevelBadge } from '../../../shared/ui/experience-level-badge/experience-level-badge';
import {
  PricingGridEditDialog,
  PricingGridEditDialogData,
} from './pricing-grid-edit-dialog';

/** Liste + CRUD des grilles de TJM. */
@Component({
  selector: 'app-admin-pricing-grids-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, ExperienceLevelBadge, DatePipe],
  templateUrl: './admin-pricing-grids.page.html',
})
export class AdminPricingGridsPage {
  private readonly service = inject(PricingGridsService);
  private readonly dialog = inject(AppDialogService);
  private readonly toaster = inject(ToastService);
  private readonly authStore = inject(AuthStore);

  protected readonly isAdmin = this.authStore.isAdmin;
  protected readonly search = signal('');

  protected readonly resource = rxResource({
    stream: () => this.service.list(),
  });

  protected readonly grids = computed<PricingGrid[]>(() => this.resource.value() ?? []);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);

  protected readonly filtered = computed<PricingGrid[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.grids();
    return this.grids().filter((grid) =>
      `${grid.profileTitle} ${grid.region}`.toLowerCase().includes(q),
    );
  });

  protected onSearch(value: string): void {
    this.search.set(value);
  }

  protected formatPrice(value: PricingGrid['dailyRate']): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(num);
  }

  protected async openCreate(): Promise<void> {
    await this.openDialog(null);
  }

  protected async openEdit(grid: PricingGrid): Promise<void> {
    await this.openDialog(grid);
  }

  protected async deleteGrid(grid: PricingGrid): Promise<void> {
    const ref = this.dialog.open<ConfirmDialog, void, boolean>(ConfirmDialog, {
      data: undefined,
      providers: [
        {
          provide: ConfirmDialog.DATA,
          useValue: {
            title: 'Supprimer cette grille ?',
            description: `« ${grid.profileTitle} » sera définitivement supprimée.`,
            confirmLabel: 'Supprimer',
            variant: 'danger' as const,
          },
        },
      ],
    });
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) return;
    this.service.remove(grid.id).subscribe({
      next: () => {
        this.toaster.success({ title: 'Grille supprimée' });
        this.resource.reload();
      },
      error: () =>
        this.toaster.error({
          title: 'Suppression impossible',
          description: 'Veuillez réessayer dans un instant.',
        }),
    });
  }

  private async openDialog(grid: PricingGrid | null): Promise<void> {
    const ref = this.dialog.open<PricingGridEditDialog, void, PricingGrid | null>(
      PricingGridEditDialog,
      {
        data: undefined,
        providers: [
          {
            provide: PricingGridEditDialog.DATA,
            useValue: { grid } satisfies PricingGridEditDialogData,
          },
        ],
      },
    );
    const saved = await firstValueFrom(ref.closed);
    if (saved) this.resource.reload();
  }
}
