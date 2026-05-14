import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import type { AoItem } from '../../../core/ao/ao.model';

interface DeadlineBadge {
  readonly label: string;
  readonly classes: string;
}

const BADGE_BASE = 'text-xs px-2 py-0.5 rounded-full font-medium';

/**
 * Carte présentationnelle d'un appel d'offres BOAMP.
 *
 * Émet des événements vers le parent — aucun appel HTTP ni mutation interne.
 * Le parent décide de l'effet (analyse, création de projet, favori, import CCTP…).
 */
@Component({
  selector: 'app-ao-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [RouterLink, CdkMenuTrigger, CdkMenu, CdkMenuItem, DatePipe],
  template: `
    <article
      class="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-16px_rgb(59_99_255/0.25)]"
      [class.border-emerald-200]="isImported()"
      [class.border-surface-200/70]="!isImported()"
      [class.hover:border-brand-300]="!isImported()"
    >
      <div>
        <!-- Header : badges + actions -->
        <div class="mb-2 flex items-start justify-between gap-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700">
              {{ ao().source || 'BOAMP' }}
            </span>
            @if (isNew()) {
              <span class="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500 text-white">
                Nouveau
              </span>
            }
            @if (isImported()) {
              <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Déjà importé
              </span>
            }
            @if (deadlineBadge(); as badge) {
              <span [class]="badge.classes">{{ badge.label }}</span>
            }
            @if (ao().category; as category) {
              <span class="text-xs text-surface-900/50 truncate max-w-[12rem]">
                {{ category }}
              </span>
            }
          </div>

          <!-- Actions : favori + menu -->
          <div class="flex items-center gap-1 shrink-0">
          <!-- Favori -->
          <button
            type="button"
            class="rounded-full p-1.5 transition"
            [class]="
              isFavorite()
                ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                : 'bg-surface-100 text-surface-900/40 hover:bg-amber-50 hover:text-amber-500'
            "
            [attr.aria-label]="isFavorite() ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            [attr.aria-pressed]="isFavorite()"
            [disabled]="favoriteBusy()"
            (click)="favoriteToggled.emit(ao())"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" [attr.fill]="isFavorite() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.5L13.85 8.3l5.3.77-3.83 3.74.9 5.27L11.48 15.6 6.74 18.08l.9-5.27L3.81 9.07l5.3-.77z" />
            </svg>
          </button>

          <!-- Déclencheur du menu actions -->
          <button
            type="button"
            class="rounded-full p-1.5 bg-surface-100 text-surface-900/40 hover:bg-surface-200 hover:text-surface-900/70 transition"
            aria-label="Actions"
            [cdkMenuTriggerFor]="actionsMenu"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          </div>
        </div>

        <!-- Titre -->
        <h3 class="text-sm font-semibold text-surface-900 leading-snug line-clamp-3">
          {{ ao().title }}
        </h3>

        <!-- Méta -->
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-900/60">
          @if (ao().buyer; as buyer) {
            <span class="inline-flex items-center gap-1 truncate max-w-full">
              <svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
              </svg>
              <span class="truncate">{{ buyer }}</span>
            </span>
          }
          @if (ao().department; as department) {
            <span class="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Dép. {{ department }}
            </span>
          }
          @if (ao().publishedAt) {
            <span class="inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Publié le {{ ao().publishedAt | date: 'dd MMM y' }}
            </span>
          }
          @if (ao().deadline) {
            <span class="inline-flex items-center gap-1 font-medium" [class.text-red-600]="isUrgent()" [class.text-surface-900/80]="!isUrgent()">
              <svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2" />
              </svg>
              Limite : {{ ao().deadline | date: 'dd MMM y' }}
            </span>
          }
        </div>
      </div>
    </article>

    <!-- Menu CDK -->
    <ng-template #actionsMenu>
      <div
        cdkMenu
        class="z-50 w-52 rounded-xl border border-surface-200 bg-white py-1 shadow-lg shadow-surface-900/10 outline-none"
      >
        <!-- Créer un projet -->
        @if (isImported()) {
          @if (projectId()) {
            <a
              cdkMenuItem
              [routerLink]="['/projects', projectId()]"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Voir le projet
            </a>
          } @else {
            <div class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-green-600">
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Projet créé
            </div>
          }
        } @else {
          <button
            cdkMenuItem
            type="button"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50 transition"
            (click)="createProjectRequested.emit(ao())"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM12 11v6M9 14h6" />
            </svg>
            Créer un projet
          </button>
        }

        <div class="my-1 border-t border-surface-100"></div>

        <!-- Analyser IA -->
        <button
          cdkMenuItem
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-purple-700 hover:bg-purple-50 transition"
          (click)="analyseRequested.emit(ao())"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" transform="translate(7 0)" />
          </svg>
          Analyser IA
        </button>

        <!-- DCE / annonce -->
        @if (ao().dceUrl; as dceUrl) {
          <a
            cdkMenuItem
            [href]="dceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-green-700 hover:bg-green-50 transition"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 3h7v7M10 14L21 3M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h6" />
            </svg>
            Accéder au DCE
          </a>
        } @else if (ao().url; as url) {
          <a
            cdkMenuItem
            [href]="url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-surface-900/70 hover:bg-surface-50 transition"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 3h7v7M10 14L21 3M21 14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h6" />
            </svg>
            Voir l'annonce
          </a>
        }

        <div class="my-1 border-t border-surface-100"></div>

        <!-- Importer CCTP -->
        <button
          cdkMenuItem
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          [disabled]="cctpBusy()"
          (click)="triggerCctpInput()"
        >
          @if (cctpBusy()) {
            <span class="h-4 w-4 shrink-0 rounded-full border-2 border-blue-500 border-r-transparent animate-spin" aria-hidden="true"></span>
            Extraction…
          } @else {
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Importer CCTP
          }
        </button>
      </div>
    </ng-template>

    <input
      #cctpInput
      type="file"
      accept=".pdf,.docx"
      class="hidden"
      (change)="onCctpFileChange($event)"
    />
  `,
})
export class AoCard {
  readonly ao = input.required<AoItem>();
  readonly isFavorite = input<boolean>(false);
  readonly favoriteBusy = input<boolean>(false);
  readonly isImported = input<boolean>(false);
  readonly projectId = input<string | null>(null);
  readonly isNew = input<boolean>(false);
  readonly cctpBusy = input<boolean>(false);

