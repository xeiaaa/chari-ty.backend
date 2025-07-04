import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators';
import { ClerkService } from './clerk.service';
import { UsersService } from '../users/users.service';

/**
 * AuthGuard handles authentication for protected routes using Clerk
 * Routes marked with @Public() decorator will bypass authentication
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private clerkService: ClerkService,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    console.log('token', token);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      // Verify token with Clerk
      const payload = await this.clerkService.verifySessionToken(token);

      // Query database for actual user data
      const user = await this.usersService.findUserByClerkId(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      // Add user information to request object
      request.authUser = user;

      return true;
    } catch (error) {
      console.error('Auth guard error:', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
