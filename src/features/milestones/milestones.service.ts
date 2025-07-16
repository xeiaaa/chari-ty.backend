import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMilestoneDto } from './dtos/create-milestone.dto';
import { UpdateMilestoneDto } from './dtos/update-milestone.dto';
import {
  User as UserEntity,
  FundraiserOwnerType,
} from '../../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new milestone for a fundraiser
   * Checks permissions based on fundraiser ownership
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

    // Check permissions based on owner type
    if (fundraiser.ownerType === FundraiserOwnerType.user) {
      // For user-owned fundraisers, only the owner can create milestones
      if (fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to create milestones for this fundraiser',
        );
      }
    } else if (fundraiser.ownerType === FundraiserOwnerType.group) {
      // For group-owned fundraisers, check member role
      const membership = await this.prisma.groupMember.findUnique({
        where: {
          unique_user_group: {
            userId: user.id,
            groupId: fundraiser.groupId!,
          },
        },
      });

      if (!membership || membership.role === 'viewer') {
        throw new ForbiddenException(
          'You do not have permission to create milestones for this fundraiser',
        );
      }
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

    // Check permissions based on owner type
    if (milestone.fundraiser.ownerType === FundraiserOwnerType.user) {
      if (milestone.fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to update this milestone',
        );
      }
    } else if (milestone.fundraiser.ownerType === FundraiserOwnerType.group) {
      const membership = await this.prisma.groupMember.findUnique({
        where: {
          unique_user_group: {
            userId: user.id,
            groupId: milestone.fundraiser.groupId!,
          },
        },
      });

      if (!membership || membership.role === 'viewer') {
        throw new ForbiddenException(
          'You do not have permission to update this milestone',
        );
      }
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
   * Internal method to check and update milestone achievement status
   * This should be called whenever a donation is processed
   */
  async checkAndUpdateAchievement(
    fundraiserId: string,
    currentAmount: Decimal,
  ) {
    // Get all unachieved milestones for this fundraiser
    const milestones = await this.prisma.milestone.findMany({
      where: {
        fundraiserId,
        achieved: false,
      },
      orderBy: { amount: 'asc' },
    });

    // Update any milestones that have been achieved
    for (const milestone of milestones) {
      if (currentAmount.gte(milestone.amount)) {
        await this.prisma.milestone.update({
          where: { id: milestone.id },
          data: {
            achieved: true,
            achievedAt: new Date(),
          },
        });
      }
    }
  }
}
