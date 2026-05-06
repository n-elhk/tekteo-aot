import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { firstValueFrom, type Observable } from 'rxjs';
import { EMPTY_PAGINATED_RESPONSE } from '@org/types';
import type { AoSearchQueryDto, AoItem } from '../../core/ao/ao.model';
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
import { Button } from '../../shared/ui/button/button';
import { AoCard } from '../../shared/ui/ao-card/ao-card';
import {
  AoAnalyseModal,
  type AoAnalyseModalData,
  type AoAnalyseModalResult,
} from './ao-analyse-modal';

const REGIONS: ReadonlyArray<{ value: AoSearchQueryDto['region'] | ''; label: string }> = [
  { value: '', label: 'Toutes régions' },
  { value: 'IDF', label: 'Île-de-France' },
  { value: 'ARA', label: 'Auvergne-Rhône-Alpes' },
  { value: 'BFC', label: 'Bourgogne-Franche-Comté' },
  { value: 'BRE', label: 'Bretagne' },
  { value: 'CVL', label: 'Centre-Val de Loire' },
  { value: 'COR', label: 'Corse' },
  { value: 'GES', label: 'Grand Est' },
  { value: 'HDF', label: 'Hauts-de-France' },
  { value: 'NOR', label: 'Normandie' },
  { value: 'NAQ', label: 'Nouvelle-Aquitaine' },
  { value: 'OCC', label: 'Occitanie' },
  { value: 'PDL', label: 'Pays de la Loire' },
  { value: 'PAC', label: "Provence-Alpes-Côte d'Azur" },
  { value: 'DOM', label: 'DOM-TOM' },
];

const TYPES: ReadonlyArray<{ value: AoSearchQueryDto['typeMarche'] | ''; label: string }> = [
  { value: '', label: 'Tous les types' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'FOURNITURES', label: 'Fournitures' },
  { value: 'TRAVAUX', label: 'Travaux' },
];

const PROCEDURES: ReadonlyArray<{ value: AoSearchQueryDto['procedure'] | ''; label: string }> = [
  { value: '', label: 'Toutes procédures' },
  { value: 'OUVERT', label: "Appel d'offres ouvert" },
  { value: 'NEGOCIE', label: 'Procédure négociée' },
  { value: 'MAPA', label: 'MAPA' },
];

const SUGGESTIONS: ReadonlyArray<string> = [
  'ERP',
  'CRM',
  'développement',
  'cybersécurité',
  'cloud',
  'infogérance',
  'TMA',
  'MCO',
  'AMOA',
  'hébergement',
];

interface SearchParams {
  q: string;
  exclude: string;
  region: string;
  typeMarche: string;
  procedure: string;
  deadlineDays: number;
  hidePast: boolean;
  hideAttrib: boolean;
  page: number;
}

