// src/common/guards/fundraiser-access.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  FUNDRAISER_ROLES_KEY,
  FundraiserRolesMeta,
} from '../decorators/fundraiser-roles.decorator';
import { Fundraiser, GroupMember, User } from 'generated/prisma';

@Injectable()
export class FundraiserAccessGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request & {
      fundraiser: Fundraiser;
      membership: GroupMember;
      authUser: User;
    } = context.switchToHttp().getRequest();
    const user = req.authUser;
    const fundraiserId = req.params.fundraiserId;

    if (!user || !fundraiserId) {
      throw new ForbiddenException('Unauthorized access');
    }

    // Step 1: Get fundraiser
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { group: true },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Step 2: Get group membership
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: fundraiser.groupId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this fundraiser');
    }

    // Step 3: (Optional) Check required roles from metadata
    const meta = this.reflector.get<FundraiserRolesMeta>(
      FUNDRAISER_ROLES_KEY,
      context.getHandler(),
    );

    const requiredRoles = meta?.roles ?? [];
    const customMessage = meta?.message;

    if (requiredRoles.length && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        customMessage ||
          `You need one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    // Attach fundraiser + membership to request (optional, for reuse in controller)
    req.fundraiser = fundraiser;
    req.membership = membership;

    return true;
  }
}
