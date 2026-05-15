import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkAccordionItem } from '@angular/cdk/accordion';
import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { filter, firstValueFrom } from 'rxjs';
import { ConsultantDetailsStore } from './consultant-details.store';
import { VariantsList } from './variants-list/variants-list';
import { MasterCvView } from './master-cv-view/master-cv-view';
import {
  CreateVariantDialog,
  type CreateVariantDialogData,
} from '../create-variant-dialog';
import type { CreateCvVariantDto } from '../../../core/cv-variants/cv-variant.model';
import { APP_DIALOG_CONFIG } from '../../../core/dialog/dialog.config';
import { Card } from '../../../shared/ui/card/card';
import { Button } from '../../../shared/ui/button/button';
import { ToastService } from '../../../core/notifications/toast.service';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-consultant-details',
  imports: [
    RouterLink,
    CdkAccordionItem,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    VariantsList,
    MasterCvView,
    Card,
    Button,
  ],
  providers: [ConsultantDetailsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <a
        routerLink="/consultants"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-surface-900/60 hover:text-brand-700 transition"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux consultants
      </a>

      @if (store.loading()) {
        <div class="space-y-3">
          <div class="h-8 w-2/3 animate-pulse rounded-xl bg-surface-100"></div>
          <div class="h-32 animate-pulse rounded-2xl bg-surface-100"></div>
          <div class="h-32 animate-pulse rounded-2xl bg-surface-100"></div>
        </div>
      } @else if (store.error(); as err) {
        <app-card>
          <div class="space-y-2 text-center" role="alert">
            <p class="font-semibold text-surface-900">Consultant introuvable</p>
            <p class="text-sm text-surface-900/60">{{ err }}</p>
          </div>
        </app-card>
      } @else if (store.consultant(); as c) {
        <!-- Hero header -->
        <section class="surface-card rounded-2xl p-6 lg:p-8">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex items-start gap-5">
              <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-semibold text-white shadow-[0_8px_24px_-8px_rgb(59_99_255/0.5)]">
                {{ initials(c.firstName, c.lastName) }}
              </span>
              <div class="space-y-1.5">
                <p class="text-sm font-medium text-brand-700">Fiche consultant</p>
                <h1 class="text-3xl font-semibold tracking-tight text-surface-900">
                  {{ c.firstName }} {{ c.lastName }}
                </h1>
                @if (c.role) {
                  <p class="text-base text-surface-900/70">{{ c.role }}</p>
                }
                <div class="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-surface-900/70">
                    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {{ c.email }}
                  </span>
                  @if (c.phone) {
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-surface-900/70">
                      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h2l2 5-3 2a12 12 0 006 6l2-3 5 2v2a2 2 0 01-2 2A16 16 0 013 5z" />
                      </svg>
                      {{ c.phone }}
                    </span>
                  }
                  @if (c.location) {
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-surface-900/70">
                      <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 11a2 2 0 100-4 2 2 0 000 4z M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" />
                      </svg>
                      {{ c.location }}
                    </span>
                  }
                  @if (c.yearsExperience !== null) {
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">
                      {{ c.yearsExperience }} an{{ c.yearsExperience > 1 ? 's' : '' }} d'expérience
                    </span>
                  }
                </div>
              </div>
            </div>
            <div class="flex shrink-0 items-start gap-2">
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200/70 bg-white text-surface-900/60 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                [cdkMenuTriggerFor]="settingsMenu"
                aria-label="Réglages du consultant"
                title="Réglages"
              >
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.591 1.07 1.724 1.724 0 012.37 2.37 1.724 1.724 0 001.07 2.592 1.724 1.724 0 010 3.35 1.724 1.724 0 00-1.07 2.591 1.724 1.724 0 01-2.37 2.37 1.724 1.724 0 00-2.592 1.07 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.591-1.07 1.724 1.724 0 01-2.37-2.37 1.724 1.724 0 00-1.07-2.592 1.724 1.724 0 010-3.35 1.724 1.724 0 001.07-2.591 1.724 1.724 0 012.37-2.37 1.724 1.724 0 002.591-1.07z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <ng-template #settingsMenu>
          <div
            cdkMenu
            class="min-w-[240px] overflow-hidden rounded-xl border border-surface-200/70 bg-white py-1 shadow-[0_18px_40px_-12px_rgb(15_23_42/0.18)]"
          >
            <button
              type="button"
              cdkMenuItem
              class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-surface-900 transition hover:bg-surface-100 focus:bg-surface-100 focus:outline-none"
              (click)="updateMasterCv()"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4 text-surface-900/60" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.6a2 2 0 112.8 2.8L11 18l-4 1 1-4 9.6-9.6z" />
              </svg>
              Mettre à jour le CV maître
            </button>
            <button
              type="button"
              cdkMenuItem
              class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 focus:bg-red-50 focus:outline-none"
              (click)="confirmDeleteConsultant()"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 7h16" />
              </svg>
              Supprimer le consultant
            </button>
          </div>
        </ng-template>

        <div class="flex flex-col gap-4">
          <!-- CV maître -->
          <div
            cdkAccordionItem
            #master="cdkAccordionItem"
            [expanded]="true"
            class="block overflow-hidden rounded-2xl border border-surface-200/70 bg-white shadow-sm"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-4 p-6 text-left transition hover:bg-surface-50"
              [attr.aria-expanded]="master.expanded"
              [attr.aria-controls]="'master-cv-panel-' + master.id"
              (click)="master.toggle()"
            >
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-brand-700">
                  CV maître
                </p>
                <h2 class="mt-0.5 text-lg font-semibold text-surface-900">
                  Profil de référence
                </h2>
              </div>
              <svg
                viewBox="0 0 24 24"
                class="h-5 w-5 shrink-0 text-surface-900/40 transition-transform duration-200"
                [class.rotate-180]="master.expanded"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            @if (master.expanded) {
              <div
                [id]="'master-cv-panel-' + master.id"
                role="region"
                class="border-t border-surface-100 p-6"
              >
                <app-master-cv-view [cvData]="c.masterCvData" />
              </div>
            }
          </div>

          <!-- Variantes -->
          <div
            cdkAccordionItem
            #variants="cdkAccordionItem"
            [expanded]="false"
            class="block overflow-hidden rounded-2xl border border-surface-200/70 bg-white shadow-sm"
          >
            <div
              role="button"
              tabindex="0"
              class="flex w-full items-center justify-between gap-4 p-6 transition hover:bg-surface-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
              [attr.aria-expanded]="variants.expanded"
              [attr.aria-controls]="'variants-panel-' + variants.id"
              (click)="variants.toggle()"
              (keydown.enter)="variants.toggle()"
              (keydown.space)="$event.preventDefault(); variants.toggle()"
            >
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-brand-700">
                  {{ store.variants().length }} variante{{ store.variants().length > 1 ? 's' : '' }}
                </p>
                <h2 class="mt-0.5 text-lg font-semibold text-surface-900">
                  CV adaptés
                </h2>
              </div>
              <div class="flex items-center gap-3">
                <app-button
                  variant="primary"
                  size="sm"
                  (click)="$event.stopPropagation(); openCreateVariant()"
                >
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nouvelle variante
                </app-button>
                <svg
                  viewBox="0 0 24 24"
                  class="h-5 w-5 shrink-0 text-surface-900/40 transition-transform duration-200"
                  [class.rotate-180]="variants.expanded"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>
            @if (variants.expanded) {
              <div
                [id]="'variants-panel-' + variants.id"
                role="region"
                class="border-t border-surface-100 p-6"
              >
                <app-variants-list
                  [variants]="store.variants()"
                  (regenerate)="store.regenerateVariant($event)"
                  (generatePdf)="store.triggerVariantPdf($event)"
                  (delete)="confirmDeleteVariant($event)"
                />
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ConsultantDetailsPage {
  protected readonly store = inject(ConsultantDetailsStore);
  private readonly dialog = inject(Dialog);
  private readonly toaster = inject(ToastService);

  protected initials(first: string, last: string): string {
    return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
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

  protected confirmDeleteVariant(id: string) {
    const variant = this.store.variants().find((v) => v.id === id);
    if (!variant) return;
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(
      ConfirmDialog,
      {
        ...APP_DIALOG_CONFIG,
        data: {
          title: 'Supprimer cette variante ?',
          description: `« ${variant.name} » et ses fichiers PDF seront définitivement supprimés.`,
          confirmLabel: 'Supprimer',
          variant: 'danger',
        },
      },
    );
    ref.closed.pipe(filter(Boolean)).subscribe(() => {
      this.store.deleteVariant(id);
    });
  }

  protected confirmDeleteConsultant() {
    const consultant = this.store.consultant();
    if (!consultant) return;
    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(
      ConfirmDialog,
      {
        ...APP_DIALOG_CONFIG,
        data: {
          title: 'Supprimer ce consultant ?',
          description: `« ${consultant.firstName} ${consultant.lastName} », ses variantes et tous les PDF associés seront définitivement supprimés.`,
          confirmLabel: 'Supprimer',
          variant: 'danger',
        },
      },
    );
    ref.closed.pipe(filter(Boolean)).subscribe(() => {
      this.store.deleteConsultant();
    });
  }

  protected updateMasterCv() {
    this.toaster.info({
      title: 'Bientôt disponible',
      description: 'La mise à jour du CV maître arrive prochainement.',
    });
  }
}
