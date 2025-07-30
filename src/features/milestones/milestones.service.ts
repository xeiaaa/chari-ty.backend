import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreateMilestoneDto } from './dtos/create-milestone.dto';
import { UpdateMilestoneDto } from './dtos/update-milestone.dto';
import { CompleteMilestoneDto } from './dtos/complete-milestone.dto';
import { AddMilestoneUploadsDto } from './dtos/add-milestone-uploads.dto';
import { ReorderMilestoneUploadsDto } from './dtos/reorder-milestone-uploads.dto';
import { UpdateMilestoneUploadDto } from './dtos/update-milestone-upload.dto';
import { User as UserEntity } from '../../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

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
      include: {
        milestoneUploads: {
          include: {
            upload: true,
          },
        },
      },
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

    // Get all existing milestones to calculate total
    const existingMilestones = await this.prisma.milestone.findMany({
      where: { fundraiserId },
    });

    const existingTotal = existingMilestones.reduce(
      (sum, milestone) => sum.add(milestone.amount),
      new Decimal(0),
    );

    const newMilestoneAmount = new Decimal(data.amount.toString());
    const totalMilestoneAmount = existingTotal.add(newMilestoneAmount);

    // Get the current highest step number
    const lastMilestone = await this.prisma.milestone.findFirst({
      where: { fundraiserId },
      orderBy: { stepNumber: 'desc' },
    });

    const nextStepNumber = (lastMilestone?.stepNumber ?? 0) + 1;

    // Use a transaction to create milestone and update fundraiser goal if needed
    return await this.prisma.$transaction(async (tx) => {
      // Create the milestone
      const milestone = await tx.milestone.create({
        data: {
          fundraiserId,
          stepNumber: nextStepNumber,
          amount: newMilestoneAmount,
          title: data.title,
          purpose: data.purpose,
          achieved: false, // Always start as not achieved
        },
      });

      // Update fundraiser goal amount if total milestone amount exceeds current goal
      if (totalMilestoneAmount.gt(fundraiser.goalAmount)) {
        await tx.fundraiser.update({
          where: { id: fundraiserId },
          data: { goalAmount: totalMilestoneAmount },
        });
      }

      return milestone;
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

    // If amount is being updated, calculate new total and check fundraiser goal
    let totalMilestoneAmount: Decimal | undefined;
    if (data.amount !== undefined) {
      // Get all milestones for this fundraiser
      const allMilestones = await this.prisma.milestone.findMany({
        where: { fundraiserId },
      });

      // Calculate total excluding the current milestone being updated
      const otherMilestonesTotal = allMilestones
        .filter((m) => m.id !== milestoneId)
        .reduce((sum, m) => sum.add(m.amount), new Decimal(0));

      // Add the new milestone amount
      const newMilestoneAmount = new Decimal(data.amount.toString());
      totalMilestoneAmount = otherMilestonesTotal.add(newMilestoneAmount);
    }

    // Use a transaction to update milestone and fundraiser goal if needed
    return await this.prisma.$transaction(async (tx) => {
      // Update the milestone
      const updatedMilestone = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(data.amount && { amount: new Decimal(data.amount.toString()) }),
          ...(data.title && { title: data.title }),
          ...(data.purpose && { purpose: data.purpose }),
        },
      });

      // Update fundraiser goal amount if total milestone amount exceeds current goal
      if (
        totalMilestoneAmount &&
        totalMilestoneAmount.gt(milestone.fundraiser.goalAmount)
      ) {
        await tx.fundraiser.update({
          where: { id: fundraiserId },
          data: { goalAmount: totalMilestoneAmount },
        });
      }

      return updatedMilestone;
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

  /**
   * Add completion details and proof to a milestone
   * Allows adding details to achieved milestones
   */
  async complete(
    user: UserEntity,
    fundraiserId: string,
    milestoneId: string,
    data: CompleteMilestoneDto,
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

    if (!milestone.achieved) {
      throw new BadRequestException(
        'Cannot add details to a non-achieved milestone',
      );
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
        'You do not have permission to add details to this milestone',
      );
    }

    // Update the milestone with completion details
    return await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        completionDetails: data.completionDetails,
        proofUrls: data.proofUrls || [],
      },
    });
  }

  /**
   * Add uploads to a milestone
   * Creates Upload records and MilestoneUpload entries
   */
  async addMilestoneUploads(
    user: UserEntity,
    milestoneId: string,
    data: AddMilestoneUploadsDto,
  ) {
    // Verify milestone exists and user has permission
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
        'You do not have permission to add uploads to this milestone',
      );
    }

    // Create milestone upload items in transaction
    return await this.prisma.$transaction(async (tx) => {
      const milestoneUploadItems: any[] = [];

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];

        // Get Cloudinary resource by publicId
        const cloudinaryResource =
          await this.uploadsService.getResourceByPublicId(item.publicId);

        // Convert Cloudinary resource to CloudinaryAssetDto format
        const asset = {
          cloudinaryAssetId: cloudinaryResource.asset_id,
          publicId: cloudinaryResource.public_id,
          url: cloudinaryResource.secure_url,
          eagerUrl: cloudinaryResource.derived?.[0]?.secure_url,
          format: cloudinaryResource.format,
          resourceType: cloudinaryResource.resource_type,
          size: cloudinaryResource.bytes,
          pages: cloudinaryResource.derived?.[0]?.bytes || undefined,
          originalFilename: cloudinaryResource.display_name,
          uploadedAt: cloudinaryResource.created_at,
        };

        // Create upload record
        const upload = await this.uploadsService.createUpload(asset, user.id);

        // Create milestone upload item
        const milestoneUploadItem = await tx.milestoneUpload.create({
          data: {
            milestoneId,
            uploadId: upload.id,
            caption: item.caption,
            order: i, // Use array index as order
          },
          include: {
            upload: true,
          },
        });

        milestoneUploadItems.push(milestoneUploadItem);
      }

      return milestoneUploadItems;
    });
  }

  /**
   * Update a milestone upload caption
   */
  async updateMilestoneUpload(
    user: UserEntity,
    milestoneId: string,
    uploadItemId: string,
    data: UpdateMilestoneUploadDto,
  ) {
    // Verify milestone exists and user has permission
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
        'You do not have permission to update uploads for this milestone',
      );
    }

    // Verify upload item exists and belongs to this milestone
    const uploadItem = await this.prisma.milestoneUpload.findFirst({
      where: {
        id: uploadItemId,
        milestoneId,
      },
      include: {
        upload: true,
      },
    });

    if (!uploadItem) {
      throw new NotFoundException('Upload item not found');
    }

    // Update the upload item
    return await this.prisma.milestoneUpload.update({
      where: { id: uploadItemId },
      data: {
        caption: data.caption,
      },
      include: {
        upload: true,
      },
    });
  }

  /**
   * Delete a milestone upload
   */
  async deleteMilestoneUpload(
    user: UserEntity,
    milestoneId: string,
    uploadItemId: string,
  ) {
    // Verify milestone exists and user has permission
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
        'You do not have permission to delete uploads for this milestone',
      );
    }

    // Verify upload item exists and belongs to this milestone
    const uploadItem = await this.prisma.milestoneUpload.findFirst({
      where: {
        id: uploadItemId,
        milestoneId,
      },
      include: {
        upload: true,
      },
    });

    if (!uploadItem) {
      throw new NotFoundException('Upload item not found');
    }

    // Delete the Cloudinary resource
    await this.uploadsService.deleteCloudinaryResource(
      uploadItem.upload.publicId,
    );

    // Delete the upload item (this will also delete the upload due to cascade)
    await this.prisma.milestoneUpload.delete({
      where: { id: uploadItemId },
    });
  }

  /**
   * Reorder milestone uploads
   */
  async reorderMilestoneUploads(
    user: UserEntity,
    milestoneId: string,
    data: ReorderMilestoneUploadsDto,
  ) {
    // Verify milestone exists and user has permission
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
        'You do not have permission to reorder uploads for this milestone',
      );
    }

    // Verify all upload items exist and belong to this milestone
    const uploadItemIds = data.orderMap.map((item) => item.milestoneUploadId);
    const existingItems = await this.prisma.milestoneUpload.findMany({
      where: {
        id: { in: uploadItemIds },
        milestoneId,
      },
    });

    if (existingItems.length !== uploadItemIds.length) {
      throw new NotFoundException('One or more upload items not found');
    }

    // Update the order of all items in a transaction
    return await this.prisma.$transaction(async (tx) => {
      const updatedItems: any[] = [];

      for (const item of data.orderMap) {
        const updatedItem = await tx.milestoneUpload.update({
          where: { id: item.milestoneUploadId },
          data: { order: item.order },
          include: {
            upload: true,
          },
        });
        updatedItems.push(updatedItem);
      }

      return updatedItems;
    });
  }
}
