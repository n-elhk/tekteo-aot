import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Roles } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride(Roles, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Accès refusé : rôle requis ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
