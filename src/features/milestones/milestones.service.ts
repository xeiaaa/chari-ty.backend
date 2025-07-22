import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMilestoneDto } from './dtos/create-milestone.dto';
import { UpdateMilestoneDto } from './dtos/update-milestone.dto';
import { User as UserEntity } from '../../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List milestones for a fundraiser
   * Checks permissions based on group membership
   */
  async list(user: UserEntity, fundraiserId: string) {
    // First, verify the fundraiser exists and user has permission
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check group membership
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: fundraiser.groupId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have permission to view milestones for this fundraiser',
      );
    }

    // Get all milestones for this fundraiser
    return await this.prisma.milestone.findMany({
      where: { fundraiserId },
      orderBy: { stepNumber: 'asc' },
    });
  }

  /**
   * Create a new milestone for a fundraiser
   * Checks permissions based on group membership
   */
  async create(
    user: UserEntity,
    fundraiserId: string,
    data: CreateMilestoneDto,
  ) {
    // First, verify the fundraiser exists and user has permission
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check group membership and role
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: fundraiser.groupId,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      throw new ForbiddenException(
        'You do not have permission to create milestones for this fundraiser',
      );
    }

    // Get the current highest step number
    const lastMilestone = await this.prisma.milestone.findFirst({
      where: { fundraiserId },
      orderBy: { stepNumber: 'desc' },
    });

    const nextStepNumber = (lastMilestone?.stepNumber ?? 0) + 1;

    // Create the milestone
    return await this.prisma.milestone.create({
      data: {
        fundraiserId,
        stepNumber: nextStepNumber,
        amount: new Decimal(data.amount.toString()),
        title: data.title,
        purpose: data.purpose,
        achieved: false, // Always start as not achieved
      },
    });
  }

  /**
   * Update a milestone
   * Only allows updates if milestone hasn't been achieved yet
   */
  async update(
    user: UserEntity,
    fundraiserId: string,
    milestoneId: string,
    data: UpdateMilestoneDto,
  ) {
    // First, verify the fundraiser and milestone exist
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { fundraiser: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.fundraiserId !== fundraiserId) {
      throw new BadRequestException(
        'Milestone does not belong to this fundraiser',
      );
    }

    if (milestone.achieved) {
      throw new BadRequestException('Cannot update an achieved milestone');
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
        'You do not have permission to update this milestone',
      );
    }

    // Update the milestone
    return await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(data.amount && { amount: new Decimal(data.amount.toString()) }),
        ...(data.title && { title: data.title }),
        ...(data.purpose && { purpose: data.purpose }),
      },
    });
  }

  /**
   * Delete a milestone
   * Only allows deletion if milestone hasn't been achieved yet
   */
  async delete(user: UserEntity, fundraiserId: string, milestoneId: string) {
    // First, verify the fundraiser and milestone exist
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { fundraiser: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.fundraiserId !== fundraiserId) {
      throw new BadRequestException(
        'Milestone does not belong to this fundraiser',
      );
    }

    if (milestone.achieved) {
      throw new BadRequestException('Cannot delete an achieved milestone');
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
        'You do not have permission to delete this milestone',
      );
    }

    // Delete the milestone
    await this.prisma.milestone.delete({
      where: { id: milestoneId },
    });
  }

  /**
   * Internal method to check and update milestone achievement status
   * This should be called whenever a donation is processed
   * Uses cumulative milestone amounts (milestone 1: $100, milestone 2: $200 = $300 total needed)
   */
  async checkAndUpdateAchievement(fundraiserId: string, totalAmount: Decimal) {
    // Get all milestones for this fundraiser ordered by step number
    const milestones = await this.prisma.milestone.findMany({
      where: { fundraiserId },
      orderBy: { stepNumber: 'asc' },
    });

    let cumulativeAmount = new Decimal(0);

    // Calculate cumulative amounts and update achievements
    for (const milestone of milestones) {
      cumulativeAmount = cumulativeAmount.add(milestone.amount);

      // Check if this milestone should be achieved
      const shouldBeAchieved = totalAmount.gte(cumulativeAmount);

      // Update milestone if status has changed
      if (shouldBeAchieved && !milestone.achieved) {
        await this.prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            achieved: true,
            achievedAt: new Date(),
          },
        });
      } else if (!shouldBeAchieved && milestone.achieved) {
        // Handle case where milestone was achieved but should no longer be
        // (e.g., if donation was refunded)
        await this.prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            achieved: false,
            achievedAt: null,
          },
        });
      }
    }
  }
}
