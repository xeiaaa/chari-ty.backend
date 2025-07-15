import {
  Injectable,
  BadRequestException,
  ForbiddenException,
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

  async list(user: UserEntity, query: ListFundraisersDto) {
    const {
      groupId,
      status,
      category,
      search,
      isPublic,
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

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
