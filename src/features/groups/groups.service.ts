import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Group } from '../../../generated/prisma';

/**
 * GroupsService handles all group-related database operations
 */
@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        Fundraiser: {
          where: {
            isPublic: true,
            status: 'published',
          },
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            category: true,
            goalAmount: true,
            currency: true,
            endDate: true,
            coverUrl: true,
            createdAt: true,
          },
        },
      },
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
      // fundraisers: group.Fundraiser,
    };
  }
}
