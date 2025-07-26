import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FundraisersService } from '../fundraisers/fundraisers.service';
import {
  Group,
  User as UserEntity,
  GroupMemberStatus,
} from '../../../generated/prisma';
import { UpdateGroupDto } from './dtos/update-group.dto';

/**
 * GroupsService handles all group-related database operations
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FundraisersService))
    private readonly fundraisersService: FundraisersService,
  ) {}

  /**
   * Find a group by slug
   */
  async findBySlug(slug: string): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { slug },
    });
  }

  /**
   * Get public group data by slug
   * Returns only non-private information
   */
  async findPublicBySlug(slug: string) {
    const group = await this.prisma.group.findUnique({
      where: { slug },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Return only public data
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      type: group.type,
      avatarUrl: group.avatarUrl,
      website: group.website,
      verified: group.verified,
      createdAt: group.createdAt,
    };
  }

  /**
   * Get public fundraisers for a group by slug
   * Returns paginated list of public fundraisers for the group
   */
  async getGroupFundraisers(slug: string, query: any) {
    // First verify the group exists
    const group = await this.prisma.group.findUnique({
      where: { slug },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Use the fundraisers service to get public fundraisers filtered by group
    return await this.fundraisersService.listPublic({
      ...query,
      groupId: group.id,
    });
  }

  /**
   * Find a group by ID
   */
  async findById(id: string): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { id },
    });
  }

  /**
   * Update the Stripe ID for a group
   */
  async updateStripeId(groupId: string, stripeId: string): Promise<Group> {
    return this.prisma.group.update({
      where: { id: groupId },
      data: { stripeId },
    });
  }

  /**
   * Get authenticated group by slug
   * Returns group data including stripeId for authenticated users who are members
   */
  async findAuthenticatedBySlug(
    user: UserEntity,
    slug: string,
  ): Promise<Group> {
    const group = await this.prisma.group.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: user.id,
            status: GroupMemberStatus.active,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is a member of the group
    if (group.members.length === 0) {
      throw new ForbiddenException('You do not have access to this group');
    }

    // Return the group with stripeId included
    return group;
  }

  /**
   * Update group by slug
   * Only group owners and admins can update the group
   */
  async updateBySlug(
    user: UserEntity,
    slug: string,
    updateData: UpdateGroupDto,
  ): Promise<Group> {
    const group = await this.prisma.group.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            userId: user.id,
            status: GroupMemberStatus.active,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is a member of the group
    if (group.members.length === 0) {
      throw new ForbiddenException('You do not have access to this group');
    }

    // Check if user has permission to update (owner or admin)
    const member = group.members[0];
    if (member.role !== 'owner' && member.role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to update this group',
      );
    }

    // Update the group
    return this.prisma.group.update({
      where: { slug },
      data: updateData,
    });
  }
}
