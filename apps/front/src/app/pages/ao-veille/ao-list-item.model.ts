import type { AoItem } from '../../core/ao/ao.model';

/**
 * Item d'AO enrichi des métadonnées calculées par la page parente
 * (favori, importé, nouveau depuis la dernière visite, extraction CCTP en cours).
 *
 * Permet aux composants de liste de rester purement présentationnels : ils
 * reçoivent toute l'info nécessaire en entrée sans dépendre des services.
 */
export interface AoListItem {
  readonly ao: AoItem;
  readonly isFavorite: boolean;
  readonly isImported: boolean;
  readonly projectId: string | null;
  readonly isNew: boolean;
  readonly cctpBusy: boolean;
}
