import type { Role } from '../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthUserWithRefresh extends AuthUser {
  refreshToken: string;
}

// declare module 'fastify' {
//   interface FastifyRequest {
//     user?: AuthUser | AuthUserWithRefresh;
//   }
// }

export interface FastifyRequestWithUser {
  user?: AuthUser | AuthUserWithRefresh;
}
