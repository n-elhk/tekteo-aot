import type { AoItem } from '@org/schemas';

export type { AoItem };
export type { AoSearchQueryDto, AnalyseAoDto } from '@org/schemas';

/** Pagination + résultats renvoyés par `GET /ao/search`. */
export interface AoSearchResponse {
  readonly results: ReadonlyArray<AoItem>;
  readonly page: number;
  readonly totalCount: number;
}

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

export interface AoAnalysisResult {
  readonly score: number | null;
  readonly pertinence: string;
  readonly skillsMatch: ReadonlyArray<string>;
  readonly skillsMissing: ReadonlyArray<string>;
  readonly signals: ReadonlyArray<AoSignal>;
  readonly recommendation: AoRecommendation;
  readonly recommendationText: string;
  readonly boampHistory: ReadonlyArray<AoBoampHistoryEntry>;
  readonly tokensUsed: number;
}

/** Favori d'AO côté front (calé sur la réponse `/ao-favorites`). */
export interface AoFavorite {
  readonly id: string;
  readonly aoId: string;
  readonly aoData: AoItem;
  readonly createdAt: string;
}
