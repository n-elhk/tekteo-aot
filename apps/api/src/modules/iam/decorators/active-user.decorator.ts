import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ActiveUserData } from '../interfaces/active-user-data.interface';
import type { AuthedRequest } from '../interfaces/authed-request.interface';

export const ActiveUser = createParamDecorator(
  (field: keyof ActiveUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
