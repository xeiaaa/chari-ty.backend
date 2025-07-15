import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateFundraiserDto,
  FundraiserOwnerType,
} from './dtos/create-fundraiser.dto';
import { User as UserEntity } from '../../../generated/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { FundraiserStatus } from '../../../generated/prisma';

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
}
