import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { finalize, firstValueFrom, Observable, tap } from 'rxjs';
import { EMPTY_PAGINATED_RESPONSE } from '@org/types';
import type {
  AoSearchQueryDto,
  AoItem,
  AoFavorite,
} from '../../core/ao/ao.model';
import { AoService } from '../../core/ao/ao.service';
import { AoFavoritesService } from '../../core/ao/ao-favorites.service';
import { AoAnalyseStore } from '../../core/ao/ao-analyse.store';
import { ToastService } from '../../core/notifications/toast.service';
import { ProjectsSourceAoService } from '../../core/projects/projects-source-ao.service';
import { extractTextFromFile } from '../../core/files/extract-text';
import { truncateName } from '../../core/ao/ao-display.util';
import { getPreviousVisit, markVisitNow } from '../../core/ao/ao-last-visit';
import type { ProjectPrefill } from '../projects/project-new.page';
import { Card } from '../../shared/ui/card/card';
import {
  AoSearchFilters,
  type SearchFilterParams,
} from './ao-search-filters/ao-search-filters';
import { AoVeilleResultsList } from './ao-veille-results-list/ao-veille-results-list';
import { AoVeilleFavoritesList } from './ao-veille-favorites-list/ao-veille-favorites-list';
import type { AoListItem } from './ao-list-item.model';
import {
  AoAnalyseModal,
  type AoAnalyseModalData,
  type AoAnalyseModalResult,
} from './ao-analyse-modal';

interface SearchParams extends SearchFilterParams {
  page: number;
}

type ActiveTab = 'results' | 'favoris';

/**
 * Page Veille AO : recherche dans le BOAMP, filtres avancés, favoris,
 * lancement d'une analyse IA pour un AO ciblé. Inclut un onglet « Favoris »,
 * des suggestions de mots-clés, une création de projet pré-rempli (avec
 * extraction de CCTP côté navigateur) et une modale de confirmation
 * d'analyse permettant de joindre un RC extrait localement.
 */
@Component({
  selector: 'app-ao-veille-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, AoSearchFilters, AoVeilleResultsList, AoVeilleFavoritesList],
  templateUrl: './ao-veille.page.html',
})
export class AoVeillePage {
  private readonly aoService = inject(AoService);
  private readonly favoritesService = inject(AoFavoritesService);
  private readonly importedService = inject(ProjectsSourceAoService);
  private readonly analyseStore = inject(AoAnalyseStore);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  protected readonly applied = signal<SearchParams | undefined>(undefined);
  protected readonly favoriteBusyId = signal<string | null>(null);

  /** Onglet courant : résultats de recherche ou favoris. */
  protected readonly activeTab = signal<ActiveTab>('results');

  /** Date ISO de la précédente visite, figée au montage de la page. */
  protected readonly previousVisit = signal<string | null>(getPreviousVisit());

  /** AO dont le CCTP est en cours d'extraction (pour la carte concernée). */
  protected readonly cctpBusyId = signal<string | null>(null);

  protected readonly resource = rxResource({
    params: () => this.applied(),
    stream: ({ params }) => this.aoService.search(toQuery(params)),
    defaultValue: EMPTY_PAGINATED_RESPONSE,
  });

  protected readonly results = computed<ReadonlyArray<AoItem>>(
    () => this.resource.value().items,
  );
  protected readonly favoritesList = computed<ReadonlyArray<AoItem>>(() =>
    this.favoritesService.favorites().map((favorite) => favorite.aoData),
  );

  protected readonly resultItems = computed<ReadonlyArray<AoListItem>>(() =>
    this.results().map((ao) => this.toListItem(ao)),
  );
  protected readonly favoriteItems = computed<ReadonlyArray<AoListItem>>(() =>
    this.favoritesList().map((ao) => this.toListItem(ao)),
  );

  protected readonly hasSearched = computed(() => this.applied() !== undefined);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(
    () => this.resource.error() !== undefined,
  );
  protected readonly totalCount = computed(() => this.resource.value().total);
  protected readonly currentPage = computed(() => this.applied()?.page ?? 1);
  protected readonly totalPages = computed(() => {
    const response = this.resource.value();
    if (response.pageSize === 0) return 1;
    return Math.max(1, Math.ceil(response.total / response.pageSize));
  });
  protected readonly favoritesCount = computed(
    () => this.favoritesService.favorites().length,
  );

  constructor() {
    // Marque l'horodatage de la visite courante immédiatement après avoir lu
    // la précédente : les futurs renders compareront `publishedAt` à la valeur
    // figée dans `previousVisit`.
    markVisitNow();
  }

  protected onSearched(params: SearchFilterParams): void {
    this.applied.set({ ...params, page: 1 });
    this.activeTab.set('results');
  }

