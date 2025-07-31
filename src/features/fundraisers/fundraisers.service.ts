import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFundraiserDto } from './dtos/create-fundraiser.dto';
import {
  User as UserEntity,
  FundraiserStatus,
  Prisma,
  Fundraiser,
  Upload,
  FundraiserGallery,
} from '../../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { ListFundraisersDto } from './dtos/list-fundraisers.dto';
import { ListPublicFundraisersDto } from './dtos/list-public-fundraisers.dto';
import { UpdateFundraiserDto } from './dtos/update-fundraiser.dto';
import { AddGalleryItemsDto } from './dtos/add-gallery-items.dto';
import { UpdateGalleryItemDto } from './dtos/update-gallery-item.dto';
import { ReorderGalleryItemsDto } from './dtos/reorder-gallery-items.dto';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class FundraisersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * Create a new fundraiser
   * All fundraisers now belong to groups
   */
  async create(user: UserEntity, data: CreateFundraiserDto) {
    const slug = await this.generateUniqueSlug(data.title);

    const fundraiserData = {
      slug,
      title: data.title,
      summary: data.summary,
      description: data.description,
      category: data.category,
      goalAmount: new Decimal(data.goalAmount.toString()),
      currency: data.currency,
      endDate: data.endDate ? new Date(data.endDate) : null,
      galleryUrls: data.galleryUrls || [],
      status: FundraiserStatus.draft,
      isPublic: data.isPublic ?? false,
    } as const;

    if (!data.groupId) {
      throw new BadRequestException('Group ID is required');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Handle cover upload if coverPublicId is provided
      let coverId: string | undefined;
      if (data.coverPublicId) {
        // Get Cloudinary resource by publicId
        const cloudinaryResource =
          await this.uploadsService.getResourceByPublicId(data.coverPublicId);

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
        coverId = upload.id;
      }

      const createData: Prisma.FundraiserCreateInput = {
        ...fundraiserData,
        group: {
          connect: {
            id: data.groupId,
          },
        },
      };

      if (coverId) {
        createData.cover = {
          connect: {
            id: coverId,
          },
        };
      }

      return await tx.fundraiser.create({
        data: createData,
      });
    });
  }

  /**
   * Generate a unique URL-friendly slug from a title
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    // Convert title to lowercase and replace spaces/special chars with hyphens
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug exists
    const existing = await this.prisma.fundraiser.findUnique({
      where: { slug },
    });

    // If slug exists, append a random string
    if (existing) {
      const randomStr = Math.random().toString(36).substring(2, 8);
      slug = `${slug}-${randomStr}`;
    }

    return slug;
  }

  /**
   * Calculate progress information for a fundraiser
   */
  private async calculateFundraiserProgress(fundraiserId: string) {
    const [totalRaised, donationCount] = await Promise.all([
      this.prisma.donation.aggregate({
        where: {
          fundraiserId,
          status: 'completed',
        },
        _sum: { amount: true },
      }),
      this.prisma.donation.count({
        where: {
          fundraiserId,
          status: 'completed',
        },
      }),
    ]);

    const totalRaisedAmount = totalRaised._sum.amount || new Decimal(0);

    return {
      totalRaised: totalRaisedAmount,
      donationCount,
    };
  }

  /**
   * Enhance fundraisers with progress information
   */
  private async enhanceFundraisersWithProgress(
    fundraisers: (Fundraiser & { goalAmount: Decimal })[],
  ): Promise<
    (Fundraiser & {
      progress: {
        totalRaised: Decimal;
        donationCount: number;
        progressPercentage: number;
      };
    })[]
  > {
    return await Promise.all(
      fundraisers.map(async (fundraiser) => {
        const progress = await this.calculateFundraiserProgress(fundraiser.id);
        const progressPercentage = fundraiser.goalAmount.gt(0)
          ? progress.totalRaised.div(fundraiser.goalAmount).mul(100).toNumber()
          : 0;

        return {
          ...fundraiser,
          progress: {
            totalRaised: progress.totalRaised,
            donationCount: progress.donationCount,
            progressPercentage: Math.min(progressPercentage, 100), // Cap at 100%
          },
        };
      }),
    );
  }

  /**
   * List fundraisers with filters and pagination
   * Includes progress information for each fundraiser
   */
  async list(user: UserEntity, query: ListFundraisersDto) {
    const {
      groupId,
      status,
      category,
      isPublic,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 10,
      page = 1,
    } = query;

    // Build where conditions
    const whereConditions: Prisma.FundraiserWhereInput[] = [];

    if (groupId) {
      whereConditions.push({ groupId });
    } else {
      // If no groupId specified, get fundraisers from all groups user is a member of
      const userGroups = await this.prisma.groupMember.findMany({
        where: { userId: user.id },
        select: { groupId: true },
      });
      const groupIds = userGroups.map((gm) => gm.groupId);
      whereConditions.push({ groupId: { in: groupIds } });
    }

    if (status) whereConditions.push({ status });
    if (category) whereConditions.push({ category });
    if (isPublic !== undefined) whereConditions.push({ isPublic });
    if (search) {
      whereConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.FundraiserWhereInput = { AND: whereConditions };

    // If groupId is provided, verify user has access
    if (groupId) {
      const membership = await this.prisma.groupMember.findUnique({
        where: {
          unique_user_group: {
            userId: user.id,
            groupId,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You do not have permission to view fundraisers for this group',
        );
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.fundraiser.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cover: true,
        },
      }),
      this.prisma.fundraiser.count({ where }),
    ]);

    // Enhance fundraisers with progress information
    const enhancedItems = await this.enhanceFundraisersWithProgress(items);

    return {
      items: enhancedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single fundraiser by ID
   * Checks if the user has permission to view the fundraiser
   * Includes progress information
   */
  async findOne(fundraiserId: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: {
        fundraiserGallery: {
          include: {
            upload: true,
          },
        },
        cover: true,
      },
    });
    // Enhance with progress information
    const [enhancedFundraiser] = await this.enhanceFundraisersWithProgress([
      fundraiser!,
    ]);
    return enhancedFundraiser;
  }

  /**
   * Get a single fundraiser by slug
   * Checks if the user has permission to view the fundraiser
   * Includes progress information
   */
  async findBySlug(slug: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { slug },
      include: {
        fundraiserGallery: {
          include: {
            upload: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        cover: true,
      },
    });

    // Enhance with progress information
    const [enhancedFundraiser] = await this.enhanceFundraisersWithProgress([
      fundraiser!,
    ]);
    return enhancedFundraiser;
  }

  /**
   * Update a fundraiser
   * Checks permissions based on group membership
   */
  async update(
    user: UserEntity,
    fundraiserId: string,
    data: UpdateFundraiserDto,
  ) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { cover: true },
    });

    if (!fundraiser) {
      // Should never happen if the guard runs
      throw new Error('Unreachable: fundraiser must exist due to guard');
    }

    // If goalAmount is being updated, check against total milestone amount
    if (data.goalAmount !== undefined) {
      const newGoalAmount = new Decimal(data.goalAmount.toString());

      // Get all milestones for this fundraiser
      const milestones = await this.prisma.milestone.findMany({
        where: { fundraiserId },
      });

      // Calculate total milestone amount
      const totalMilestoneAmount = milestones.reduce(
        (sum, milestone) => sum.add(milestone.amount),
        new Decimal(0),
      );

      // Reject update if new goal amount is less than total milestone amount
      if (newGoalAmount.lt(totalMilestoneAmount)) {
        throw new BadRequestException(
          `Goal amount cannot be less than the total milestone amount (${totalMilestoneAmount.toString()})`,
        );
      }
    }

    // Handle cover upload if coverPublicId is provided
    let coverId: string | undefined;
    if (data.coverPublicId) {
      // Check if the coverPublicId is the same as the current cover
      // This optimization prevents unnecessary Cloudinary API calls and upload record creation
      if (fundraiser.cover?.publicId === data.coverPublicId) {
        // Cover hasn't changed, keep the existing coverId
        coverId = fundraiser.coverId || undefined;
      } else {
        // Cover has changed, process the new upload
        // Get Cloudinary resource by publicId
        const cloudinaryResource =
          await this.uploadsService.getResourceByPublicId(data.coverPublicId);

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
        coverId = upload.id;
      }
    }

    // Handle cover removal if removeCover is true
    if (data.removeCover) {
      coverId = undefined;
    }

    // Update the fundraiser
    return await this.prisma.fundraiser.update({
      where: { id: fundraiserId },
      data: {
        title: data.title,
        summary: data.summary,
        description: data.description,
        category: data.category,
        goalAmount: data.goalAmount
          ? new Decimal(data.goalAmount.toString())
          : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        coverId: data.removeCover ? null : coverId,
        currency: data.currency,
        isPublic: data.isPublic,
      },
    });
  }

  /**
   * Delete a fundraiser
   * Only admins and owners can delete fundraisers
   */
  async delete(fundraiserId: string) {
    // Delete the fundraiser
    await this.prisma.fundraiser.delete({
      where: { id: fundraiserId },
    });
  }

  /**
   * Get public fundraisers without authentication
   * Returns all public fundraisers with pagination
   * Includes progress information and group details
   */
  async listPublic(query: ListPublicFundraisersDto) {
    const {
      groupId,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 10,
      page = 1,
    } = query;

    // Build where conditions - only show public and published fundraisers
    const whereConditions: Prisma.FundraiserWhereInput[] = [
      { isPublic: true },
      { status: FundraiserStatus.published },
    ];

    if (groupId) whereConditions.push({ groupId });
    if (category) whereConditions.push({ category });
    if (search) {
      whereConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.FundraiserWhereInput = { AND: whereConditions };

    const [items, total] = await Promise.all([
      this.prisma.fundraiser.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
              type: true,
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          fundraiserGallery: {
            include: {
              upload: true,
            },
          },
          cover: true,
        },
      }),
      this.prisma.fundraiser.count({ where }),
    ]);

    // Enhance fundraisers with progress information
    const enhancedItems = await this.enhanceFundraisersWithProgress(items);

    return {
      items: enhancedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single public fundraiser by slug without authentication
   * Only returns public fundraisers
   * Includes progress information and group details
   */
  async findPublicBySlug(slug: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { slug },
      include: {
        milestones: {
          orderBy: { stepNumber: 'asc' },
        },
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            slug: true,
          },
        },
        fundraiserGallery: {
          include: {
            upload: true,
          },
        },
        cover: true,
      },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Only return public and published fundraisers
    if (
      !fundraiser.isPublic ||
      fundraiser.status !== FundraiserStatus.published
    ) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Enhance with progress information
    const [enhancedFundraiser] = await this.enhanceFundraisersWithProgress([
      fundraiser,
    ]);
    return enhancedFundraiser;
  }

  /**
   * Publish or unpublish a fundraiser
   * Updates status to 'published' or 'draft' based on the published parameter
   */
  async publish(fundraiserId: string, published: boolean) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { group: true },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // If trying to publish, check if group has Stripe connected
    if (published && !fundraiser.group.stripeId) {
      throw new BadRequestException(
        'Cannot publish fundraiser: Group must be connected to Stripe to accept donations',
      );
    }

    // If trying to unpublish, check if fundraiser has any completed or pending donations
    if (!published) {
      const donationCount = await this.prisma.donation.count({
        where: {
          fundraiserId,
          status: { in: ['completed', 'pending'] },
        },
      });

      if (donationCount > 0) {
        throw new BadRequestException(
          'Cannot unpublish fundraiser: Fundraiser has received donations and cannot be unpublished',
        );
      }
    }

    // Update the fundraiser status
    const status = published
      ? FundraiserStatus.published
      : FundraiserStatus.draft;

    return await this.prisma.fundraiser.update({
      where: { id: fundraiserId },
      data: { status },
    });
  }

  /**
   * Add gallery items to a fundraiser
   * Creates Upload records and FundraiserGallery entries
   */
  async addGalleryItems(
    user: UserEntity,
    fundraiserId: string,
    data: AddGalleryItemsDto,
  ) {
    // Verify fundraiser exists and user has permission
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { group: true },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Create gallery items in transaction
    return await this.prisma.$transaction(async (tx) => {
      const galleryItems: (FundraiserGallery & {
        upload: Upload;
      })[] = [];

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

        // Create gallery item
        const galleryItem = await tx.fundraiserGallery.create({
          data: {
            fundraiserId,
            uploadId: upload.id,
            caption: item.caption,
            order: i, // Use array index as order
          },
          include: {
            upload: true,
          },
        });

        galleryItems.push(galleryItem);
      }

      return galleryItems;
    });
  }

  /**
   * Update a gallery item caption
   */
  async updateGalleryItem(
    fundraiserId: string,
    galleryItemId: string,
    data: UpdateGalleryItemDto,
  ) {
    // Verify fundraiser exists and user has permission
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { group: true },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Verify gallery item exists and belongs to this fundraiser
    const galleryItem = await this.prisma.fundraiserGallery.findFirst({
      where: {
        id: galleryItemId,
        fundraiserId,
      },
      include: {
        upload: true,
      },
    });

    if (!galleryItem) {
      throw new NotFoundException('Gallery item not found');
    }

    // Update the gallery item
    return await this.prisma.fundraiserGallery.update({
      where: { id: galleryItemId },
      data: {
        caption: data.caption,
      },
      include: {
        upload: true,
      },
    });
  }

  /**
   * Delete a gallery item
   */
  async deleteGalleryItem(fundraiserId: string, galleryItemId: string) {
    // Verify fundraiser exists and user has permission
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { group: true },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Verify gallery item exists and belongs to this fundraiser
    const galleryItem = await this.prisma.fundraiserGallery.findFirst({
      where: {
        id: galleryItemId,
        fundraiserId,
      },
      include: {
        upload: true,
      },
    });

    if (!galleryItem) {
      throw new NotFoundException('Gallery item not found');
    }

    // Delete the Cloudinary resource
    await this.uploadsService.deleteCloudinaryResource(
      galleryItem.upload.publicId,
    );

    // Delete the gallery item (this will also delete the upload due to cascade)
    await this.prisma.fundraiserGallery.delete({
      where: { id: galleryItemId },
    });
  }

  /**
   * Reorder gallery items
   */
  async reorderGalleryItems(
    fundraiserId: string,
    data: ReorderGalleryItemsDto,
  ) {
    // Verify fundraiser exists and user has permission
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: { group: true },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Verify all gallery items exist and belong to this fundraiser
    const galleryItemIds = data.orderMap.map(
      (item) => item.fundraiserGalleryId,
    );
    const existingItems = await this.prisma.fundraiserGallery.findMany({
      where: {
        id: { in: galleryItemIds },
        fundraiserId,
      },
    });

    if (existingItems.length !== galleryItemIds.length) {
      throw new NotFoundException('One or more gallery items not found');
    }

    // Update the order of all items in a transaction
    return await this.prisma.$transaction(async (tx) => {
      const updatedItems: FundraiserGallery[] = [];

      for (const item of data.orderMap) {
        const updatedItem = await tx.fundraiserGallery.update({
          where: { id: item.fundraiserGalleryId },
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
