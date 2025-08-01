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
import { UploadsService } from '../uploads/uploads.service';
import {
  Group,
  User as UserEntity,
  GroupMemberStatus,
  GroupMemberRole,
  GroupUpload,
  Upload,
  GroupMember,
} from '../../../generated/prisma';
import { UpdateGroupDto } from './dtos/update-group.dto';
import { CreateInviteDto } from './dtos/create-invite.dto';
import { CreateGroupDto } from './dtos/create-group.dto';
import { DashboardDto, RecentActivityDto } from './dtos/dashboard.dto';
import { AddGroupUploadsDto } from './dtos/add-group-uploads.dto';
import { ReorderGroupUploadsDto } from './dtos/reorder-group-uploads.dto';
import { UpdateGroupUploadDto } from './dtos/update-group-upload.dto';
import { ListPublicFundraisersDto } from '../fundraisers/dtos/list-public-fundraisers.dto';

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
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * Find a group by slug
   */
  async findBySlug(slug: string): Promise<Group | null> {
    return this.prisma.group.findUnique({
      where: { slug },
      include: {
        groupUploads: {
          include: {
            upload: true,
          },
        },
      },
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
        groupUploads: {
          include: {
            upload: true,
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
      website: group.website,
      groupUploads: group.groupUploads,
      verified: group.verified,
      createdAt: group.createdAt,
    };
  }

  /**
   * Get public fundraisers for a group by slug
   * Returns paginated list of public fundraisers for the group
   */
  async getGroupFundraisers(slug: string, query: ListPublicFundraisersDto) {
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
      let avatarUploadId: string | undefined;

      // Handle avatar upload if avatarPublicId is provided
      if (createGroupDto.avatarPublicId) {
        // Get Cloudinary resource by publicId
        const cloudinaryResource =
          await this.uploadsService.getResourceByPublicId(
            createGroupDto.avatarPublicId,
          );

        // Convert Cloudinary resource to CloudinaryAssetDto format
        const asset = {
          cloudinaryAssetId: cloudinaryResource.asset_id,
          publicId: cloudinaryResource.public_id,
          url: cloudinaryResource.secure_url,
          eagerUrl: cloudinaryResource.derived?.[0]?.secure_url,
          format: cloudinaryResource.format,
          resourceType: cloudinaryResource.resource_type,
          size: cloudinaryResource.bytes,
          pages: cloudinaryResource.derived?.[0]?.bytes || undefined,
          originalFilename: cloudinaryResource.display_name,
          uploadedAt: cloudinaryResource.created_at,
        };

        // Create upload record
        const upload = await this.uploadsService.createUpload(asset, user.id);
        avatarUploadId = upload.id;
      }

      // Create group
      const group = await prisma.group.create({
        data: {
          name: createGroupDto.name,
          slug: groupSlug,
          description: createGroupDto.description,
          type: createGroupDto.type,
          website: createGroupDto.website,
          ein: createGroupDto.ein,
          avatarUploadId,
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
  async findAuthenticatedBySlug(slug: string, group: Group): Promise<Group> {
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
        groupUploads: {
          include: {
            upload: true,
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
    group: Group & { avatar: Upload },
    updateData: UpdateGroupDto,
  ): Promise<Group> {
    // Handle avatar upload if avatarPublicId is provided
    let avatarUploadId: string | undefined;
    if (updateData.avatarPublicId) {
      // Check if the avatarPublicId is the same as the current avatar
      // This optimization prevents unnecessary Cloudinary API calls and upload record creation
      if (group.avatar?.publicId === updateData.avatarPublicId) {
        // Avatar hasn't changed, keep the existing avatarUploadId
        avatarUploadId = group.avatarUploadId || undefined;
      } else {
        // Avatar has changed, process the new upload
        // Get Cloudinary resource by publicId
        const cloudinaryResource =
          await this.uploadsService.getResourceByPublicId(
            updateData.avatarPublicId,
          );

        // Convert Cloudinary resource to CloudinaryAssetDto format
        const asset = {
          cloudinaryAssetId: cloudinaryResource.asset_id,
          publicId: cloudinaryResource.public_id,
          url: cloudinaryResource.secure_url,
          eagerUrl: cloudinaryResource.derived?.[0]?.secure_url,
          format: cloudinaryResource.format,
          resourceType: cloudinaryResource.resource_type,
          size: cloudinaryResource.bytes,
          pages: cloudinaryResource.derived?.[0]?.bytes || undefined,
          originalFilename: cloudinaryResource.display_name,
          uploadedAt: cloudinaryResource.created_at,
        };

        // Create upload record
        const upload = await this.uploadsService.createUpload(asset, user.id);
        avatarUploadId = upload.id;
      }
    }

    // Handle avatar removal if removeAvatar is true
    if (updateData.removeAvatar) {
      avatarUploadId = undefined;
    }

    const { removeAvatar } = updateData;

    delete updateData.removeAvatar;

    // Update the group
    return this.prisma.group.update({
      where: { slug },
      data: {
        ...updateData,
        avatarUploadId: removeAvatar ? null : avatarUploadId,
      },
    });
  }

  /**
   * Invite a user to a group
   * Only group owners and admins can invite users
   */
  async inviteUser(
    user: UserEntity,
    group: Group,
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

    // Check if the user is already a member or invited
    let existingMember;

    if (inviteData.userId) {
      // Check by userId
      existingMember = await this.prisma.groupMember.findFirst({
        where: {
          groupId: group.id,
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
          groupId: group.id,
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
          `Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Create the invitation record
    const invitation = await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
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
    memberToUpdateId: string,
    newRole: Exclude<GroupMemberRole, 'owner'>,
    currentUserMembership: GroupMember,
  ): Promise<{
    id: string;
    userId: string;
    groupId: string;
    role: GroupMemberRole;
    status: GroupMemberStatus;
    updatedAt: Date;
  }> {
    // Find the member to be updated
    const memberToUpdate = await this.prisma.groupMember.findUnique({
      where: { id: memberToUpdateId },
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
    if (currentUserMembership.role === 'owner') {
      // Owner can change any role except owner
      if (memberToUpdate.role === 'owner') {
        throw new ForbiddenException('Cannot change owner role');
      }
    } else if (currentUserMembership.role === 'admin') {
      // Admin can only change editor/viewer roles
      if (memberToUpdate.role === 'owner' || memberToUpdate.role === 'admin') {
        throw new ForbiddenException(
          'Admins can only change editor and viewer roles',
        );
      }
    }

    // Update the member's role
    const updatedMember = await this.prisma.groupMember.update({
      where: { id: memberToUpdateId },
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
    memberId: string, // memberToRemoveId
    currentUserMembership: GroupMember,
  ): Promise<{ message: string }> {
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
    if (currentUserMembership.role === 'owner') {
      // Owner can remove any member except themselves
      if (memberToRemove.role === 'owner') {
        throw new ForbiddenException('Cannot remove the group owner');
      }
    } else if (currentUserMembership.role === 'admin') {
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
  async getDashboard(group: Group): Promise<DashboardDto> {
    try {
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
        const fundraiserTotal = (fundraiser.donations || []).reduce(
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

      // Get fundraiser link stats
      const linkStats = await this.getFundraiserLinkStats(group.id);

      // Get engagement insights
      const engagementInsights = await this.getEngagementInsights(group.id);

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
        linkStats,
        engagementInsights,
        recentActivity,
        highlights,
      };
    } catch (error) {
      console.error('Error in getDashboard:', error);
      // Return default values if there's an error
      return {
        fundraising: {
          activeFundraisers: 0,
          totalRaised: 0,
          goalCompletionRate: {
            completed: 0,
            total: 0,
          },
          avgDonationPerFundraiser: 0,
        },
        team: {
          members: 0,
          pendingInvitations: 0,
          lastMemberJoined: {
            name: 'Unknown',
            date: '',
          },
        },
        linkStats: {
          totalTrafficSources: 0,
          topPerformingLink: {
            alias: 'No links',
            fundraiser: 'No fundraisers',
            totalDonations: 0,
            donationCount: 0,
          },
          donationsFromSharedLinks: 0,
          percentageFromSharedLinks: 0,
          avgDonationPerLink: 0,
        },
        engagementInsights: {
          mostSharedFundraiser: {
            name: 'No fundraisers',
            shareCount: 0,
            totalRaised: 0,
          },
          memberWithMostLinks: {
            name: 'No members',
            linkCount: 0,
            totalRaised: 0,
          },
        },
        recentActivity: [],
        highlights: {
          topPerforming: {
            name: 'No fundraisers',
            raised: 0,
            goal: 0,
          },
          mostRecent: {
            name: 'No fundraisers',
            created: '',
            raised: 0,
          },
          mostDonatedToday: {
            name: 'No donations today',
            donations: 0,
            amount: 0,
          },
        },
      };
    }
  }

  /**
   * Get recent activity for a group
   */
  private async getRecentActivity(groupId: string) {
    const activities: RecentActivityDto[] = [];

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

  /**
   * Get fundraiser link stats for a group
   */
  private async getFundraiserLinkStats(groupId: string) {
    // Get all fundraiser links for the group
    const fundraiserLinks = await this.prisma.fundraiserLink.findMany({
      where: {
        fundraiser: {
          groupId,
        },
      },
      include: {
        fundraiser: true,
        donations: {
          where: {
            status: 'completed',
          },
        },
      },
    });

    // Calculate total traffic sources
    const totalTrafficSources = fundraiserLinks.length;

    // Calculate donations from shared links
    const donationsFromSharedLinks = fundraiserLinks.reduce((sum, link) => {
      return (
        sum +
        link.donations.reduce((linkSum, donation) => {
          return linkSum + Number(donation.amount);
        }, 0)
      );
    }, 0);

    // Get total donations for percentage calculation
    const totalDonations = await this.prisma.donation.aggregate({
      where: {
        fundraiser: {
          groupId,
        },
        status: 'completed',
      },
      _sum: {
        amount: true,
      },
    });

    const totalDonationsAmount = Number(totalDonations._sum.amount || 0);
    const percentageFromSharedLinks =
      totalDonationsAmount > 0
        ? Math.round((donationsFromSharedLinks / totalDonationsAmount) * 100)
        : 0;

    // Calculate average donation per link
    const avgDonationPerLink =
      totalTrafficSources > 0
        ? Math.round(donationsFromSharedLinks / totalTrafficSources)
        : 0;

    // Find top performing link
    const topPerformingLink = fundraiserLinks.reduce((top, link) => {
      const linkTotal = (link.donations || []).reduce((sum, donation) => {
        return sum + Number(donation.amount);
      }, 0);

      if (!top || linkTotal > top.total) {
        return {
          alias: link.alias,
          fundraiser: link.fundraiser?.title || 'Unknown Fundraiser',
          totalDonations: linkTotal,
          donationCount: (link.donations || []).length,
        };
      }
      return top;
    }, null as any);

    return {
      totalTrafficSources,
      topPerformingLink: topPerformingLink || {
        alias: 'No links',
        fundraiser: 'No fundraisers',
        totalDonations: 0,
        donationCount: 0,
      },
      donationsFromSharedLinks,
      percentageFromSharedLinks,
      avgDonationPerLink,
    };
  }

  /**
   * Get engagement insights for a group
   */
  private async getEngagementInsights(groupId: string) {
    // Get all fundraisers with their link counts
    const fundraisersWithLinks = await this.prisma.fundraiser.findMany({
      where: {
        groupId,
      },
      include: {
        links: true,
        donations: {
          where: {
            status: 'completed',
          },
        },
      },
    });

    // Find most shared fundraiser
    const mostSharedFundraiser = fundraisersWithLinks.reduce(
      (most, fundraiser) => {
        const linkCount = fundraiser.links?.length || 0;
        if (!most || linkCount > most.shareCount) {
          return {
            name: fundraiser.title,
            shareCount: linkCount,
            totalRaised: (fundraiser.donations || []).reduce(
              (sum, donation) => {
                return sum + Number(donation.amount);
              },
              0,
            ),
          };
        }
        return most;
      },
      null as any,
    );

    // Get member with most links
    const memberWithMostLinks = await this.prisma.fundraiserLink.groupBy({
      by: ['userId'],
      where: {
        fundraiser: {
          groupId,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 1,
    });

    let memberWithMostLinksData = {
      name: 'No members',
      linkCount: 0,
      totalRaised: 0,
    };

    if (memberWithMostLinks.length > 0) {
      const topMember = memberWithMostLinks[0];
      const user = await this.prisma.user.findUnique({
        where: { id: topMember.userId },
      });

      // Calculate total raised via their links
      const totalRaised = await this.prisma.donation.aggregate({
        where: {
          sourceLink: {
            userId: topMember.userId,
            fundraiser: {
              groupId,
            },
          },
          status: 'completed',
        },
        _sum: {
          amount: true,
        },
      });

      memberWithMostLinksData = {
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
        linkCount: topMember._count.id,
        totalRaised: Number(totalRaised._sum?.amount || 0),
      };
    }

    return {
      mostSharedFundraiser: mostSharedFundraiser || {
        name: 'No fundraisers',
        shareCount: 0,
        totalRaised: 0,
      },
      memberWithMostLinks: memberWithMostLinksData,
    };
  }

  /**
   * Add uploads to a group
   * Creates Upload records and GroupUpload entries
   */
  async addGroupUploads(
    user: UserEntity,
    groupId: string,
    data: AddGroupUploadsDto,
  ) {
    // Verify group exists and user has permission
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check member role
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: groupId,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      throw new ForbiddenException(
        'You do not have permission to add uploads to this group',
      );
    }

    // Create group upload items in transaction
    return await this.prisma.$transaction(async (tx) => {
      const groupUploadItems: GroupUpload[] = [];

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];

        // Get Cloudinary resource by publicId
        const cloudinaryResource =
          await this.uploadsService.getResourceByPublicId(item.publicId);

        // Convert Cloudinary resource to CloudinaryAssetDto format
        const asset = {
          cloudinaryAssetId: cloudinaryResource.asset_id,
          publicId: cloudinaryResource.public_id,
          url: cloudinaryResource.secure_url,
          eagerUrl: cloudinaryResource.derived?.[0]?.secure_url,
          format: cloudinaryResource.format,
          resourceType: cloudinaryResource.resource_type,
          size: cloudinaryResource.bytes,
          pages: cloudinaryResource.derived?.[0]?.bytes || undefined,
          originalFilename: cloudinaryResource.display_name,
          uploadedAt: cloudinaryResource.created_at,
        };

        // Create upload record
        const upload = await this.uploadsService.createUpload(asset, user.id);

        // Create group upload item
        const groupUploadItem = await tx.groupUpload.create({
          data: {
            groupId,
            uploadId: upload.id,
            type: item.type || 'gallery',
            caption: item.caption,
            order: i, // Use array index as order
          },
          include: {
            upload: true,
          },
        });

        groupUploadItems.push(groupUploadItem);
      }

      return groupUploadItems;
    });
  }

  /**
   * Update a group upload caption
   */
  async updateGroupUpload(
    user: UserEntity,
    groupId: string,
    uploadItemId: string,
    data: UpdateGroupUploadDto,
  ) {
    // Verify group exists and user has permission
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check member role
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: groupId,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      throw new ForbiddenException(
        'You do not have permission to update uploads for this group',
      );
    }

    // Verify upload item exists and belongs to this group
    const uploadItem = await this.prisma.groupUpload.findFirst({
      where: {
        id: uploadItemId,
        groupId,
      },
      include: {
        upload: true,
      },
    });

    if (!uploadItem) {
      throw new NotFoundException('Upload item not found');
    }

    // Update the upload item
    return await this.prisma.groupUpload.update({
      where: { id: uploadItemId },
      data: {
        caption: data.caption,
      },
      include: {
        upload: true,
      },
    });
  }

  /**
   * Delete a group upload
   */
  async deleteGroupUpload(
    user: UserEntity,
    groupId: string,
    uploadItemId: string,
  ) {
    // Verify group exists and user has permission
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check member role
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: groupId,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      throw new ForbiddenException(
        'You do not have permission to delete uploads for this group',
      );
    }

    // Verify upload item exists and belongs to this group
    const uploadItem = await this.prisma.groupUpload.findFirst({
      where: {
        id: uploadItemId,
        groupId,
      },
      include: {
        upload: true,
      },
    });

    if (!uploadItem) {
      throw new NotFoundException('Upload item not found');
    }

    // Delete the Cloudinary resource
    await this.uploadsService.deleteCloudinaryResource(
      uploadItem.upload.publicId,
    );

    // Delete the upload item (this will also delete the upload due to cascade)
    await this.prisma.groupUpload.delete({
      where: { id: uploadItemId },
    });
  }

  /**
   * Reorder group uploads
   */
  async reorderGroupUploads(
    user: UserEntity,
    groupId: string,
    data: ReorderGroupUploadsDto,
  ) {
    // Verify group exists and user has permission
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Check member role
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId: groupId,
        },
      },
    });

    if (!membership || membership.role === 'viewer') {
      throw new ForbiddenException(
        'You do not have permission to reorder uploads for this group',
      );
    }

    // Verify all upload items exist and belong to this group
    const uploadItemIds = data.orderMap.map((item) => item.groupUploadId);
    const existingItems = await this.prisma.groupUpload.findMany({
      where: {
        id: { in: uploadItemIds },
        groupId,
      },
    });

    if (existingItems.length !== uploadItemIds.length) {
      throw new NotFoundException('One or more upload items not found');
    }

    // Update the order of all items in a transaction
    return await this.prisma.$transaction(async (tx) => {
      const updatedItems: (GroupUpload & { upload: Upload })[] = [];

      for (const item of data.orderMap) {
        const updatedItem = await tx.groupUpload.update({
          where: { id: item.groupUploadId },
          data: { order: item.order },
          include: {
            upload: true,
          },
        });
        updatedItems.push(updatedItem);
      }

      return updatedItems;
    });
  }
}
