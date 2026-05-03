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

// Augment Express Request type so req.user is strongly typed everywhere
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser | AuthUserWithRefresh;
  }
}
