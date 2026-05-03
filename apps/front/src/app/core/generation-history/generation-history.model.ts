import type { GenerationModuleValue } from '@org/schemas';
import type { AoAnalysisResult, AoItem } from '../ao/ao.model';

export type GenerationModule = GenerationModuleValue;

/** Auteur d'une génération (relation `generatedBy`). */
export interface GenerationAuthor {
  readonly id: string;
  readonly email: string;
  readonly fullName: string | null;
}

/** Projet associé à une génération (peut être null pour les analyses AO). */
export interface GenerationProjectRef {
  readonly id: string;
  readonly name: string;
  readonly clientName: string;
}

/** Entrée brute renvoyée par l'API d'historique. */
export interface GenerationHistoryEntry {
  readonly id: string;
  readonly projectId: string | null;
  readonly module: GenerationModule;
  readonly inputData: unknown;
  readonly outputContent: string | null;
  readonly modelUsed: string | null;
  readonly tokensUsed: number | null;
  readonly generatedById: string | null;
  readonly generatedAt: string;
  readonly generatedBy: GenerationAuthor | null;
  readonly project: GenerationProjectRef | null;
}

/** Réponse paginée de `GET /generation-history`. */
export interface GenerationHistoryPage {
  readonly items: ReadonlyArray<GenerationHistoryEntry>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Statistiques agrégées par module. */
export interface GenerationHistoryStats {
  readonly byModule: ReadonlyArray<{
    readonly module: GenerationModule;
    readonly count: number;
    readonly tokens: number;
  }>;
  readonly totalTokens: number;
  readonly totalCount: number;
}

/**
 * Type spécifique aux entrées du module `ao_analyse` :
 * `inputData` contient l'AO source et `outputContent` le JSON du résultat IA.
 */
export interface AoAnalysisHistoryItem extends GenerationHistoryEntry {
  readonly module: 'ao_analyse';
}

/** Helper de typage : décode l'AO source de l'entrée. */
export function extractAo(entry: GenerationHistoryEntry): AoItem | null {
  const data = entry.inputData;
  if (!data || typeof data !== 'object') return null;
  const maybeAo = (data as { ao?: unknown }).ao;
  return isAoItem(maybeAo) ? maybeAo : null;
}

/** Helper de typage : décode le résultat IA de l'entrée. */
export function extractResult(entry: GenerationHistoryEntry): AoAnalysisResult | null {
  if (!entry.outputContent) return null;
  try {
    const parsed = JSON.parse(entry.outputContent) as unknown;
    return isAoAnalysisResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAoItem(value: unknown): value is AoItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { title?: unknown }).title === 'string'
  );
}

function isAoAnalysisResult(value: unknown): value is AoAnalysisResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'recommendation' in value &&
    'pertinence' in value
  );
}
