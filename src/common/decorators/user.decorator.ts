import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * User decorator to extract the authenticated user from the request
 * Can be used in controller methods to get the current user
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@User() user: any) {
 *   return user;
 * }
 *
 * @Get('user-id')
 * getUserId(@User('sub') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