const INITIAL: SearchParams = {
  q: '',
  exclude: '',
  region: '',
  typeMarche: '',
  procedure: '',
  deadlineDays: 0,
  hidePast: true,
  hideAttrib: true,
  page: 1,
};

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
  imports: [RouterLink, Card, Button, AoCard],
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

  protected readonly regions = REGIONS;
  protected readonly types = TYPES;
  protected readonly procedures = PROCEDURES;
  protected readonly suggestions = SUGGESTIONS;

  /** Filtres en cours de saisie. */
  protected readonly draft = signal<SearchParams>({ ...INITIAL });
  /** Paramètres effectivement utilisés pour la recherche. */
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
  protected readonly favoritesList = computed<ReadonlyArray<AoItem>>(
    () => this.favoritesService.favorites().map((favorite) => favorite.aoData),
  );
  protected readonly displayList = computed<ReadonlyArray<AoItem>>(() =>
    this.activeTab() === 'favoris' ? this.favoritesList() : this.results(),
  );

  protected readonly hasSearched = computed(() => this.applied() !== undefined);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);
  protected readonly totalCount = computed(() => this.resource.value().total);
  protected readonly currentPage = computed(() => this.applied()?.page ?? 1);
  protected readonly totalPages = computed(() => {
    const response = this.resource.value();
    if (response.pageSize === 0) return 1;
    return Math.max(1, Math.ceil(response.total / response.pageSize));
  });
  protected readonly favoritesCount = computed(() => this.favoritesService.favorites().length);

  constructor() {
    // Marque l'horodatage de la visite courante immédiatement après avoir lu
    // la précédente : les futurs renders compareront `publishedAt` à la valeur
    // figée dans `previousVisit`.
    markVisitNow();
  }

  protected updateDraft<K extends keyof SearchParams>(key: K, value: SearchParams[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected onTextField(key: keyof SearchParams, value: string): void {
    this.updateDraft(key, value as never);
  }

  protected onCheckbox(key: keyof SearchParams, checked: boolean): void {
    this.updateDraft(key, checked as never);
  }

  protected onDeadlineChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.updateDraft('deadlineDays', Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
  }

  protected resetFilters(): void {
    this.draft.set({ ...INITIAL });
    this.applied.set(undefined);
  }

  protected applyFilters(): void {
    this.applied.set({ ...this.draft(), page: 1 });
    this.activeTab.set('results');
  }

  protected pickSuggestion(term: string): void {
    this.updateDraft('q', term);
    this.applyFilters();
  }

  protected refresh(): void {
    if (this.applied()) {
      this.resource.reload();
    }
  }

  protected setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    const current = this.applied();
    if (!current) return;
    this.applied.set({ ...current, page });
  }

  protected toggleFavorite(ao: AoItem): void {
    if (this.favoriteBusyId() === ao.id) return;
    const isCurrentlyFavorite = this.favoritesService.isFavorite(ao.id);
    this.favoriteBusyId.set(ao.id);
    const request$: Observable<unknown> = isCurrentlyFavorite
      ? this.favoritesService.remove(ao.id)
      : this.favoritesService.add(ao);
    request$.subscribe({
      next: () => {
        this.favoriteBusyId.set(null);
        this.toaster.success({
          title: isCurrentlyFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris',
        });
      },
      error: () => {
        this.favoriteBusyId.set(null);
        this.toaster.error({
          title: 'Action impossible',
          description: 'Veuillez réessayer dans un instant.',
        });
      },
    });
  }

  protected isFavorite(ao: AoItem): boolean {
    return this.favoritesService.isFavorite(ao.id);
  }

  protected isImported(ao: AoItem): boolean {
    return this.importedService.isImported(ao.id);
  }

  protected isNew(ao: AoItem): boolean {
    const previous = this.previousVisit();
    if (!previous || !ao.publishedAt) return false;
    const publishedAt = new Date(ao.publishedAt).getTime();
    const previousTime = new Date(previous).getTime();
    if (Number.isNaN(publishedAt) || Number.isNaN(previousTime)) return false;
    return publishedAt > previousTime;
  }

  protected isCctpBusy(ao: AoItem): boolean {
    return this.cctpBusyId() === ao.id;
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
    const ref = this.dialog.open<AoAnalyseModalResult, AoAnalyseModalData, AoAnalyseModal>(
      AoAnalyseModal,
      { ...APP_DIALOG_CONFIG, data: { ao } },
    );
    const result = await firstValueFrom(ref.closed);
    if (!result) return;
    this.analyseStore.select(ao);
    this.analyseStore.setPendingRc(result.rcText);
    this.router.navigate(['/veille-ao/analyse']);
  }
}

function toQuery(params: SearchParams): Partial<AoSearchQueryDto> {
  return {
    page: params.page,
    deadlineDays: params.deadlineDays,
    hidePast: params.hidePast,
    hideAttrib: params.hideAttrib,
    ...(params.q.trim() ? { q: params.q.trim() } : {}),
    ...(params.exclude.trim() ? { exclude: params.exclude.trim() } : {}),
    ...(params.region ? { region: params.region as AoSearchQueryDto['region'] } : {}),
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
