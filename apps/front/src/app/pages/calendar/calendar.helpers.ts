/**
 * Helpers purs pour le calendrier.
 * Aucune dépendance Angular : faciles à tester unitairement.
 */

export interface CalendarMonth {
  readonly year: number;
  /** 0-indexed (0 = janvier). */
  readonly month: number;
}

export interface UrgencyVisual {
  readonly label: string;
  readonly classes: string;
  readonly dotClass: string;
}

export const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

/** Décrémente un mois (gère le passage de janvier → décembre année précédente). */
export function previousMonth(current: CalendarMonth): CalendarMonth {
  if (current.month === 0) {
    return { year: current.year - 1, month: 11 };
  }
  return { year: current.year, month: current.month - 1 };
}

/** Incrémente un mois (gère le passage de décembre → janvier année suivante). */
export function nextMonth(current: CalendarMonth): CalendarMonth {
  if (current.month === 11) {
    return { year: current.year + 1, month: 0 };
  }
  return { year: current.year, month: current.month + 1 };
}

/**
 * Construit la grille du mois (semaine débutant le lundi).
 * Renvoie 35 ou 42 cellules (ligne complète à la fin),
 * `null` pour les cellules avant/après le mois.
 */
export function buildMonthGrid(month: CalendarMonth): ReadonlyArray<number | null> {
  const firstDay = new Date(month.year, month.month, 1);
  const lastDay = new Date(month.year, month.month + 1, 0);
  // Décalage avec lundi = 0 (par défaut JS dimanche = 0).
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: Array<number | null> = [];
  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/** Clé de date stable au format ISO `YYYY-MM-DD`. */
export function dateKey(month: CalendarMonth, day: number): string {
  const m = String(month.month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${month.year}-${m}-${d}`;
}

/** Extrait la clé `YYYY-MM-DD` d'une date ISO ou de tout préfixe valide. */
export function extractDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/** Retourne l'heure 0:00:00 d'aujourd'hui (utile pour le diff de jours). */
export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Calcule la « tonalité » d'urgence d'une échéance à partir d'aujourd'hui.
 * - passée → gris
 * - ≤ 7 jours → rouge
 * - ≤ 14 jours → orange
 * - sinon → vert
 */
export function urgencyOf(deadline: string, today: Date = startOfToday()): UrgencyVisual {
  const date = new Date(deadline);
  date.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      label: 'Passée',
      classes: 'bg-surface-100 text-surface-900/60 ring-surface-200',
      dotClass: 'bg-surface-400',
    };
  }
  if (diffDays === 0) {
    return {
      label: "Aujourd'hui",
      classes: 'bg-red-100 text-red-800 ring-red-200',
      dotClass: 'bg-red-500',
    };
  }
  if (diffDays <= 7) {
    return {
      label: `J-${diffDays}`,
      classes: 'bg-red-50 text-red-700 ring-red-200',
      dotClass: 'bg-red-500',
    };
  }
  if (diffDays <= 14) {
    return {
      label: `J-${diffDays}`,
      classes: 'bg-amber-50 text-amber-800 ring-amber-200',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    label: `J-${diffDays}`,
    classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dotClass: 'bg-emerald-500',
  };
}
