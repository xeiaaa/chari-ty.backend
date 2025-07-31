import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ClerkService } from './clerk.service';
import { User, Group, GroupMember } from '../../../generated/prisma';
import { OnboardingDto } from './dtos/onboarding.dto';
import { UsersService } from '../users/users.service';

/**
 * OnboardingService handles user onboarding process
 * for different account types (individual, team, nonprofit)
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerkService: ClerkService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService, // Inject UsersService
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
  ): Promise<{ user: User; group: Group; groupMember: GroupMember }> {
    // Generate group name and slug
    const groupName = `${user.firstName} ${user.lastName}'s Group`;
    const groupSlug = await this.generateUniqueGroupSlug(groupName);

    // Use transaction to ensure data consistency
    const result = await this.prisma.$transaction(async (prisma) => {
      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          accountType: 'individual',
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          setupComplete: true,
        },
      });

      // Create group for individual
      const group = await prisma.group.create({
        data: {
          name: groupName,
          slug: groupSlug,
          type: 'individual',
          ownerId: user.id,
          description: data.mission,
          website: data.website,
          ein: undefined,
          documentsUrls: data.documentsUrls || [],
          verified: false,
        },
      });

      // Add user as the only group member (owner)
      const groupMember = await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: 'owner',
          status: 'active',
        },
      });

      return { user: updatedUser, group, groupMember };
    });

    // Update Clerk metadata
    await this.updateClerkMetadata(user.clerkId, 'individual');

    return result;
  }

  /**
   * Complete team account onboarding
   */
  private async completeTeamOnboarding(
    user: User,
    data: OnboardingDto,
  ): Promise<{ user: User; group: Group; groupMember: GroupMember }> {
    if (!data.name) {
      throw new Error('Name is required for team account type');
    }

    // Generate unique slug for the team group
    const teamGroupSlug = await this.generateUniqueGroupSlug(data.name);

    // Generate individual group name and slug
    const individualGroupName = `${user.firstName} ${user.lastName}'s Group`;
    const individualGroupSlug =
      await this.generateUniqueGroupSlug(individualGroupName);

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

      // Create individual group for the user
      const individualGroup = await prisma.group.create({
        data: {
          name: individualGroupName,
          slug: individualGroupSlug,
          type: 'individual',
          ownerId: user.id,
          description: undefined,
          website: undefined,
          ein: undefined,
          documentsUrls: [],
          verified: false,
        },
      });

      // Add user as owner of their individual group
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: individualGroup.id,
          role: 'owner',
          status: 'active',
        },
      });

      // Create group for team
      const group = await prisma.group.create({
        data: {
          name: data.name!, // Safe to use ! after runtime check
          slug: teamGroupSlug,
          description: data.mission,
          type: 'team',
          website: data.website,
          ownerId: user.id,
          documentsUrls: data.documentsUrls || [],
          verified: false,
        },
      });

      // Add user as owner of the team group
      const groupMember = await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: 'owner',
          status: 'active',
        },
      });

      // Add additional team members if provided
      if (data.members && data.members.length > 0) {
        const baseUrl = process.env.FRONTEND_URL;
        for (const member of data.members) {
          // Use the provided role, default to 'viewer' if not set
          const memberRole = member.role || 'viewer';
          // Check if user is already registered in Clerk
          const existingUsers = await this.clerkService
            .getClerkClient()
            .users.getUserList({ emailAddress: [member.email ?? ''] });

          if (existingUsers.data.length > 0) {
            // Registered: log the invite link
            if (baseUrl) {
              const link = `${baseUrl}/group-invite?groupId=${group.id}&email=${encodeURIComponent(member.email ?? '')}`;
              console.log(`Registered user invite link: ${link}`);
            } else {
              console.log(
                'FRONTEND_URL env var not set. Cannot generate invite link.',
              );
            }
            // Look up the app user by email
            const appUser = await this.usersService.findUserByEmail(
              member.email ?? '',
            );
            await prisma.groupMember.create({
              data: {
                userId: appUser ? appUser.id : null,
                groupId: group.id,
                role: memberRole,
                invitedName: member.name ?? '',
                invitedEmail: member.email ?? '',
                invitationId: null,
                status: 'invited',
              },
            });
          } else {
            // Not registered: send Clerk invitation
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
                status: 'invited',
              },
            });
          }
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
    if (!data.name) {
      throw new Error('Name is required for nonprofit account type');
    }
    if (!data.ein) {
      throw new Error('EIN is required for nonprofit account type');
    }

    // Generate unique slug for the nonprofit group
    const nonprofitGroupSlug = await this.generateUniqueGroupSlug(data.name);

    // Generate individual group name and slug
    const individualGroupName = `${user.firstName} ${user.lastName}'s Group`;
    const individualGroupSlug =
      await this.generateUniqueGroupSlug(individualGroupName);

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

      // Create individual group for the user
      const individualGroup = await prisma.group.create({
        data: {
          name: individualGroupName,
          slug: individualGroupSlug,
          type: 'individual',
          ownerId: user.id,
          description: undefined,
          website: undefined,
          ein: undefined,
          documentsUrls: [],
          verified: false,
        },
      });

      // Add user as owner of their individual group
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: individualGroup.id,
          role: 'owner',
          status: 'active',
        },
      });

      // Create group for nonprofit
      const group = await prisma.group.create({
        data: {
          name: data.name!, // Safe to use ! after runtime check
          slug: nonprofitGroupSlug,
          description: data.mission,
          type: 'nonprofit',
          website: data.website,
          ein: data.ein!, // Safe to use ! after runtime check
          documentsUrls: data.documentsUrls || [],
          verified: false, // Requires manual verification
          ownerId: user.id,
        },
      });

      // Add user as owner of the nonprofit group
      const groupMember = await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: 'owner',
          status: 'active',
        },
      });

      return { user: updatedUser, group, groupMember };
    });

    // Update Clerk metadata
    await this.updateClerkMetadata(user.clerkId, 'nonprofit');

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
