import { HttpInterceptorFn } from '@angular/common/http';
import { IS_TEKTEO } from './http-context.tokens';

/**
 * Point d'entrée du pipeline HTTP pour les appels API Tekteo.
 *
 * Identifie les requêtes destinées à notre back (préfixe `/api`) puis :
 * - force `withCredentials: true` afin que les cookies httpOnly d'auth
 *   soient envoyés/reçus ;
 * - pose le flag {@link IS_TEKTEO} dans le contexte, ce qui évite aux
 *   intercepteurs suivants (ex. {@link refreshInterceptor}) d'avoir à
 *   re-tester l'URL.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isTekteoApiUrl(req.url)) {
    return next(req);
  }
  return next(
    req.clone({
      withCredentials: true,
      context: req.context.set(IS_TEKTEO, true),
    }),
  );
};

function isTekteoApiUrl(url: string): boolean {
  return url.startsWith('/api') || url.startsWith('api/');
}
