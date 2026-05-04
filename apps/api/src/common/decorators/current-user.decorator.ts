import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthUserWithRefresh,
  FastifyRequestWithUser,
} from '../types/auth.types';

type AuthUserKey = keyof AuthUserWithRefresh;

export const CurrentUser = createParamDecorator(
  (data: AuthUserKey | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequestWithUser>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    if (data) {
      return (user as AuthUserWithRefresh)[data];
    }

    return user;
  },
);
