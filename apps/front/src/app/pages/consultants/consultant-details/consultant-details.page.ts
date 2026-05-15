import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
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
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../../shared/ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-consultant-details',
  imports: [RouterLink, VariantsList, MasterCvView, Card, Button],
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
            <div class="flex shrink-0 gap-2">
              <app-button variant="primary" (click)="openCreateVariant()">
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nouvelle variante
              </app-button>
            </div>
          </div>
        </section>

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <!-- CV maître -->
          <section class="rounded-2xl border border-surface-200/70 bg-white p-6 shadow-sm">
            <header class="mb-5 flex items-center justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-brand-700">CV maître</p>
                <h2 class="mt-0.5 text-lg font-semibold text-surface-900">Profil de référence</h2>
              </div>
            </header>
            <app-master-cv-view [cvData]="c.masterCvData" />
          </section>

          <!-- Variantes -->
          <section class="rounded-2xl border border-surface-200/70 bg-white p-6 shadow-sm">
            <header class="mb-5 flex items-center justify-between">
              <div>
                <p class="text-xs font-medium uppercase tracking-wider text-brand-700">
                  {{ store.variants().length }} variante{{ store.variants().length > 1 ? 's' : '' }}
                </p>
                <h2 class="mt-0.5 text-lg font-semibold text-surface-900">CV adaptés</h2>
              </div>
            </header>
            <app-variants-list
              [variants]="store.variants()"
              (regenerate)="store.regenerateVariant($event)"
              (generatePdf)="store.triggerVariantPdf($event)"
              (delete)="confirmDeleteVariant($event)"
            />
          </section>
        </div>
      }
    </div>
  `,
})
export class ConsultantDetailsPage {
  protected readonly store = inject(ConsultantDetailsStore);
  private readonly dialog = inject(Dialog);

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
}
