import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AoAnalysisResult,
  AoBoampHistoryEntry,
  AoItem,
  AoRecommendation,
  AoSignalLevel,
} from '../../core/ao/ao.model';
import { AoService } from '../../core/ao/ao.service';
import { AoAnalyseStore } from '../../core/ao/ao-analyse.store';
import { ToastService } from '../../core/notifications/toast.service';
import { extractTextFromFile } from '../../core/files/extract-text';
import { truncateName } from '../../core/ao/ao-display.util';
import type { ProjectPrefill } from '../projects/project-new.page';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

interface RecommendationVisual {
  readonly label: string;
  readonly classes: string;
  readonly description: string;
}

interface BoampRow {
  readonly date: string;
  readonly objet: string;
  readonly titulaire: string | null;
}

const RECOMMENDATIONS: Record<AoRecommendation, RecommendationVisual> = {
  go: {
    label: 'GO',
    classes: 'from-emerald-500 to-emerald-700 ring-emerald-200',
    description: 'Pertinent — opportunité à saisir',
  },
  caution: {
    label: 'PRUDENCE',
    classes: 'from-amber-500 to-amber-600 ring-amber-200',
    description: 'À étudier — points d\'attention',
  },
  nogo: {
    label: 'NO-GO',
    classes: 'from-red-500 to-red-700 ring-red-200',
    description: 'Non aligné — éviter la candidature',
  },
};

const SIGNAL_CLASSES: Record<AoSignalLevel, string> = {
  green: 'text-emerald-600 bg-emerald-100',
  yellow: 'text-amber-700 bg-amber-100',
  red: 'text-red-600 bg-red-100',
};

const BOAMP_MAX_ROWS = 8;
const BOAMP_OBJET_MAX_LENGTH = 80;

/**
 * Page d'analyse IA d'un appel d'offres.
 *
 * L'AO sélectionné est récupéré depuis {@link AoAnalyseStore}. L'analyse
 * est lancée à la demande, accompagnée optionnellement du règlement de
 * consultation collé par l'utilisateur ou extrait d'un PDF/DOCX.
 */
@Component({
  selector: 'app-ao-analyse-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Card, Button],
  templateUrl: './ao-analyse.page.html',
})
export class AoAnalysePage implements OnInit {
  private readonly aoService = inject(AoService);
  private readonly analyseStore = inject(AoAnalyseStore);
  private readonly toaster = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly ao = this.analyseStore.selected;
  protected readonly rcText = signal('');
  protected readonly running = signal(false);
  protected readonly extractingRc = signal(false);
  protected readonly result = signal<AoAnalysisResult | null>(null);

  ngOnInit(): void {
    // Si l'utilisateur arrive depuis l'historique, on récupère le résultat
    // déjà calculé pour éviter un nouvel appel IA inutile.
    const preloaded = this.analyseStore.preloadedResult();
    if (preloaded) {
      this.result.set(preloaded);
      this.analyseStore.consumePreloadedResult();
    }
    // Si le RC a été extrait côté Veille, on le récupère ici comme valeur
    // initiale du textarea (l'analyse reste lancée explicitement).
    const pendingRc = this.analyseStore.consumePendingRc();
    if (pendingRc) {
      this.rcText.set(pendingRc);
    }
  }

  protected readonly recommendationVisual = computed<RecommendationVisual | null>(() => {
    const result = this.result();
    return result ? RECOMMENDATIONS[result.recommendation] : null;
  });

  /** Lignes BOAMP préparées pour l'affichage en table (limitées à 8). */
  protected readonly boampRows = computed<ReadonlyArray<BoampRow>>(() => {
    const analysis = this.result();
    if (!analysis) return [];
    return analysis.boampHistory
      .slice(0, BOAMP_MAX_ROWS)
      .map((entry) => toBoampRow(entry));
  });

