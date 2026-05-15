import { HttpContextToken } from '@angular/common/http';

/**
 * Marque une requête comme ciblant l'API Tekteo (notre back NestJS).
 *
 * Posé par `authInterceptor` (qui est le point d'entrée du pipeline HTTP)
 * pour que les intercepteurs suivants n'aient pas à inspecter les URL.
 */
export const IS_TEKTEO = new HttpContextToken<boolean>(() => false);

/**
 * Marque une requête comme appelant un endpoint d'authentification
 * (login / register / refresh / logout) qui ne doit jamais déclencher
 * une tentative de refresh — sinon `/refresh` en échec boucle sur lui-même.
 *
 * Posé explicitement par `AuthService` sur les appels concernés.
 */
export const IS_AUTH_ENDPOINT = new HttpContextToken<boolean>(() => false);

/**
 * Marque une requête déjà rejouée après un refresh : si elle re-401,
 * l'erreur remonte sans nouvelle tentative (anti-boucle).
 */
export const ALREADY_RETRIED = new HttpContextToken<boolean>(() => false);
