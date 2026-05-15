import type { Request } from 'express';
import type { ActiveUserData } from './active-user-data.interface';

/**
 * Request Express enrichie avec l'utilisateur authentifié.
 *
 * NestJS / Express n'expose pas `request.user` par défaut. Plutôt que de
 * polluer la déclaration globale `Request` (qui demande un `.d.ts`
 * ambient correctement chargé par TS), on type ponctuellement les
 * requêtes consommées par les guards et les décorateurs IAM.
 */
export type AuthedRequest = Request & {
  user?: ActiveUserData;
};
