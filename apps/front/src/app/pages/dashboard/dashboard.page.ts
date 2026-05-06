import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { DashboardOverview, ProjectStatus } from '@org/types';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { Dialog } from '@angular/cdk/dialog';
import { APP_DIALOG_CONFIG } from '../../core/dialog/dialog.config';
import { DashboardService } from '../../core/dashboard/dashboard.service';
import { WelcomeModal } from './welcome-modal';
import { statusLabel as resolveStatusLabel } from './status-label';

interface StatusTile {
  readonly key: 'total' | ProjectStatus;
  readonly label: string;
  readonly value: number;
  readonly color: string;
  readonly icon: string;
}

interface ModuleLine {
  readonly label: string;
  readonly tokens: number;
}

const PRIMARY = '#1B2A4A';
const SECONDARY = '#2E86AB';
const ICONS = {
  folder: 'M3 7h18M3 12h18M3 17h12',
  clock: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 4v4l3 2',
  check: 'M5 13l4 4L19 7',
  trend: 'M3 17l6-6 4 4 7-7',
};

const MODULE_LABELS: Record<string, string> = {
  section: 'Sections mémoire',
  fiche_poste: 'Fiches de poste',
  cv: 'Formateur CV',
  ao_analyse: 'Analyses AO',
  bpu: 'BPU',
  infographie: 'Infographies',
};

/**
 * Tableau de bord : aperçu rapide de l'activité Tekteo et accès aux modules.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Button, RouterLink, CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(Dialog);
  private readonly dashboardService = inject(DashboardService);

  protected readonly user = this.authStore.user;
  protected readonly greeting = computed(() =>
    buildGreeting(this.user()?.name ?? null),
  );

  protected readonly overview = rxResource<DashboardOverview, void>({
    stream: () => this.dashboardService.getOverview(),
  });

  protected readonly isLoading = computed(() => this.overview.isLoading());
  protected readonly hasError = computed(
    () => this.overview.error() !== undefined,
  );

  protected readonly statusTiles = computed<StatusTile[]>(() => {
    const stats = this.overview.value()?.projectStats;
    if (!stats) return [];
    return [
      {
        key: 'total',
        label: 'Projets AO total',
        value: stats.total,
        color: PRIMARY,
        icon: ICONS.folder,
      },
      {
        key: 'en_cours',
        label: 'En cours',
        value: stats.byStatus.en_cours,
        color: '#D97706',
        icon: ICONS.clock,
      },
      {
        key: 'finalise',
        label: 'Finalisés',
        value: stats.byStatus.finalise,
        color: '#059669',
        icon: ICONS.check,
      },
      {
        key: 'soumis',
        label: 'Soumis',
        value: stats.byStatus.soumis,
        color: SECONDARY,
        icon: ICONS.trend,
      },
    ];
  });

  protected readonly tokenStats = computed(
    () => this.overview.value()?.tokenStats,
  );
  protected readonly recentProjects = computed(
    () => this.overview.value()?.recentProjects ?? [],
  );

  protected readonly moduleLines = computed<ModuleLine[]>(() => {
    const byModule = this.tokenStats()?.byModule ?? [];
    return byModule.map((m) => ({
      label: MODULE_LABELS[m.module] ?? m.module,
      tokens: m.tokens,
    }));
  });

  protected reload(): void {
    this.overview.reload();
  }

  protected openDemoDialog(): void {
    this.dialog.open<'ok' | 'later', undefined, WelcomeModal>(WelcomeModal, {
      ...APP_DIALOG_CONFIG,
    });
  }

  protected statusLabel(status: ProjectStatus) {
    return resolveStatusLabel(status);
  }
}

function buildGreeting(name: string | null): string {
  const trimmed = name?.split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Bonsoir' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  return trimmed ? `${greeting}, ${trimmed} 👋` : `${greeting} 👋`;
}
