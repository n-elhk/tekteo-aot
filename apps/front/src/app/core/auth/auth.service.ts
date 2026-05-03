import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthStore } from './auth.store';
import { LoginCredentials, RegisterCredentials, User } from './user.model';

const AUTH_BASE = '/api/auth';

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
      .post<User>(`${AUTH_BASE}/login`, credentials)
      .pipe(tap((user) => this.store.setUser(user)));
  }

  register(credentials: RegisterCredentials): Observable<User> {
    return this.http
      .post<User>(`${AUTH_BASE}/register`, credentials)
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
      .post<void>(`${AUTH_BASE}/logout`, {})
      .pipe(tap(() => this.store.clear()));
  }
}
