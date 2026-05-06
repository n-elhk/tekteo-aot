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
  private readonly _pendingRc = signal<string | null>(null);

  readonly selected = this._selected.asReadonly();
  readonly preloadedResult = this._preloadedResult.asReadonly();
  readonly pendingRc = this._pendingRc.asReadonly();

  select(ao: AoItem, preloadedResult: AoAnalysisResult | null = null): void {
    this._selected.set(ao);
    this._preloadedResult.set(preloadedResult);
  }

  clear(): void {
    this._selected.set(null);
    this._preloadedResult.set(null);
    this._pendingRc.set(null);
  }

  /** Une fois consommé par la page Analyse, oublier le résultat préchargé. */
  consumePreloadedResult(): void {
    this._preloadedResult.set(null);
  }

  /**
   * Pré-positionne le texte du règlement de consultation extrait depuis la
   * Veille, qui sera lu une fois par la page Analyse.
   */
  setPendingRc(text: string | null): void {
    this._pendingRc.set(text);
  }

  /** Renvoie puis efface le RC pré-positionné. */
  consumePendingRc(): string | null {
    const value = this._pendingRc();
    if (value !== null) this._pendingRc.set(null);
    return value;
  }
}
