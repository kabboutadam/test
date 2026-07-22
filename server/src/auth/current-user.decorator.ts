import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { AuthUser } from './auth.service';

/** Injects the authenticated user (set by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);

/**
 * Injects the authenticated parent's id, rejecting driver tokens. Use on
 * parent-only endpoints so a driver token can't reach a parent's data.
 */
export const CurrentParent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    if (user.role !== 'parent') {
      throw new ForbiddenException('Parent account required');
    }
    return user.parentId;
  },
);
