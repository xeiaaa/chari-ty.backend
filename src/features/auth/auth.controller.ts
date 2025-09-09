import {
  Controller,
  Get,
  Post,
  Body,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public, AuthUser } from '../../common/decorators';
import { OnboardingService } from './onboarding.service';
import { User as UserEntity } from '../../../generated/prisma';
import { OnboardingDto } from './dtos/onboarding.dto';
import { OrganizationDto } from './dtos/organization.dto';
import { AcceptInvitationDto } from './dtos/accept-invitation.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../../generated/prisma';

/**
 * AuthController handles authentication-related HTTP requests
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get current authenticated user's data
   * GET /api/v1/auth/me
   */
  @Get('me')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute per user
  getCurrentUser(@AuthUser() user: UserEntity): UserEntity {
    // User is already fetched from database by AuthGuard
    return user;
  }

  /**
   * Get current user's groups
   * GET /api/v1/auth/me/groups
   */
  @Get('me/groups')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  async getCurrentUserGroups(
    @AuthUser() user: UserEntity,
  ): Promise<OrganizationDto[]> {
    const groupMembers = await this.prisma.groupMember.findMany({
      where: {
        userId: user.id,
        status: 'active',
      },
      include: {
        group: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return groupMembers.map((member) => ({
      id: member.group.id,
      type: member.group.type,
      name: member.group.name,
      slug: member.group.slug,
      role: member.role,
      dateActive: member.joinedAt.toISOString(),
    }));
  }

  /**
   * Complete user onboarding
   * POST /api/v1/auth/onboarding
   */
  @Post('onboarding')
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour per user
  async completeOnboarding(
    @AuthUser() user: UserEntity,
    @Body() onboardingData: OnboardingDto,
  ): Promise<{
    message: string;
    user: UserEntity;
    group?: any;
    groupMember?: any;
  }> {
    try {
      const result = await this.onboardingService.completeOnboarding(
        user.clerkId,
        onboardingData,
      );

      return {
        message: 'Onboarding completed successfully',
        user: result.user,
        group: result.group,
        groupMember: result.groupMember,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === 'User not found in database') {
          throw new NotFoundException(error.message);
        }
        if (error.message === 'User has already completed onboarding') {
          throw new ConflictException(error.message);
        }
        if (error.message === 'Invalid account type') {
          throw new BadRequestException(error.message);
        }
      }

      // Log unexpected errors and throw generic error
      console.error('Onboarding error:', error);
      throw new BadRequestException('Failed to complete onboarding');
    }
  }

  /**
   * Get current user's group invites
   * GET /api/v1/auth/me/invites
   */
  @Get('me/invites')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  async getCurrentUserInvites(
    @AuthUser() user: UserEntity,
  ): Promise<OrganizationDto[]> {
    const groupMembers = await this.prisma.groupMember.findMany({
      where: {
        userId: user.id,
        status: 'invited',
      },
      include: {
        group: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return groupMembers.map((member) => ({
      id: member.group.id,
      type: member.group.type,
      name: member.group.name,
      role: member.role,
      dateActive: member.joinedAt.toISOString(),
    }));
  }

  /**
   * Accept a group invitation
   * POST /api/v1/auth/accept-invitation
   */
  @Post('accept-invitation')
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 requests per hour per user
  async acceptInvitation(
    @AuthUser() user: UserEntity,
    @Body() acceptInvitationData: AcceptInvitationDto,
  ): Promise<{ message: string; groupMember: any }> {
    // Check if the invitation exists and belongs to the current user
    const groupMember = await this.prisma.groupMember.findFirst({
      where: {
        groupId: acceptInvitationData.groupId,
        userId: user.id,
        status: 'invited',
      },
      include: {
        group: {
          include: {
            owner: true,
            members: {
              where: {
                role: { in: ['owner', 'admin'] },
                status: 'active',
              },
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!groupMember) {
      throw new NotFoundException('Invitation not found or already accepted');
    }

    // Update the group member status to active
    const updatedGroupMember = await this.prisma.groupMember.update({
      where: {
        id: groupMember.id,
      },
      data: {
        status: 'active',
        joinedAt: new Date(),
      },
      include: {
        group: {
          include: {
            owner: true,
            members: {
              where: {
                role: { in: ['owner', 'admin'] },
                status: 'active',
              },
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    // Send notifications to group owner and admins
    await this.sendInvitationAcceptedNotifications(updatedGroupMember, user);

    return {
      message: `Successfully joined ${updatedGroupMember.group.name}`,
      groupMember: updatedGroupMember,
    };
  }

  /**
   * Send invitation accepted notifications to group owner and admins
   */
  private async sendInvitationAcceptedNotifications(
    groupMember: any,
    acceptedByUser: UserEntity,
  ): Promise<void> {
    try {
      const group = groupMember.group;

      // Collect user IDs to notify (owner + admins)
      const userIdsToNotify: string[] = [];

      // Add group owner (excluding the user who just accepted the invitation)
      if (group.owner && group.owner.id !== acceptedByUser.id) {
        userIdsToNotify.push(group.owner.id);
      }

      // Add group admins (excluding owner if they're also an admin, and excluding the user who just accepted)
      group.members.forEach((member: any) => {
        if (
          member.user &&
          !userIdsToNotify.includes(member.user.id) &&
          member.user.id !== acceptedByUser.id
        ) {
          userIdsToNotify.push(member.user.id);
        }
      });

      if (userIdsToNotify.length === 0) {
        console.warn('No users to notify for invitation acceptance');
        return;
      }

      // Prepare notification data
      const notificationData = {
        groupId: group.id,
        groupName: group.name,
        groupSlug: group.slug,
        acceptedBy: `${acceptedByUser.firstName} ${acceptedByUser.lastName}`,
        acceptedById: acceptedByUser.id,
        acceptedByEmail: acceptedByUser.email,
        role: groupMember.role,
        joinedAt: groupMember.joinedAt.toISOString(),
      };

      // Send notifications
      await this.notificationsService.notifyAll(
        userIdsToNotify,
        NotificationType.invitation_accepted,
        notificationData,
      );

      console.log(
        `Sent invitation accepted notifications to ${userIdsToNotify.length} users`,
      );
    } catch (error) {
      // Log the error but don't fail the invitation acceptance process
      console.error('Failed to send invitation accepted notifications:', error);
    }
  }

  /**
   * Admin test endpoint for smoke testing
   */
  @Public()
  @Get('admin/test')
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute for admin
  adminTest(): { message: string; timestamp: string } {
    return {
      message: 'Auth module is working correctly',
      timestamp: new Date().toISOString(),
    };
  }
}
