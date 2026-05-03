import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
  readonly adminOnly?: boolean;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: 'Tableau de bord', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { label: 'Projets', path: '/projects', icon: 'M3 7h18M3 12h18M3 17h12' },
  { label: 'Veille AO', path: '/veille-ao', icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 4v4l3 2' },
  { label: 'Mes analyses', path: '/analyses-ao', icon: 'M9 12l2 2 4-4m1.5-4.5L18 4l1.5 1.5L22 8l-1.5 1.5L19 11l-1.5-1.5L16 8z M3 5h10v14H3z', adminOnly: true },
  { label: 'CV Formatter', path: '/cv', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { label: 'Calendrier', path: '/calendar', icon: 'M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z' },
  { label: 'Recherche', path: '/search', icon: 'M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z' },
  { label: 'Administration', path: '/admin', icon: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z', adminOnly: true },
];

/**
 * Coquille principale de l'application : barre latérale, en-tête,
 * et zone de contenu reliée au routeur.
 */
@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.authStore.user;
  protected readonly isAdmin = this.authStore.isAdmin;
  protected readonly sidebarOpen = signal(false);

  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.adminOnly || this.isAdmin()),
  );

  protected readonly displayName = computed(
    () => this.user()?.name ?? this.user()?.email ?? '',
  );

  protected readonly initials = computed(() => {
    const source = this.user()?.name ?? this.user()?.email ?? '';
    return (
      source
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  });

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
