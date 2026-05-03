import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AoAnalysisResult,
  AoItem,
  AoRecommendation,
  AoSignalLevel,
} from '../../core/ao/ao.model';
import { AoService } from '../../core/ao/ao.service';
import { AoAnalyseStore } from '../../core/ao/ao-analyse.store';
import { ToastService } from '../../core/notifications/toast.service';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

interface RecommendationVisual {
  readonly label: string;
  readonly classes: string;
  readonly description: string;
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

/**
 * Page d'analyse IA d'un appel d'offres.
 *
 * L'AO sélectionné est récupéré depuis {@link AoAnalyseStore}. L'analyse
 * est lancée à la demande, accompagnée optionnellement du règlement de
 * consultation collé par l'utilisateur.
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
  protected readonly result = signal<AoAnalysisResult | null>(null);

  ngOnInit(): void {
    // Si l'utilisateur arrive depuis l'historique, on récupère le résultat
    // déjà calculé pour éviter un nouvel appel IA inutile.
    const preloaded = this.analyseStore.preloadedResult();
    if (preloaded) {
      this.result.set(preloaded);
      this.analyseStore.consumePreloadedResult();
    }
  }

  protected readonly recommendationVisual = computed<RecommendationVisual | null>(() => {
    const result = this.result();
    return result ? RECOMMENDATIONS[result.recommendation] : null;
  });

  protected onRcChange(value: string): void {
    this.rcText.set(value);
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

  protected signalClasses(level: AoSignalLevel): string {
    return SIGNAL_CLASSES[level];
  }

  protected formatDeadline(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  protected scorePercent(score: number | null): number {
    if (score === null) return 0;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  protected formattedAo(): AoItem | null {
    return this.ao();
  }
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
