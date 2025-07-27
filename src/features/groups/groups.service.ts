import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FundraisersService } from '../fundraisers/fundraisers.service';
import { ClerkService } from '../auth/clerk.service';
import {
  Group,
  User as UserEntity,
  GroupMemberStatus,
  GroupMemberRole,
} from '../../../generated/prisma';
import { UpdateGroupDto } from './dtos/update-group.dto';
import { CreateInviteDto } from './dtos/create-invite.dto';

/**
 * GroupsService handles all group-related database operations
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FundraisersService))
    private readonly fundraisersService: FundraisersService,
    private readonly clerkService: ClerkService,
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
    // This group is to check if the user is a member of the group
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

    const groupData = await this.prisma.group.findUnique({
      where: { slug },
      include: {
        members: {
          where: {
            groupId: group.id,
          },
          include: {
            user: true,
          },
        },
      },
    });

    if (!groupData) {
      throw new NotFoundException('Group not found');
    }

    // Return the group with stripeId included
    return groupData;
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

    console.log('group', group);

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

  /**
   * Invite a user to a group
   * Only group owners and admins can invite users
   */
  async inviteUser(
    user: UserEntity,
    groupId: string,
    inviteData: CreateInviteDto,
  ): Promise<{
    id: string;
    groupId: string;
    userId?: string;
    invitedEmail?: string;
    invitedName?: string;
    role: GroupMemberRole;
    status: GroupMemberStatus;
    createdAt: Date;
    invitationId?: string;
  }> {
    // Validate that either email or userId is provided, but not both
    if (!inviteData.email && !inviteData.userId) {
      throw new BadRequestException('Either email or userId must be provided');
    }
    if (inviteData.email && inviteData.userId) {
      throw new BadRequestException('Cannot provide both email and userId');
    }

    // Validate that role is not owner (this is already enforced by the DTO type)
    if (inviteData.role === ('owner' as any)) {
      throw new BadRequestException('Cannot invite users with owner role');
    }

    // Find the group and check if user has permission to invite
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
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

    // Check if user has permission to invite (owner or admin)
    const member = group.members[0];
    if (member.role !== 'owner' && member.role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to invite users to this group',
      );
    }

    // Check if the user is already a member or invited
    let existingMember;

    if (inviteData.userId) {
      // Check by userId
      existingMember = await this.prisma.groupMember.findFirst({
        where: {
          groupId,
          userId: inviteData.userId,
          status: {
            in: [GroupMemberStatus.active, GroupMemberStatus.invited],
          },
        },
      });
    } else if (inviteData.email) {
      // Check by email
      existingMember = await this.prisma.groupMember.findFirst({
        where: {
          groupId,
          invitedEmail: inviteData.email,
          status: {
            in: [GroupMemberStatus.active, GroupMemberStatus.invited],
          },
        },
      });
    }

    if (existingMember) {
      throw new ConflictException(
        'User is already a member or has been invited to this group',
      );
    }

    let invitationId: string | undefined;

    // If inviting by email, send Clerk invitation
    if (inviteData.email) {
      try {
        const invitation = await this.clerkService.inviteUser({
          email: inviteData.email,
          invitedByEmail: user.email,
          invitedByName: `${user.firstName} ${user.lastName}`,
          groupId: group.id,
          groupName: group.name,
          role: inviteData.role,
        });
        invitationId = invitation.id;
      } catch (error) {
        throw new BadRequestException(
          `Failed to send invitation email: ${error.message}`,
        );
      }
    }

    // Create the invitation record
    const invitation = await this.prisma.groupMember.create({
      data: {
        groupId,
        userId: inviteData.userId || null,
        invitedEmail: inviteData.email || null,
        role: inviteData.role,
        status: GroupMemberStatus.invited,
        invitationId,
      },
    });

    return {
      id: invitation.id,
      groupId: invitation.groupId,
      userId: invitation.userId || undefined,
      invitedEmail: invitation.invitedEmail || undefined,
      invitedName: invitation.invitedName || undefined,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      invitationId: invitation.invitationId || undefined,
    };
  }
}
