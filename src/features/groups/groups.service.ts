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
import { CreateGroupDto } from './dtos/create-group.dto';
import { DashboardDto } from './dtos/dashboard.dto';

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
   * Create a new group
   */
  async createGroup(
    user: UserEntity,
    createGroupDto: CreateGroupDto,
  ): Promise<{ group: Group; groupMember: any }> {
    // Validate that user has completed setup
    if (!user.setupComplete) {
      throw new BadRequestException(
        'User must complete onboarding before creating groups',
      );
    }

    // Validate EIN is provided for nonprofit type
    if (createGroupDto.type === 'nonprofit' && !createGroupDto.ein) {
      throw new BadRequestException('EIN is required for nonprofit groups');
    }

    // Generate unique slug for the group
    const groupSlug = await this.generateUniqueGroupSlug(createGroupDto.name);

    // Use transaction to ensure data consistency
    const result = await this.prisma.$transaction(async (prisma) => {
      // Create group
      const group = await prisma.group.create({
        data: {
          name: createGroupDto.name,
          slug: groupSlug,
          description: createGroupDto.description,
          type: createGroupDto.type,
          website: createGroupDto.website,
          ein: createGroupDto.ein,
          avatarUrl: createGroupDto.avatarUrl,
          documentsUrls: createGroupDto.documentsUrls || [],
          verified: false,
          ownerId: user.id,
        },
      });

      // Add user as owner of the group
      const groupMember = await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: 'owner',
          status: 'active',
        },
      });

      return { group, groupMember };
    });

    return result;
  }

  /**
   * Generate a unique URL-friendly slug from a group name
   */
  private async generateUniqueGroupSlug(name: string): Promise<string> {
    // Convert name to lowercase and replace spaces/special chars with hyphens
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Check if slug exists
    const existing = await this.prisma.group.findUnique({
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
   * Update the Stripe ID for a group
   */
  async updateStripeId(
    groupId: string,
    stripeId: string | null,
  ): Promise<Group> {
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
          orderBy: {
            joinedAt: 'asc',
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

  /**
   * Update a group member's role
   * Only owners and admins can update member roles
   */
  async updateMemberRole(
    user: UserEntity,
    groupId: string,
    memberId: string,
    newRole: Exclude<GroupMemberRole, 'owner'>,
  ): Promise<{
    id: string;
    userId: string;
    groupId: string;
    role: GroupMemberRole;
    status: GroupMemberStatus;
    updatedAt: Date;
  }> {
    // Find the group and check if user has permission
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

    const currentUserMember = group.members[0];

    // Check if user has permission to update roles
    if (
      currentUserMember.role === 'editor' ||
      currentUserMember.role === 'viewer'
    ) {
      throw new ForbiddenException(
        'You do not have permission to update member roles',
      );
    }

    // Find the member to be updated
    const memberToUpdate = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!memberToUpdate) {
      throw new NotFoundException('Member not found');
    }

    // Check if the member belongs to the specified group
    if (memberToUpdate.groupId !== groupId) {
      throw new NotFoundException('Member not found in this group');
    }

    // Check if trying to update the current user
    if (memberToUpdate.userId === user.id) {
      throw new BadRequestException('Cannot update your own role');
    }

    // Check if the member is active
    if (memberToUpdate.status !== GroupMemberStatus.active) {
      throw new BadRequestException('Can only update active members');
    }

    // Role-based permission checks
    if (currentUserMember.role === 'owner') {
      // Owner can change any role except owner
      if (memberToUpdate.role === 'owner') {
        throw new ForbiddenException('Cannot change owner role');
      }
    } else if (currentUserMember.role === 'admin') {
      // Admin can only change editor/viewer roles
      if (memberToUpdate.role === 'owner' || memberToUpdate.role === 'admin') {
        throw new ForbiddenException(
          'Admins can only change editor and viewer roles',
        );
      }
    }

    // Update the member's role
    const updatedMember = await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    return {
      id: updatedMember.id,
      userId: updatedMember.userId!,
      groupId: updatedMember.groupId,
      role: updatedMember.role,
      status: updatedMember.status,
      updatedAt: updatedMember.updatedAt,
    };
  }

  /**
   * Remove a member from a group
   * Only owners and admins can remove members
   */
  async removeMember(
    user: UserEntity,
    groupId: string,
    memberId: string,
  ): Promise<{ message: string }> {
    // Find the group and check if user has permission
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

    const currentUserMember = group.members[0];

    // Check if user has permission to remove members
    if (
      currentUserMember.role === 'editor' ||
      currentUserMember.role === 'viewer'
    ) {
      throw new ForbiddenException(
        'You do not have permission to remove members',
      );
    }

    // Find the member to be removed
    const memberToRemove = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
      include: {
        user: true,
      },
    });

    if (!memberToRemove) {
      throw new NotFoundException('Member not found');
    }

    // Check if the member belongs to the specified group
    if (memberToRemove.groupId !== groupId) {
      throw new NotFoundException('Member not found in this group');
    }

    // Check if trying to remove the current user
    if (memberToRemove.userId === user.id) {
      throw new BadRequestException('Cannot remove yourself from the group');
    }

    // Check if the member is active
    if (memberToRemove.status !== GroupMemberStatus.active) {
      throw new BadRequestException('Can only remove active members');
    }

    // Role-based permission checks
    if (currentUserMember.role === 'owner') {
      // Owner can remove any member except themselves
      if (memberToRemove.role === 'owner') {
        throw new ForbiddenException('Cannot remove the group owner');
      }
    } else if (currentUserMember.role === 'admin') {
      // Admin can only remove editor/viewer members
      if (memberToRemove.role === 'owner' || memberToRemove.role === 'admin') {
        throw new ForbiddenException(
          'Admins can only remove editor and viewer members',
        );
      }
    }

    // Delete the member from the group
    await this.prisma.groupMember.delete({
      where: { id: memberId },
    });

    return {
      message: `Successfully removed ${memberToRemove.user?.firstName || 'member'} from the group`,
    };
  }

  /**
   * Get dashboard data for a group
   * Returns comprehensive statistics and activity data
   */
  async getDashboard(user: UserEntity, slug: string): Promise<DashboardDto> {
    // First verify the group exists and user has access
    const group = await this.findAuthenticatedBySlug(user, slug);

    // Get fundraising overview data
    const fundraisers = await this.prisma.fundraiser.findMany({
      where: {
        groupId: group.id,
        status: 'published',
      },
      include: {
        donations: {
          where: {
            status: 'completed',
          },
        },
      },
    });

    // Calculate fundraising statistics
    const totalRaised = fundraisers.reduce((sum, fundraiser) => {
      const fundraiserTotal = fundraiser.donations.reduce(
        (donationSum, donation) => donationSum + Number(donation.amount),
        0,
      );
      return sum + fundraiserTotal;
    }, 0);

    const completedGoals = fundraisers.filter(
      (fundraiser) => fundraiser.isGoalReached,
    ).length;

    const avgDonationPerFundraiser =
      fundraisers.length > 0 ? totalRaised / fundraisers.length : 0;

    // Get team overview data
    const members = await this.prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        status: GroupMemberStatus.active,
      },
      include: {
        user: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const pendingInvitations = await this.prisma.groupMember.count({
      where: {
        groupId: group.id,
        status: GroupMemberStatus.invited,
      },
    });

    // Get recent activity data
    const recentActivity = await this.getRecentActivity(group.id);

    // Get fundraiser highlights
    const highlights = await this.getFundraiserHighlights(group.id);

    return {
      fundraising: {
        activeFundraisers: fundraisers.length,
        totalRaised,
        goalCompletionRate: {
          completed: completedGoals,
          total: fundraisers.length,
        },
        avgDonationPerFundraiser,
      },
      team: {
        members: members.length,
        pendingInvitations,
        lastMemberJoined: {
          name: members[0]?.user
            ? `${members[0].user.firstName} ${members[0].user.lastName}`
            : members[0]?.invitedName || 'Unknown',
          date:
            members[0]?.joinedAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }) || '',
        },
      },
      recentActivity,
      highlights,
    };
  }

  /**
   * Get recent activity for a group
   */
  private async getRecentActivity(groupId: string) {
    const activities: any[] = [];

    // Get recent fundraisers created
    const recentFundraisers = await this.prisma.fundraiser.findMany({
      where: { groupId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const fundraiser of recentFundraisers) {
      const creator = fundraiser.group.members.find(
        (member) => member.userId === fundraiser.group.ownerId,
      );
      activities.push({
        type: 'fundraiser_created' as const,
        user: creator?.user?.email || 'Unknown',
        action: 'created fundraiser',
        target: fundraiser.title,
        date: fundraiser.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      });
    }

    // Get recent donations
    const recentDonations = await this.prisma.donation.findMany({
      where: {
        fundraiser: { groupId },
        status: 'completed',
      },
      include: {
        fundraiser: true,
        donor: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const donation of recentDonations) {
      activities.push({
        type: 'donation_received' as const,
        user: donation.isAnonymous
          ? 'Anonymous'
          : donation.donor?.firstName || 'Unknown',
        action: 'donated',
        amount: `₱${Number(donation.amount).toLocaleString()}`,
        target: donation.fundraiser.title,
        date: donation.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      });
    }

    // Get recent member joins
    const recentMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        status: GroupMemberStatus.active,
      },
      include: {
        user: true,
      },
      orderBy: { joinedAt: 'desc' },
      take: 5,
    });

    for (const member of recentMembers) {
      activities.push({
        type: 'member_joined' as const,
        user: member.user
          ? `${member.user.firstName} ${member.user.lastName}`
          : member.invitedName || 'Unknown',
        action: 'joined the group',
        date: member.joinedAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      });
    }

    // Sort all activities by date and take the most recent 10
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }

  /**
   * Get fundraiser highlights for a group
   */
  private async getFundraiserHighlights(groupId: string) {
    // Get top performing fundraiser (most raised)
    const topPerforming = await this.prisma.fundraiser.findFirst({
      where: {
        groupId,
        status: 'published',
      },
      include: {
        donations: {
          where: {
            status: 'completed',
          },
        },
      },
      orderBy: {
        donations: {
          _count: 'desc',
        },
      },
    });

    // Get most recent fundraiser
    const mostRecent = await this.prisma.fundraiser.findFirst({
      where: {
        groupId,
        status: 'published',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get most donated today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const mostDonatedToday = await this.prisma.fundraiser.findFirst({
      where: {
        groupId,
        status: 'published',
        donations: {
          some: {
            status: 'completed',
            createdAt: {
              gte: today,
            },
          },
        },
      },
      include: {
        donations: {
          where: {
            status: 'completed',
            createdAt: {
              gte: today,
            },
          },
        },
      },
      orderBy: {
        donations: {
          _count: 'desc',
        },
      },
    });

    return {
      topPerforming: {
        name: topPerforming?.title || 'No fundraisers',
        raised: topPerforming
          ? topPerforming.donations.reduce(
              (sum, donation) => sum + Number(donation.amount),
              0,
            )
          : 0,
        goal: topPerforming ? Number(topPerforming.goalAmount) : 0,
      },
      mostRecent: {
        name: mostRecent?.title || 'No fundraisers',
        created:
          mostRecent?.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }) || '',
        raised: mostRecent
          ? Number(
              (
                await this.prisma.donation.aggregate({
                  where: {
                    fundraiserId: mostRecent.id,
                    status: 'completed',
                  },
                  _sum: {
                    amount: true,
                  },
                })
              )._sum.amount || 0,
            )
          : 0,
      },
      mostDonatedToday: {
        name: mostDonatedToday?.title || 'No donations today',
        donations: mostDonatedToday?.donations.length || 0,
        amount: mostDonatedToday
          ? mostDonatedToday.donations.reduce(
              (sum, donation) => sum + Number(donation.amount),
              0,
            )
          : 0,
      },
    };
  }
}
