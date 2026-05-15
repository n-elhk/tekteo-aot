import type { Role } from '../../../generated/prisma/client';

/**
 * Payload du JWT (access token) une fois vérifié.
 *
 * Inspiré du cours NestJS officiel : `sub` = identifiant utilisateur,
 * `email` et `role` permettent aux guards d'autorisation de fonctionner
 * sans aller-retour DB.
 */
export interface ActiveUserData {
  /** "Subject" du token : identifiant de l'utilisateur. */
  sub: string;

  /** Email de l'utilisateur. */
  email: string;

  /** Rôle de l'utilisateur (pour le `RolesGuard`). */
  role: Role;
}
