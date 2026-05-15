import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  defer,
  finalize,
  map,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import {
  ALREADY_RETRIED,
  IS_AUTH_ENDPOINT,
  IS_TEKTEO,
} from './http-context.tokens';

/**
 * Observable de refresh partagé entre toutes les requêtes 401 concurrentes.
 *
 * `null` quand aucun refresh n'est en cours. Sinon, on est dans la fenêtre
 * entre la première 401 et la résolution de `/auth/refresh` : tout nouveau
 * 401 s'abonne à ce même observable plutôt que de relancer un refresh.
 */
let refreshInFlight$: Observable<void> | null = null;

/**
 * Intercepteur de rafraîchissement de session.
 *
 * Sur un 401 d'une requête API Tekteo (hors endpoints d'auth), déclenche un
 * `POST /api/auth/refresh` puis rejoue la requête une seule fois. Les
 * cookies httpOnly sont automatiquement renouvelés par le navigateur via
 * les en-têtes `Set-Cookie` de la réponse de refresh.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (shouldBypassRefresh(req)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }
      return handle401(req, next, error, auth, authStore, router);
    }),
  );
};

/**
 * Coordonne le refresh puis le rejeu d'une requête 401-ée.
 *
 * L'ordre `catchError` → `switchMap` est intentionnel : seules les erreurs
 * du refresh sont remappées vers la 401 d'origine. Une erreur du rejeu
 * (par ex. un 500 sur la route métier) doit remonter telle quelle.
 */
function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  originalError: HttpErrorResponse,
  auth: AuthService,
  authStore: AuthStore,
  router: Router,
) {
  return refreshOnce(auth, authStore, router).pipe(
    // Si le refresh échoue, on propage la 401 métier initiale plutôt que
    // l'erreur du /refresh — l'appelant attend une réponse à SA requête.
    catchError(() => throwError(() => originalError)),
    switchMap(() => next(retryRequest(req))),
  );
}

/**
 * Renvoie l'observable de refresh partagé : la première souscription
 * déclenche `auth.refresh()`, les suivantes (pendant que le refresh est
 * en vol) reçoivent le même résultat via `shareReplay`.
 *
 * `refCount: false` garde le résultat en cache même si tous les abonnés
 * se désabonnent transitoirement — le `finalize` est la seule chose qui
 * libère réellement le mutex en remettant `refreshInFlight$` à `null`.
 */
function refreshOnce(
  auth: AuthService,
  authStore: AuthStore,
  router: Router,
): Observable<void> {
  if (refreshInFlight$ === null) {
    refreshInFlight$ = defer(() => auth.refresh()).pipe(
      map(() => undefined),

      // Placé AVANT shareReplay : les effets de bord (purge store +
      // redirection) ne s'exécutent qu'une seule fois au niveau source,
      // pas une fois par requête en attente.
      tap({
        error: () => failSession(authStore, router),
      }),

      // Libère le mutex que le refresh ait réussi ou échoué.
      finalize(() => {
        refreshInFlight$ = null;
      }),

      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  return refreshInFlight$;
}

/**
 * Filtres en amont basés uniquement sur le contexte HTTP (zéro logique
 * d'URL ici, c'est le rôle de `authInterceptor` de poser `IS_TEKTEO`).
 */
function shouldBypassRefresh(req: HttpRequest<unknown>): boolean {
  return (
    !req.context.get(IS_TEKTEO) ||
    req.context.get(IS_AUTH_ENDPOINT) ||
    req.context.get(ALREADY_RETRIED)
  );
}

function isUnauthorized(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 401;
}

/**
 * Clone la requête en marquant le contexte « déjà rejouée » : si elle
 * re-401, le `shouldBypassRefresh` la laissera passer sans déclencher
 * un nouveau refresh (anti-boucle).
 */
function retryRequest(req: HttpRequest<unknown>): HttpRequest<unknown> {
  return req.clone({
    context: req.context.set(ALREADY_RETRIED, true),
  });
}

/**
 * Le refresh a échoué : on nettoie l'état local et on renvoie vers la
 * page de connexion en mémorisant l'URL d'origine pour reprise après
 * re-login.
 */
function failSession(authStore: AuthStore, router: Router): void {
  authStore.clear();

  const redirectTo = router.url;
  void router.navigate(['/login'], {
    queryParams:
      redirectTo && redirectTo !== '/login' ? { redirectTo } : undefined,
  });
}
