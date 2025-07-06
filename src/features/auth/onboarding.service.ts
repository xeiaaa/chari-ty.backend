import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ClerkService } from './clerk.service';
import { User, Group, GroupMember } from '../../../generated/prisma';
import { OnboardingDto } from './dtos/onboarding.dto';

/**
 * OnboardingService handles user onboarding process
 * for different account types (individual, team, nonprofit)
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkService: ClerkService,
  ) {}

  /**
   * Complete user onboarding based on account type
   */
  async completeOnboarding(
    clerkId: string,
    onboardingData: OnboardingDto,
  ): Promise<{ user: User; group?: Group; groupMember?: GroupMember }> {
    // Get current user from database
    const existingUser = await this.prisma.user.findUnique({
      where: { clerkId },
    });

    if (!existingUser) {
      throw new Error('User not found in database');
    }

    if (existingUser.setupComplete) {
      throw new Error('User has already completed onboarding');
    }

    // Process onboarding based on account type
    switch (onboardingData.accountType) {
      case 'individual':
        return this.completeIndividualOnboarding(existingUser, onboardingData);
      case 'team':
        return this.completeTeamOnboarding(existingUser, onboardingData);
      case 'nonprofit':
        return this.completeNonprofitOnboarding(existingUser, onboardingData);
      default:
        throw new Error('Invalid account type');
    }
  }

  /**
   * Complete individual account onboarding
   */
  private async completeIndividualOnboarding(
    user: User,
    data: OnboardingDto,
  ): Promise<{ user: User }> {
    // Update user with individual account type and setup completion
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountType: 'individual',
        bio: data.bio,
        avatarUrl: data.avatarUrl,
        setupComplete: true,
      },
    });

    // Update Clerk metadata
    await this.updateClerkMetadata(user.clerkId, 'individual');

    return { user: updatedUser };
  }

  /**
   * Complete team account onboarding
   */
  private async completeTeamOnboarding(
    user: User,
    data: OnboardingDto,
  ): Promise<{ user: User; group: Group; groupMember: GroupMember }> {
    if (!data.teamName) {
      throw new Error('Team name is required for team account type');
    }

    // Use transaction to ensure data consistency
    const result = await this.prisma.$transaction(async (prisma) => {
      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          accountType: 'team',
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          setupComplete: true,
        },
      });

      // Create group for team
      const group = await prisma.group.create({
        data: {
          name: data.teamName!, // Safe to use ! after runtime check
          description: data.mission,
          type: 'team',
          website: data.website,
        },
      });

      // Add user as owner of the group
      const groupMember = await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: 'owner',
        },
      });

      // Add additional team members if provided
      if (data.members && data.members.length > 0) {
        for (const member of data.members) {
          // Use the provided role, default to 'viewer' if not set
          const memberRole = member.role || 'viewer';
          // Send Clerk invitation and get invitationId
          const invitation = await this.clerkService.inviteUser({
            email: member.email ?? '',
            invitedByEmail: user.email,
            invitedByName: `${user.firstName} ${user.lastName}`,
            groupId: group.id,
            groupName: group.name,
            role: memberRole,
          });
          const invitationId = invitation.id;

          // Create GroupMember row with userId: null, role, and invitationId
          await prisma.groupMember.create({
            data: {
              userId: null,
              groupId: group.id,
              role: memberRole,
              invitedName: member.name ?? '',
              invitedEmail: member.email ?? '',
              invitationId,
            },
          });
        }
      }

      return { user: updatedUser, group, groupMember };
    });

    // Update Clerk metadata
    await this.updateClerkMetadata(user.clerkId, 'team');

    return result;
  }

  /**
   * Complete nonprofit account onboarding
   */
  private async completeNonprofitOnboarding(
    user: User,
    data: OnboardingDto,
  ): Promise<{ user: User; group: Group; groupMember: GroupMember }> {
    if (!data.organizationName) {
      throw new Error(
        'Organization name is required for nonprofit account type',
      );
    }
    if (!data.ein) {
      throw new Error('EIN is required for nonprofit account type');
    }

    // Use transaction to ensure data consistency
    const result = await this.prisma.$transaction(async (prisma) => {
      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          accountType: 'nonprofit',
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          setupComplete: true,
        },
      });

      // Create group for nonprofit
      const group = await prisma.group.create({
        data: {
          name: data.organizationName!, // Safe to use ! after runtime check
          description: data.mission,
          type: 'nonprofit',
          website: data.website,
          ein: data.ein!, // Safe to use ! after runtime check
          documentsUrls: data.documentsUrls || [],
          verified: false, // Requires manual verification
        },
      });

      // Add user as owner of the group
      const groupMember = await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: 'owner',
        },
      });

      return { user: updatedUser, group, groupMember };
    });

    // Update Clerk metadata
    await this.updateClerkMetadata(user.clerkId, 'nonprofit');

    return result;
  }

  /**
   * Update Clerk user metadata
   */
  private async updateClerkMetadata(
    clerkId: string,
    accountType: string,
  ): Promise<void> {
    try {
      // Import Clerk client dynamically to avoid issues
      const { clerkClient } = await import('@clerk/express');

      await clerkClient.users.updateUser(clerkId, {
        publicMetadata: {
          accountType,
          setupComplete: true,
        },
      });
    } catch (error) {
      // Log error but don't fail the onboarding process
      console.error('Failed to update Clerk metadata:', error);
    }
  }
}
