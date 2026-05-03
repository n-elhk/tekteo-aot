import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { EMPTY, type Observable } from 'rxjs';
import type { AoSearchQueryDto, AoItem, AoSearchResponse } from '../../core/ao/ao.model';
import { AoService } from '../../core/ao/ao.service';
import { AoFavoritesService } from '../../core/ao/ao-favorites.service';
import { AoAnalyseStore } from '../../core/ao/ao-analyse.store';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { AoCard } from '../../shared/ui/ao-card/ao-card';

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
  { value: 'OUVERT', label: 'Appel d\'offres ouvert' },
  { value: 'NEGOCIE', label: 'Procédure négociée' },
  { value: 'MAPA', label: 'MAPA' },
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

/**
 * Page Veille AO : recherche dans le BOAMP, filtres avancés, favoris,
 * lancement d'une analyse IA pour un AO ciblé.
 */
@Component({
  selector: 'app-ao-veille-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, AoCard],
  templateUrl: './ao-veille.page.html',
})
export class AoVeillePage implements OnInit {
  private readonly aoService = inject(AoService);
  private readonly favoritesService = inject(AoFavoritesService);
  private readonly analyseStore = inject(AoAnalyseStore);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly regions = REGIONS;
  protected readonly types = TYPES;
  protected readonly procedures = PROCEDURES;

  /** Filtres en cours de saisie. */
  protected readonly draft = signal<SearchParams>({ ...INITIAL });
  /** Paramètres effectivement utilisés pour la recherche. */
  protected readonly applied = signal<SearchParams | null>(null);
  protected readonly favoriteBusyId = signal<string | null>(null);

  protected readonly resource = rxResource<AoSearchResponse | undefined, SearchParams | null>({
    params: () => this.applied(),
    stream: ({ params }): Observable<AoSearchResponse | undefined> =>
      params ? this.aoService.search(toQuery(params)) : (EMPTY as Observable<undefined>),
  });

  protected readonly results = computed<ReadonlyArray<AoItem>>(
    () => this.resource.value()?.results ?? [],
  );
  protected readonly hasSearched = computed(() => this.applied() !== null);
  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);
  protected readonly totalCount = computed(() => this.resource.value()?.totalCount ?? 0);
  protected readonly currentPage = computed(() => this.applied()?.page ?? 1);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / 20)));

  ngOnInit(): void {
    this.favoritesService.ensureLoaded();
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
    this.applied.set(null);
  }

  protected applyFilters(): void {
    this.applied.set({ ...this.draft(), page: 1 });
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

  protected analyse(ao: AoItem): void {
    this.analyseStore.select(ao);
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
