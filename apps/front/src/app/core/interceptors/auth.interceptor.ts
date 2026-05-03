import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Force `withCredentials: true` sur toutes les requêtes vers l'API afin que
 * les cookies httpOnly d'authentification soient envoyés et reçus.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }
  return next(req.clone({ withCredentials: true }));
};

function isApiRequest(url: string): boolean {
  return url.startsWith('/api') || url.startsWith('api/');
}
