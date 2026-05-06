/**
 * Utilitaires d'affichage liés aux appels d'offres.
 *
 * Fonctions pures, partagées entre la veille et l'analyse pour garantir
 * une présentation cohérente (titres tronqués, etc.).
 */

/** Longueur maximale par défaut d'un nom de projet AO (alignée backend). */
export const AO_NAME_MAX_LENGTH = 100;

/**
 * Tronque un nom à la longueur maximale donnée et ajoute une ellipse
 * unicode (« … ») en cas de débordement.
 *
 * Renvoie une chaîne vide si l'entrée est `null`/`undefined`/vide.
 */
export function truncateName(
  name: string | null | undefined,
  maxLength: number = AO_NAME_MAX_LENGTH,
): string {
  if (!name) return '';
  return name.length > maxLength ? `${name.slice(0, maxLength)}…` : name;
}