  readonly favoriteToggled = output<AoItem>();
  readonly analyseRequested = output<AoItem>();
  readonly createProjectRequested = output<AoItem>();
  readonly cctpFileSelected = output<{ ao: AoItem; file: File }>();

  private readonly cctpInputRef =
    viewChild<ElementRef<HTMLInputElement>>('cctpInput');

  protected readonly daysLeft = computed<number | null>(() => {
    const deadline = this.ao().deadline;
    if (!deadline) return null;
    const target = new Date(deadline);
    if (Number.isNaN(target.getTime())) return null;
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  });

  protected readonly isUrgent = computed(() => {
    const days = this.daysLeft();
    return days !== null && days >= 0 && days <= 7;
  });

  protected readonly deadlineBadge = computed<DeadlineBadge | null>(() => {
    const days = this.daysLeft();
    if (days === null) return null;
    if (days < 0) {
      return { label: 'Passée', classes: `${BADGE_BASE} bg-gray-100 text-gray-500` };
    }
    if (days === 0) {
      return { label: "Aujourd'hui !", classes: `${BADGE_BASE} bg-red-100 text-red-700` };
    }
    if (days <= 7) {
      return { label: `J-${days}`, classes: `${BADGE_BASE} bg-red-100 text-red-700` };
    }
    if (days <= 21) {
      return { label: `J-${days}`, classes: `${BADGE_BASE} bg-orange-100 text-orange-700` };
    }
    return { label: `J-${days}`, classes: `${BADGE_BASE} bg-green-100 text-green-700` };
  });

  protected triggerCctpInput(): void {
    if (this.cctpBusy()) return;
    this.cctpInputRef()?.nativeElement.click();
  }

  protected onCctpFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      this.cctpFileSelected.emit({ ao: this.ao(), file });
    }
    target.value = '';
  }
}

