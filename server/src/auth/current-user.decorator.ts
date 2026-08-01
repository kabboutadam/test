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
 * Injects the authenticated parent's id, rejecting non-parent tokens. Use on
 * parent-only endpoints so a driver/operator token can't reach a parent's data.
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

export interface OperatorContext {
  operatorId: string;
  schoolId: string;
}

/** Injects the authenticated operator (id + their school), rejecting others. */
export const CurrentOperator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OperatorContext => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    if (user.role !== 'operator') {
      throw new ForbiddenException('Operator account required');
    }
    return { operatorId: user.operatorId, schoolId: user.schoolId };
  },
);

/**
 * Asserts the caller is a platform super-admin. Use on /platform endpoints so
 * only the platform owner can create schools or provision school logins.
 */
export const CurrentSuperadmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { phone: string } => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    if (user.role !== 'superadmin') {
      throw new ForbiddenException('Platform admin account required');
    }
    return { phone: user.phone };
  },
);
