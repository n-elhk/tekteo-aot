import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { EMPTY_PAGINATED_RESPONSE } from '@org/types';
import { GenerationHistoryService } from '../../core/generation-history/generation-history.service';
import {
  GenerationHistoryEntry,
  extractAo,
  extractResult,
} from '../../core/generation-history/generation-history.model';
import { AoAnalyseStore } from '../../core/ao/ao-analyse.store';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { RecommendationBadge } from '../../shared/ui/recommendation-badge/recommendation-badge';

type SortValue =
  | 'recent'
  | 'oldest'
  | 'score_desc'
  | 'score_asc'
  | 'reco'
  | 'buyer';

const SORT_OPTIONS: ReadonlyArray<{ value: SortValue; label: string }> = [
  { value: 'recent', label: 'Plus récent' },
  { value: 'oldest', label: 'Plus ancien' },
  { value: 'score_desc', label: 'Score ↓' },
  { value: 'score_asc', label: 'Score ↑' },
  { value: 'reco', label: 'Recommandation' },
  { value: 'buyer', label: 'Acheteur A → Z' },
];

const RECO_ORDER = { go: 0, caution: 1, nogo: 2 } as const;

interface EnrichedEntry {
  readonly entry: GenerationHistoryEntry;
  readonly title: string;
  readonly buyer: string;
  readonly score: number | null;
  readonly recommendation: 'go' | 'caution' | 'nogo' | null;
  readonly recommendationText: string;
}

const PAGE_SIZE = 50;

/**
 * Liste des analyses d'appels d'offres précédentes.
 *
 * Endpoint API admin uniquement (`GET /generation-history?module=ao_analyse`).
 * Les utilisateurs non-admin voient un message les invitant à demander
 * un accès.
 */
@Component({
  selector: 'app-ao-analyses-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button, RecommendationBadge, DatePipe],
  templateUrl: './ao-analyses-list.page.html',
})
export class AoAnalysesListPage {
  private readonly historyService = inject(GenerationHistoryService);
  private readonly analyseStore = inject(AoAnalyseStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly isAdmin = this.authStore.isAdmin;
  protected readonly sortOptions = SORT_OPTIONS;

  protected readonly sort = signal<SortValue>('recent');
  protected readonly page = signal(1);

  protected readonly resource = rxResource({
    params: () => (this.isAdmin() ? { page: this.page() } : undefined),
    stream: ({ params }) => {
      return this.historyService.list({
        module: 'ao_analyse',
        page: params.page,
        pageSize: PAGE_SIZE,
      });
    },
    defaultValue: EMPTY_PAGINATED_RESPONSE,
  });

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(
    () => this.resource.error() !== undefined,
  );
  protected readonly total = computed(() => this.resource.value().total);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / PAGE_SIZE)),
  );

  protected readonly entries = computed(() =>
    this.resource.value().items.map((entry) => enrich(entry)),
  );

  protected readonly sorted = computed(() => {
    const list = [...this.entries()];
    const sort = this.sort();
    list.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.entry.generatedAt.localeCompare(b.entry.generatedAt);
        case 'score_desc':
          return (b.score ?? -1) - (a.score ?? -1);
        case 'score_asc':
          return (
            (a.score ?? Number.MAX_SAFE_INTEGER) -
            (b.score ?? Number.MAX_SAFE_INTEGER)
          );
        case 'reco':
          return recoRank(a.recommendation) - recoRank(b.recommendation);
        case 'buyer':
          return a.buyer.localeCompare(b.buyer, 'fr');
        case 'recent':
        default:
          return b.entry.generatedAt.localeCompare(a.entry.generatedAt);
      }
    });
    return list;
  });

  protected onSortChange(value: SortValue): void {
    this.sort.set(value);
  }

  protected goToPage(next: number): void {
    if (next < 1 || next > this.totalPages()) return;
    this.page.set(next);
  }

  protected open(enriched: EnrichedEntry): void {
    const ao = extractAo(enriched.entry);
    const result = extractResult(enriched.entry);
    if (!ao) return;
    this.analyseStore.select(ao, result);
    this.router.navigate(['/veille-ao/analyse']);
  }

  protected scoreClasses(score: number | null): string {
    if (score === null) return 'bg-surface-200 text-surface-900/50';
    if (score >= 70) return 'bg-emerald-500 text-white';
    if (score >= 50) return 'bg-amber-500 text-white';
    return 'bg-red-500 text-white';
  }
}

function enrich(entry: GenerationHistoryEntry): EnrichedEntry {
  const ao = extractAo(entry);
  const result = extractResult(entry);
  return {
    entry,
    title: ao?.title ?? 'Analyse sans titre',
    buyer: ao?.buyer ?? '',
    score: result?.score ?? null,
    recommendation: result?.recommendation ?? null,
    recommendationText: result?.recommendationText ?? '',
  };
}

function recoRank(value: 'go' | 'caution' | 'nogo' | null): number {
  if (value === null) return 9;
  return RECO_ORDER[value];
}
