import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import {
  ALREADY_RETRIED,
  IS_AUTH_ENDPOINT,
  IS_TEKTEO,
} from './http-context.tokens';

/**
 * Mutex partagé au niveau module : tant qu'un refresh est en vol,
 * toutes les requêtes 401 concurrentes s'abonnent au même sujet
 * plutôt que de relancer plusieurs `/auth/refresh` en parallèle.
 *
 * `null` signifie « aucun refresh en cours ».
 */
let refreshInFlight: Subject<void> | null = null;

/**
 * Intercepteur de rafraîchissement de session.
 *
 * Sur un 401 d'une requête API Tekteo (hors endpoints d'auth), déclenche
 * un `POST /api/auth/refresh` puis rejoue la requête une seule fois.
 * Les cookies httpOnly sont automatiquement renouvelés par le navigateur
 * via les en-têtes `Set-Cookie` de la réponse de refresh.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  // Filtres en amont via le contexte HTTP — aucune logique d'URL ici.
  if (!req.context.get(IS_TEKTEO)) {
    return next(req);
  }
  if (req.context.get(IS_AUTH_ENDPOINT)) {
    return next(req);
  }
  if (req.context.get(ALREADY_RETRIED)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return handle401(req, next, error);
    }),
  );
};

/**
 * Coordonne le refresh : soit on attend celui déjà en cours, soit on
 * en démarre un nouveau et on partage son résultat avec les autres
 * requêtes 401-ées.
 */
function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  originalError: HttpErrorResponse,
): Observable<HttpEvent<unknown>> {
  const auth = inject(AuthService);
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Si un refresh est déjà en cours, on attend simplement son issue
  // avant de rejouer la requête courante (une seule fois).
  if (refreshInFlight !== null) {
    return refreshInFlight.pipe(switchMap(() => next(retryRequest(req))));
  }

  // Sinon, on déclenche le refresh et on partage son résultat.
  const gate = new Subject<void>();
  refreshInFlight = gate;

  return auth.refresh().pipe(
    switchMap(() => {
      refreshInFlight = null;
      gate.next();
      gate.complete();
      return next(retryRequest(req));
    }),
    catchError((refreshError: unknown) => {
      // Le refresh a échoué : on libère le mutex en signalant l'erreur
      // aux requêtes en attente, on nettoie l'état local et on renvoie
      // vers la page de connexion en mémorisant l'URL d'origine.
      refreshInFlight = null;
      gate.error(refreshError);
      authStore.clear();
      const redirectTo = router.url;
      void router.navigate(['/login'], {
        queryParams:
          redirectTo && redirectTo !== '/login' ? { redirectTo } : undefined,
      });
      // On propage l'erreur 401 initiale pour que l'appelant sache que
      // la requête métier a bien échoué.
      return throwError(() => originalError);
    }),
  );
}

/**
 * Clone la requête en marquant le contexte « déjà rejouée » pour casser
 * toute boucle éventuelle.
 */
function retryRequest(req: HttpRequest<unknown>): HttpRequest<unknown> {
  return req.clone({ context: req.context.set(ALREADY_RETRIED, true) });
}
