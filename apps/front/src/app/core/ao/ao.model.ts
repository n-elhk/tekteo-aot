import type { AoItem } from '@org/schemas';
import type { PaginatedResponse } from '@org/types';

export type { AoItem };
export type { AoSearchQueryDto, AnalyseAoDto } from '@org/schemas';

/** Pagination + résultats renvoyés par `GET /ao/search`. */
export type AoSearchResponse = PaginatedResponse<AoItem>;

/** Niveau d'alerte d'un signal de pré-analyse. */
export type AoSignalLevel = 'red' | 'yellow' | 'green';

export interface AoSignal {
  readonly level: AoSignalLevel;
  readonly text: string;
}

/** Recommandation IA de l'analyse. */
export type AoRecommendation = 'go' | 'caution' | 'nogo';

export interface AoBoampHistoryEntry {
  readonly date: string | null;
  readonly objet: string | null;
  readonly titulaire: string | null;
  readonly acheteur: string | null;
}

/** Résultat web (Brave Search) attaché à l'analyse d'un AO. */
export type AoWebSnippetType = 'titulaire' | 'attribution';

export interface AoWebSnippet {
  readonly type: AoWebSnippetType;
  readonly label: string;
  readonly title: string;
  readonly url: string;
  readonly description: string;
}

export interface AoAnalysisResult {
  readonly score: number | null;
  readonly pertinence: string;
  readonly skillsMatch: ReadonlyArray<string>;
  readonly skillsMissing: ReadonlyArray<string>;
  readonly signals: ReadonlyArray<AoSignal>;
  readonly recommendation: AoRecommendation;
  readonly recommendationText: string;
  readonly boampHistory: ReadonlyArray<AoBoampHistoryEntry>;
  readonly webSnippets?: ReadonlyArray<AoWebSnippet>;
  readonly tokensUsed: number;
}

/** Favori d'AO côté front (calé sur la réponse `/ao-favorites`). */
export interface AoFavorite {
  readonly id: string;
  readonly aoId: string;
  readonly aoData: AoItem;
  readonly createdAt: string;
}
