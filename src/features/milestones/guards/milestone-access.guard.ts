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
import { Request } from 'express';
import { Fundraiser, Milestone, User } from '../../../../generated/prisma';

@Injectable()
export class MilestoneAccessGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request & {
      authUser: User;
      fundraiser: Fundraiser;
      milestone: Milestone;
    } = context.switchToHttp().getRequest();
    const user = req.authUser;
    const milestoneId = req.params.milestoneId;

    if (!milestoneId) {
      throw new BadRequestException('Missing milestoneId in request params');
    }

    if (!user) {
      throw new ForbiddenException('Unauthorized access');
    }

    // First, verify the fundraiser and milestone exist
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { fundraiser: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    // Check group membership and role
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: milestone.fundraiser.groupId,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      throw new ForbiddenException(
        'You do not have permission to access this milestone',
      );
    }

    req.milestone = milestone;

    return true;
  }
}
