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

@Injectable()
export class FundraisersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new fundraiser
   * Handles both user-owned and group-owned fundraisers
   */
  async create(user: UserEntity, data: CreateFundraiserDto) {
    // Generate a unique slug from the title
    const slug = await this.generateUniqueSlug(data.title);

    // Prepare base fundraiser data
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
      status: 'draft',
      isPublic: data.isPublic ?? false,
    } as const;

    // Handle user-owned fundraiser
    if (data.ownerType === FundraiserOwnerType.user) {
      return await this.prisma.$transaction(async (tx) => {
        return await tx.fundraiser.create({
          data: {
            ...fundraiserData,
            user: { connect: { id: user.id } },
          },
        });
      });
    }
    // Handle group-owned fundraiser
    else if (data.ownerType === FundraiserOwnerType.group && data.groupId) {
      return await this.prisma.$transaction(async (tx) => {
        // Check if user is a member of the group with appropriate permissions
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
          data: {
            ...fundraiserData,
            group: { connect: { id: data.groupId } },
          },
        });
      });
    }

    throw new BadRequestException('Invalid owner type or missing group ID');
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
