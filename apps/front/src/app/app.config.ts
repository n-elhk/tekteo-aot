import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { firstValueFrom } from 'rxjs';

import { appRoutes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

// Enregistre les données de localisation française pour les pipes
// (DatePipe, DecimalPipe, CurrencyPipe, etc.) afin qu'ils utilisent
// les noms de mois, jours et formats français.
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Hydrate l'utilisateur courant depuis le cookie httpOnly avant le
    // premier rendu : les guards de routes lisent un état déjà cohérent
    // avec le serveur. Un 401 (session absente / expirée) est silencieux.
    provideAppInitializer(() =>
      firstValueFrom(inject(AuthService).fetchMe()).catch(() => undefined),
    ),
  ],
};