  protected onReset(): void {
    this.applied.set(undefined);
  }

  protected refresh(): void {
    if (this.applied()) {
      this.resource.reload();
    }
  }

  protected setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  protected onPageChanged(page: number): void {
    const current = this.applied();
    if (!current) return;
    this.applied.set({ ...current, page });
  }

  private toListItem(ao: AoItem): AoListItem {
    return {
      ao,
      isFavorite: this.favoritesService.isFavorite(ao.id),
      isImported: this.importedService.isImported(ao.id),
      projectId: this.importedService.getProjectId(ao.id),
      isNew: this.isNew(ao),
      cctpBusy: this.cctpBusyId() === ao.id,
    };
  }

  toggleFavoriteRequest(ao: AoItem) {
    const isCurrentlyFavorite = this.favoritesService.isFavorite(ao.id);

    if (isCurrentlyFavorite) {
      return this.favoritesService.remove(ao.id).pipe(
        tap(() => {
          this.toaster.success({
            title: 'Retiré des favoris',
          });
        }),
      );
    }

    return this.favoritesService.add(ao).pipe(
      tap(() => {
        this.toaster.success({
          title: 'Ajouté aux favoris',
        });
      }),
    );
  }

  protected toggleFavorite(ao: AoItem): void {
    if (this.favoriteBusyId() === ao.id) return;

    const request$: Observable<void | AoFavorite> =
      this.toggleFavoriteRequest(ao);

    const observer = {
      error: () => {
        this.toaster.error({
          title: 'Action impossible',
          description: 'Veuillez réessayer dans un instant.',
        });
      },
    };

    request$
      .pipe(finalize(() => this.favoriteBusyId.set(null)))
      .subscribe(observer);
  }

  private isNew(ao: AoItem): boolean {
    const previous = this.previousVisit();
    if (!previous || !ao.publishedAt) return false;
    const publishedAt = new Date(ao.publishedAt).getTime();
    const previousTime = new Date(previous).getTime();
    if (Number.isNaN(publishedAt) || Number.isNaN(previousTime)) return false;
    return publishedAt > previousTime;
  }

  protected createProject(ao: AoItem): void {
    const prefill = buildPrefill(ao);
    this.router.navigate(['/projects/new'], { state: { prefill } });
  }

  protected handleCctpFile(event: { ao: AoItem; file: File }): void {
    const { ao, file } = event;
    if (this.cctpBusyId()) return;
    this.cctpBusyId.set(ao.id);
    extractTextFromFile(file)
      .then((text) => {
        this.cctpBusyId.set(null);
        const prefill: ProjectPrefill = {
          ...buildPrefill(ao),
          cctpText: text,
          cctpFilename: file.name,
        };
        this.router.navigate(['/projects/new'], { state: { prefill } });
      })
      .catch((error: unknown) => {
        this.cctpBusyId.set(null);
        this.toaster.error({
          title: 'Extraction impossible',
          description: extractErrorMessage(error),
        });
      });
  }

  protected async openAnalyseModal(ao: AoItem): Promise<void> {
    const ref = this.dialog.open<
      AoAnalyseModalResult,
      AoAnalyseModalData,
      AoAnalyseModal
    >(AoAnalyseModal, { ...APP_DIALOG_CONFIG, data: { ao } });
    const result = await firstValueFrom(ref.closed);
    if (!result) return;
    this.analyseStore.select(ao);
    this.analyseStore.setPendingRc(result.rcText);
    this.router.navigate(['/veille-ao/analyse']);
  }
}

function toQuery(params: SearchParams): Partial<AoSearchQueryDto> {
  const days = Number.parseInt(params.deadlineDays, 10);
  return {
    page: params.page,
    deadlineDays: Number.isFinite(days) && days > 0 ? days : 0,
    hidePast: params.hidePast,
    hideAttrib: params.hideAttrib,
    ...(params.q.trim() ? { q: params.q.trim() } : {}),
    ...(params.exclude.trim() ? { exclude: params.exclude.trim() } : {}),
    ...(params.region
      ? { region: params.region as AoSearchQueryDto['region'] }
      : {}),
    ...(params.typeMarche
      ? { typeMarche: params.typeMarche as AoSearchQueryDto['typeMarche'] }
      : {}),
    ...(params.procedure
      ? { procedure: params.procedure as AoSearchQueryDto['procedure'] }
      : {}),
  };
}

function buildPrefill(ao: AoItem): ProjectPrefill {
  const deadline = ao.deadline ? ao.deadline.slice(0, 10) : '';
  return {
    name: truncateName(ao.title),
    clientName: ao.buyer ?? '',
    marketObject: ao.title ?? '',
    deadline,
    sourceAoId: ao.id,
  };
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Une erreur inattendue est survenue.';
}
