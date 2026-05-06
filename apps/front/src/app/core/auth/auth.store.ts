import { Injectable, computed, signal } from '@angular/core';
import { User } from './user.model';

/**
 * État d'authentification global.
 *
 * L'API utilise des cookies httpOnly : aucun token n'est manipulé côté
 * JavaScript. L'utilisateur courant est récupéré au démarrage via
 * `GET /auth/me` (cf. `provideAppInitializer` dans `app.config.ts`),
 * de sorte que la source de vérité reste le serveur.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<User | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly canEdit = computed(() => {
    const role = this._user()?.role;
    return role === 'admin' || role === 'redacteur';
  });

  setUser(user: User): void {
    this._user.set(user);
  }

  clear(): void {
    this._user.set(null);
  }
}
