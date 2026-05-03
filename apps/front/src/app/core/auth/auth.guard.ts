import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * Garde de route exigeant un utilisateur authentifié.
 * Redirige vers `/login` si la session est absente.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { redirectTo: state.url },
  });
};

/**
 * Garde supplémentaire imposant le rôle administrateur.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};
