// src/common/guards/fundraiser-access.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  GROUP_ROLES_KEY,
  GroupRolesMeta,
} from '../decorators/group-roles.decorator';
import { Request } from 'express';
import { Group, GroupMember, User } from 'generated/prisma';

interface GroupAccessGuardBody {
  groupId: string;
  [key: string]: any;
}

@Injectable()
export class GroupAccessGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request<any, any, GroupAccessGuardBody> & {
      authUser: User;
      group: Group;
      membership: GroupMember;
    } = context.switchToHttp().getRequest();
    const user = req.authUser;
    const groupId = req.body.groupId;

    if (!groupId) {
      throw new BadRequestException('Missing groupId in request body');
    }

    if (!user) {
      throw new ForbiddenException('Unauthorized access');
    }

    // Check group exists
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check membership
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Check roles if required
    const meta = this.reflector.get<GroupRolesMeta>(
      GROUP_ROLES_KEY,
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

    // Attach group and membership for controller access if needed
    req.group = group;
    req.membership = membership;

    return true;
  }
}
