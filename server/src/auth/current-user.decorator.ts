import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUser } from './auth.service';

/** Injects the authenticated parent (set by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
