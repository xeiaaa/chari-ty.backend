import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from 'generated/prisma';

@Injectable()
export class AdminAccessGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request & { authUser: User } = context.switchToHttp().getRequest();
    const user = req.authUser;

    if (!user) {
      throw new ForbiddenException('Unauthorized access');
    }

    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
