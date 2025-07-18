import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateLinkDto } from './dtos/create-link.dto';
import { UpdateLinkDto } from './dtos/update-link.dto';
import { ListLinksDto } from './dtos/list-links.dto';

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all links for a fundraiser
   */
  async getLinks(fundraiserId: string, userId: string, query?: ListLinksDto) {
    // Check if fundraiser exists and user has permission
    await this.validateFundraiserAccess(fundraiserId, userId);

    const whereClause: any = {
      fundraiserId,
    };

    if (query?.search) {
      whereClause.OR = [
        { alias: { contains: query.search, mode: 'insensitive' } },
        { note: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.fundraiserLink.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        alias: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get a specific link by ID
   */
  async getLinkById(fundraiserId: string, linkId: string, userId: string) {
    // Check if fundraiser exists and user has permission
    await this.validateFundraiserAccess(fundraiserId, userId);

    const link = await this.prisma.fundraiserLink.findFirst({
      where: {
        id: linkId,
        fundraiserId,
      },
      select: {
        id: true,
        alias: true,
        note: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    return link;
  }

  /**
   * Create a new link
   */
  async createLink(
    fundraiserId: string,
    userId: string,
    createLinkDto: CreateLinkDto,
  ) {
    // Check if fundraiser exists and user has permission to edit
    await this.validateFundraiserEditAccess(fundraiserId, userId);

    try {
      return await this.prisma.fundraiserLink.create({
        data: {
          fundraiserId,
          alias: createLinkDto.alias,
          note: createLinkDto.note,
        },
        select: {
          id: true,
          alias: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A link with this alias already exists for this fundraiser',
        );
      }
      throw error;
    }
  }

  /**
   * Update an existing link
   */
  async updateLink(
    fundraiserId: string,
    linkId: string,
    userId: string,
    updateLinkDto: UpdateLinkDto,
  ) {
    // Check if fundraiser exists and user has permission to edit
    await this.validateFundraiserEditAccess(fundraiserId, userId);

    // Check if link exists and belongs to the fundraiser
    const existingLink = await this.prisma.fundraiserLink.findFirst({
      where: {
        id: linkId,
        fundraiserId,
      },
    });

    if (!existingLink) {
      throw new NotFoundException('Link not found');
    }

    try {
      return await this.prisma.fundraiserLink.update({
        where: { id: linkId },
        data: updateLinkDto,
        select: {
          id: true,
          alias: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A link with this alias already exists for this fundraiser',
        );
      }
      throw error;
    }
  }

  /**
   * Delete a link
   */
  async deleteLink(fundraiserId: string, linkId: string, userId: string) {
    // Check if fundraiser exists and user has permission to edit
    await this.validateFundraiserEditAccess(fundraiserId, userId);

    // Check if link exists and belongs to the fundraiser
    const existingLink = await this.prisma.fundraiserLink.findFirst({
      where: {
        id: linkId,
        fundraiserId,
      },
    });

    if (!existingLink) {
      throw new NotFoundException('Link not found');
    }

    await this.prisma.fundraiserLink.delete({
      where: { id: linkId },
    });
  }

  /**
   * Validate that the fundraiser exists and user has read access
   */
  private async validateFundraiserAccess(fundraiserId: string, userId: string) {
    const fundraiser = await this.prisma.fundraiser.findUnique({
      where: { id: fundraiserId },
      include: {
        user: true,
        group: {
          include: {
            members: {
              where: { userId },
              include: { user: true },
            },
          },
        },
      },
    });

    if (!fundraiser) {
      throw new NotFoundException('Fundraiser not found');
    }

    // Check if user has access to this fundraiser
    const hasAccess =
      fundraiser.userId === userId || // Individual fundraiser owner
      (fundraiser.group && fundraiser.group.members.length > 0); // Group member

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this fundraiser');
    }

    return fundraiser;
  }

  /**
   * Validate that the fundraiser exists and user has edit access
   */
  private async validateFundraiserEditAccess(
    fundraiserId: string,
    userId: string,
  ) {
    const fundraiser = await this.validateFundraiserAccess(
      fundraiserId,
      userId,
    );

    // For individual fundraisers, only the owner can edit
    if (fundraiser.userId === userId) {
      return fundraiser;
    }

    // For group fundraisers, check if user has editor role or above
    if (fundraiser.group) {
      const membership = fundraiser.group.members[0];
      if (
        membership &&
        ['owner', 'admin', 'editor'].includes(membership.role)
      ) {
        return fundraiser;
      }
    }

    throw new ForbiddenException(
      'You do not have permission to edit links for this fundraiser',
    );
  }
}
