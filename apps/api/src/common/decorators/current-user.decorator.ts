import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthUser,
  AuthUserWithRefresh,
} from '../types/auth.types';

type AuthUserKey = keyof AuthUserWithRefresh;

export const CurrentUser = createParamDecorator(
  (data: AuthUserKey | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as
      | AuthUser
      | AuthUserWithRefresh
      | undefined;

    if (!user) {
      return undefined;
    }

    if (data) {
      return (user as AuthUserWithRefresh)[data];
    }

    return user;
  },
);
