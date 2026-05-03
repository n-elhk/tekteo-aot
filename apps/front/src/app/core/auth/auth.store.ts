import { Injectable, computed, signal } from '@angular/core';
import { User } from './user.model';

const USER_STORAGE_KEY = 'tekteo.auth.user';

/**
 * État d'authentification global.
 *
 * L'API utilise des cookies httpOnly : aucun token n'est manipulé côté
 * JavaScript. Seule l'identité de l'utilisateur est conservée pour
 * un démarrage immédiat au rechargement.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<User | null>(readUser());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly canEdit = computed(() => {
    const role = this._user()?.role;
    return role === 'admin' || role === 'redacteur';
  });

  setUser(user: User): void {
    this._user.set(user);
    persist(user);
  }

  clear(): void {
    this._user.set(null);
    persist(null);
  }
}

function readUser(): User | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function persist(user: User | null): void {
  if (typeof localStorage === 'undefined') return;
  if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_STORAGE_KEY);
}
