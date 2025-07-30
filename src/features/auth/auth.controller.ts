import {
  Controller,
  Get,
  Post,
  Body,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Public, AuthUser } from '../../common/decorators';
import { OnboardingService } from './onboarding.service';
import { User as UserEntity } from '../../../generated/prisma';
import { OnboardingDto } from './dtos/onboarding.dto';
import { OrganizationDto } from './dtos/organization.dto';
import { AcceptInvitationDto } from './dtos/accept-invitation.dto';
import { PrismaService } from '../../core/prisma/prisma.service';

/**
 * AuthController handles authentication-related HTTP requests
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get current authenticated user's data
   * GET /api/v1/auth/me
   */
  @Get('me')
  getCurrentUser(@AuthUser() user: UserEntity): UserEntity {
    // User is already fetched from database by AuthGuard
    return user;
  }

  /**
   * Get current user's groups
   * GET /api/v1/auth/me/groups
   */
  @Get('me/groups')
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
    } catch (error) {
      if (error.message === 'User not found in database') {
        throw new NotFoundException(error.message);
      }
      if (error.message === 'User has already completed onboarding') {
        throw new ConflictException(error.message);
      }
      if (error.message === 'Invalid account type') {
        throw new BadRequestException(error.message);
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
        group: true,
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
        group: true,
      },
    });

    return {
      message: `Successfully joined ${updatedGroupMember.group.name}`,
      groupMember: updatedGroupMember,
    };
  }

  /**
   * Admin test endpoint for smoke testing
   */
  @Public()
  @Get('admin/test')
  adminTest(): { message: string; timestamp: string } {
    return {
      message: 'Auth module is working correctly',
      timestamp: new Date().toISOString(),
    };
  }
}
