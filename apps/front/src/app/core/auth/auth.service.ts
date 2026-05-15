import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { IS_AUTH_ENDPOINT } from '../interceptors/http-context.tokens';
import { AuthStore } from './auth.store';
import { LoginCredentials, RegisterCredentials, User } from './user.model';

const AUTH_BASE = '/api/auth';

/**
 * Contexte HTTP partagé par les appels qui ciblent un endpoint
 * d'authentification : leur 401 ne doit pas déclencher de refresh,
 * sinon `/refresh` en échec boucle sur lui-même.
 *
 * Note : `fetchMe()` n'utilise PAS ce contexte. Au démarrage, si
 * l'access cookie a expiré pendant l'inactivité, on veut que le
 * `refreshInterceptor` tente une rotation transparente avant
 * d'abandonner.
 */
const authEndpointContext = (): HttpContext =>
  new HttpContext().set(IS_AUTH_ENDPOINT, true);

/**
 * Service d'authentification : appels HTTP qui s'appuient sur les cookies
 * httpOnly émis par l'API NestJS et synchronise l'état via {@link AuthStore}.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(AuthStore);

  login(credentials: LoginCredentials): Observable<User> {
    return this.http
      .post<User>(`${AUTH_BASE}/login`, credentials, {
        context: authEndpointContext(),
      })
      .pipe(tap((user) => this.store.setUser(user)));
  }

  register(credentials: RegisterCredentials): Observable<User> {
    return this.http
      .post<User>(`${AUTH_BASE}/register`, credentials, {
        context: authEndpointContext(),
      })
      .pipe(tap((user) => this.store.setUser(user)));
  }

  /** Récupère l'utilisateur courant via le cookie de session. */
  fetchMe(): Observable<User> {
    return this.http
      .post<User>(`${AUTH_BASE}/me`, {})
      .pipe(tap((user) => this.store.setUser(user)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${AUTH_BASE}/logout`, {}, { context: authEndpointContext() })
      .pipe(tap(() => this.store.clear()));
  }

  /**
   * Rafraîchit le couple de cookies de session via l'API. Le serveur lit le
   * cookie `refresh_token`, valide le jeton contre Redis, fait tourner le
   * refresh token et émet de nouveaux cookies httpOnly via `Set-Cookie`.
   * On ignore le corps `{ ok: true }` : seul le succès HTTP nous intéresse.
   */
  refresh(): Observable<void> {
    return this.http
      .post<{ ok: true }>(
        `${AUTH_BASE}/refresh`,
        {},
        { context: authEndpointContext() },
      )
      .pipe(map(() => undefined));
  }
}
