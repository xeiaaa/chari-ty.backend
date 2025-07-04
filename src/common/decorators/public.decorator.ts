import { SetMetadata } from '@nestjs/common';

/**
 * Key used to identify public routes in metadata
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark routes or controllers as public
 * Public routes will bypass authentication and authorization
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * getHealth() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
