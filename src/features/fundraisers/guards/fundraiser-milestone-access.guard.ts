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
export class FundraiserMilestoneAccessGuard implements CanActivate {
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
    const fundraiser = req.fundraiser;
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

    if (milestone.fundraiserId !== fundraiser.id) {
      throw new BadRequestException(
        'Milestone does not belong to this fundraiser',
      );
    }

    req.milestone = milestone;

    return true;
  }
}
