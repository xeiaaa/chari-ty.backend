import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User as UserEntity } from '../../../generated/prisma';

/**
 * AuthUser decorator to extract the authenticated user from the request
 * Can be used in controller methods to get the current authenticated user
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@AuthUser() user: UserEntity) {
 *   return user;
 * }
 *
 * @Get('user-id')
 * getUserId(@AuthUser('id') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const AuthUser = createParamDecorator(
  (data: keyof UserEntity | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.authUser;

    return data ? user?.[data] : user;
  },
);

/**
 * @deprecated Use @AuthUser instead
 * Legacy User decorator for backward compatibility
 */
export const User = AuthUser;
