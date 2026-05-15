export enum AuthType {
  /** Authentification par cookie httpOnly contenant l'access token JWT. */
  Cookie,
  /** Endpoint public, aucun guard appliqué. */
  None,
}
