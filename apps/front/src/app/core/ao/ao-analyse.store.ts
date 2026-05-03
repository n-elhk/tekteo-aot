import { Injectable, signal } from '@angular/core';
import { AoAnalysisResult, AoItem } from './ao.model';

/**
 * Store partagé pour transférer un AO entre Veille / Historique et la page Analyse.
 *
 * Permet aussi de pré-charger un résultat (depuis l'historique) afin d'éviter
 * de relancer un appel IA pour ré-afficher une analyse passée.
 */
@Injectable({ providedIn: 'root' })
export class AoAnalyseStore {
  private readonly _selected = signal<AoItem | null>(null);
  private readonly _preloadedResult = signal<AoAnalysisResult | null>(null);

  readonly selected = this._selected.asReadonly();
  readonly preloadedResult = this._preloadedResult.asReadonly();

  select(ao: AoItem, preloadedResult: AoAnalysisResult | null = null): void {
    this._selected.set(ao);
    this._preloadedResult.set(preloadedResult);
  }

  clear(): void {
    this._selected.set(null);
    this._preloadedResult.set(null);
  }

  /** Une fois consommé par la page Analyse, oublier le résultat préchargé. */
  consumePreloadedResult(): void {
    this._preloadedResult.set(null);
  }
}
