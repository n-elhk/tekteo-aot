/**
 * Persistance locale de la date de dernière visite de la page Veille.
 *
 * Permet d'afficher un badge « Nouveau » sur les AO publiés depuis la
 * dernière session sans état serveur. Chaque appel à {@link markVisitNow}
 * écrase la valeur ; la valeur précédente doit donc être lue *avant*.
 */

const STORAGE_KEY = 'ao_last_visit';

/** Lit l'horodatage ISO de la précédente visite, ou `null` si aucune. */
export function getPreviousVisit(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Écrit la date courante en ISO comme nouvelle dernière visite. */
export function markVisitNow(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // Stockage indisponible (mode privé strict, quota dépassé) — silencieux.
  }
}