  /** Texte d'en-tête de la carte BOAMP (« N marchés attribués »). */
  protected readonly boampSubtitle = computed<string | null>(() => {
    const analysis = this.result();
    if (!analysis || analysis.boampHistory.length === 0) return null;
    const n = analysis.boampHistory.length;
    return `${n} marché${n > 1 ? 's' : ''} attribué${n > 1 ? 's' : ''}`;
  });

  /** Date de publication formatée pour l'en-tête, ou `null` si absente. */
  protected readonly formattedPublishedAt = computed<string | null>(() => {
    const ao = this.ao();
    return ao ? this.formatDate(ao.publishedAt) : null;
  });

  protected onRcChange(value: string): void {
    this.rcText.set(value);
  }

  protected async onRcFileSelected(file: File | undefined | null): Promise<void> {
    if (!file || this.extractingRc()) return;
    this.extractingRc.set(true);
    try {
      const extracted = await extractTextFromFile(file);
      this.rcText.set(extracted);
      const k = Math.round(extracted.length / 1000);
      this.toaster.success({
        title: 'Document chargé',
        description: `${k} k caractères extraits`,
      });
    } catch (error: unknown) {
      this.toaster.error({
        title: 'Extraction impossible',
        description: extractErrorMessage(error),
      });
    } finally {
      this.extractingRc.set(false);
    }
  }

  protected analyse(): void {
    const ao = this.ao();
    if (!ao || this.running()) return;
    this.running.set(true);
    this.aoService
      .analyse({
        ao,
        ...(this.rcText().trim() ? { rcText: this.rcText().trim() } : {}),
      })
      .subscribe({
        next: (analysis) => {
          this.running.set(false);
          this.result.set(analysis);
          this.toaster.success({ title: 'Analyse terminée' });
        },
        error: (error: unknown) => {
          this.running.set(false);
          this.toaster.error({
            title: 'Analyse impossible',
            description: extractErrorMessage(error),
          });
        },
      });
  }

  protected backToVeille(): void {
    this.analyseStore.clear();
    this.router.navigate(['/veille-ao']);
  }

  /**
   * Crée un nouveau projet AO pré-rempli avec les informations de l'AO
   * actuellement analysé. Navigue ensuite vers `/projects/new`.
   */
  protected createProject(): void {
    const ao = this.ao();
    if (!ao) return;
    const prefill: ProjectPrefill = {
      name: truncateName(ao.title),
      clientName: ao.buyer ?? '',
      marketObject: ao.title ?? '',
      deadline: ao.deadline ? ao.deadline.slice(0, 10) : '',
      sourceAoId: ao.id,
    };
    this.router.navigate(['/projects/new'], { state: { prefill } });
  }

  protected signalClasses(level: AoSignalLevel): string {
    return SIGNAL_CLASSES[level];
  }

  /**
   * Formate une date ISO (`YYYY-MM-DD` ou ISO complet) au format français long.
   * Renvoie `null` pour les valeurs absentes, et la chaîne d'origine si
   * la date n'est pas analysable.
   */
  protected formatDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Convertit un score sur 10 (échelle backend) en pourcentage 0–100
   * pour la barre de progression. Clampé pour éviter tout dépassement.
   */
  protected scorePercent(score: number | null): number {
    if (score === null) return 0;
    return Math.max(0, Math.min(100, Math.round(score * 10)));
  }

  protected formattedAo(): AoItem | null {
    return this.ao();
  }
}

function toBoampRow(entry: AoBoampHistoryEntry): BoampRow {
  const rawObjet = entry.objet ?? 'Marché sans intitulé';
  const objet =
    rawObjet.length > BOAMP_OBJET_MAX_LENGTH
      ? `${rawObjet.slice(0, BOAMP_OBJET_MAX_LENGTH)}…`
      : rawObjet;
  return {
    date: entry.date ? entry.date.slice(0, 10) : '—',
    objet,
    titulaire: entry.titulaire ?? null,
  };
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as { error?: { message?: unknown }; message?: unknown };
    const inner = maybeError.error?.message;
    if (typeof inner === 'string') return inner;
    if (typeof maybeError.message === 'string') return maybeError.message;
  }
  return 'Une erreur inattendue est survenue.';
}
