import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FundraisersService } from '../fundraisers/fundraisers.service';
import { Group } from '../../../generated/prisma';

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
}
