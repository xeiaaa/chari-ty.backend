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
  FundraiserOwnerType,
} from '../../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { ListFundraisersDto } from './dtos/list-fundraisers.dto';
import { ListPublicFundraisersDto } from './dtos/list-public-fundraisers.dto';
import { UpdateFundraiserDto } from './dtos/update-fundraiser.dto';

@Injectable()
export class FundraisersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new fundraiser
   * Handles both user-owned and group-owned fundraisers
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
      coverUrl: data.coverUrl,
      galleryUrls: data.galleryUrls || [],
      ownerType: data.ownerType,
      status: FundraiserStatus.draft,
      isPublic: data.isPublic ?? false,
    } as const;

    if (data.ownerType === FundraiserOwnerType.group) {
      if (!data.groupId) {
        throw new BadRequestException(
          'Group ID is required for group-owned fundraisers',
        );
      }

      return await this.prisma.$transaction(async (tx) => {
        // Verify group exists
        const group = await tx.group.findUnique({
          where: { id: data.groupId },
        });

        if (!group) {
          throw new BadRequestException('Group not found');
        }

        const membership = await tx.groupMember.findUnique({
          where: {
            unique_user_group: {
              userId: user.id,
              groupId: data.groupId!,
            },
          },
        });

        if (
          !membership ||
          !['owner', 'admin', 'editor'].includes(membership.role)
        ) {
          throw new ForbiddenException(
            'You do not have permission to create fundraisers for this group',
          );
        }

        return await tx.fundraiser.create({
          data: { ...fundraiserData, groupId: data.groupId },
        });
      });
    }

    if (data.ownerType === FundraiserOwnerType.user) {
      // Verify user exists
      const userExists = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!userExists) {
        throw new BadRequestException('User not found');
      }

      return await this.prisma.fundraiser.create({
        data: { ...fundraiserData, userId: user.id },
      });
    }

    throw new BadRequestException('Invalid owner type');
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
  private async enhanceFundraisersWithProgress(fundraisers: any[]) {
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
    const whereConditions: Prisma.FundraiserWhereInput[] = [
      groupId
        ? { groupId, ownerType: FundraiserOwnerType.group }
        : { userId: user.id, ownerType: FundraiserOwnerType.user },
    ];

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
  async findOne(user: UserEntity, fundraiserId: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check if user has permission to view this fundraiser
    if (fundraiser.ownerType === FundraiserOwnerType.user) {
      if (fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to view this fundraiser',
        );
      }
    } else if (fundraiser.ownerType === FundraiserOwnerType.group) {
      const membership = await this.prisma.groupMember.findUnique({
        where: {
          unique_user_group: {
            userId: user.id,
            groupId: fundraiser.groupId!,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You do not have permission to view this fundraiser',
        );
      }
    }

    // Enhance with progress information
    const [enhancedFundraiser] = await this.enhanceFundraisersWithProgress([
      fundraiser,
    ]);
    return enhancedFundraiser;
  }

  /**
   * Get a single fundraiser by slug
   * Checks if the user has permission to view the fundraiser
   * Includes progress information
   */
  async findBySlug(user: UserEntity, slug: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { slug },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check if user has permission to view this fundraiser
    if (fundraiser.ownerType === FundraiserOwnerType.user) {
      if (fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to view this fundraiser',
        );
      }
    } else if (fundraiser.ownerType === FundraiserOwnerType.group) {
      const membership = await this.prisma.groupMember.findUnique({
        where: {
          unique_user_group: {
            userId: user.id,
            groupId: fundraiser.groupId!,
          },
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You do not have permission to view this fundraiser',
        );
      }
    }

    // Enhance with progress information
    const [enhancedFundraiser] = await this.enhanceFundraisersWithProgress([
      fundraiser,
    ]);
    return enhancedFundraiser;
  }

  /**
   * Update a fundraiser
   * Checks permissions based on owner type
   */
  async update(
    user: UserEntity,
    fundraiserId: string,
    data: UpdateFundraiserDto,
  ) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check permissions based on owner type
    if (fundraiser.ownerType === FundraiserOwnerType.user) {
      // For user-owned fundraisers, only the owner can update
      if (fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to update this fundraiser',
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
          'You do not have permission to update this fundraiser',
        );
      }
    }

    // Process the update data
    const updateData = {
      ...data,
      goalAmount: data.goalAmount
        ? new Decimal(data.goalAmount.toString())
        : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    };

    // Update the fundraiser
    return await this.prisma.fundraiser.update({
      where: { id: fundraiserId },
      data: updateData,
    });
  }

  /**
   * Delete a fundraiser
   * Only owners can delete user-owned fundraisers
   * Only admins and owners can delete group-owned fundraisers
   */
  async delete(user: UserEntity, fundraiserId: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check permissions based on owner type
    if (fundraiser.ownerType === FundraiserOwnerType.user) {
      // For user-owned fundraisers, only the owner can delete
      if (fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to delete this fundraiser',
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

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new ForbiddenException(
          'You do not have permission to delete this fundraiser',
        );
      }
    }

    // Delete the fundraiser
    await this.prisma.fundraiser.delete({
      where: { id: fundraiserId },
    });
  }

  /**
   * Get public fundraisers without authentication
   * Returns all public fundraisers with pagination
   * Includes progress information and owner details
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
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              username: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              slug: true,
            },
          },
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
   * Includes progress information and owner details
   */
  async findPublicBySlug(slug: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { slug },
      include: {
        milestones: {
          orderBy: { stepNumber: 'asc' },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            slug: true,
          },
        },
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
  async publish(user: UserEntity, fundraiserId: string, published: boolean) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check permissions based on owner type
    if (fundraiser.ownerType === FundraiserOwnerType.user) {
      // For user-owned fundraisers, only the owner can publish
      if (fundraiser.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to publish this fundraiser',
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
          'You do not have permission to publish this fundraiser',
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
}
