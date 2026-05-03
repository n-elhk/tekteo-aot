import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';
import { AppDialogService } from '../../core/dialog/app-dialog.service';
import { WelcomeModal } from './welcome-modal';

interface StatTile {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly trend: 'up' | 'down' | 'flat';
  readonly icon: string;
}

interface ActivityEntry {
  readonly who: string;
  readonly what: string;
  readonly target: string;
  readonly when: string;
}

interface QuickAction {
  readonly label: string;
  readonly description: string;
}

const STAT_TILES: ReadonlyArray<StatTile> = [
  {
    label: "Appels d'offres suivis",
    value: '128',
    delta: '+12 cette semaine',
    trend: 'up',
    icon: 'M3 7h18M3 12h18M3 17h12',
  },
  {
    label: 'Analyses en cours',
    value: '34',
    delta: "+4 aujourd'hui",
    trend: 'up',
    icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 4v4l3 2',
  },
  {
    label: 'Taux de réponse',
    value: '87%',
    delta: '−1,4 pts',
    trend: 'down',
    icon: 'M3 17l6-6 4 4 7-7',
  },
  {
    label: 'Échéances à venir',
    value: '9',
    delta: 'cette semaine',
    trend: 'flat',
    icon: 'M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  },
];

const ACTIVITY: ReadonlyArray<ActivityEntry> = [
  { who: 'Camille', what: "a publié l'analyse", target: 'AO-2026-014', when: 'il y a 12 min' },
  { who: 'Yanis', what: 'a créé le projet', target: 'Modernisation portail', when: 'il y a 1 h' },
  { who: 'Sophie', what: 'a archivé', target: 'AO-2025-987', when: 'hier' },
];

const QUICK_ACTIONS: ReadonlyArray<QuickAction> = [
  { label: 'Lancer une analyse AO', description: 'Importer un cahier des charges' },
  { label: 'Configurer la veille', description: 'Créer une alerte personnalisée' },
  { label: 'Inviter un coéquipier', description: 'Partager votre espace de travail' },
];

/**
 * Tableau de bord : aperçu rapide de l'activité Tekteo et accès aux modules.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, Button],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(AppDialogService);

  protected readonly user = this.authStore.user;
  protected readonly tiles = STAT_TILES;
  protected readonly activity = ACTIVITY;
  protected readonly quickActions = QUICK_ACTIONS;
  protected readonly greeting = computed(() =>
    buildGreeting(this.user()?.name ?? null),
  );

  protected openDemoDialog(): void {
    this.dialog.open<WelcomeModal, undefined, 'ok' | 'later'>(WelcomeModal);
  }
}

function buildGreeting(name: string | null): string {
  const trimmed = name?.split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Bonsoir' : hour < 18 ? 'Bonjour' : 'Bonsoir';
  return trimmed ? `${greeting}, ${trimmed} 👋` : `${greeting} 👋`;
}
