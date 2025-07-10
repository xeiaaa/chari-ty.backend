import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createApiPath,
  createAuthHeaders,
  mockUser1,
  seedTestDatabase,
  mockAuth,
} from './test-utils';
import { UsersService } from '../src/features/users/users.service';
import { ClerkService } from '../src/features/auth/clerk.service';
import { OnboardingService } from '../src/features/auth/onboarding.service';
import { GroupMemberStatus } from '../generated/prisma';

describe('AuthController Onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let clerkService: ClerkService;
  let onboardingService: OnboardingService;

  beforeEach(async () => {
    await seedTestDatabase();
    app = await createTestApp();
    usersService = app.get(UsersService);
    clerkService = app.get(ClerkService);
    onboardingService = app.get(OnboardingService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('POST /auth/onboarding', () => {
    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      await request(app.getHttpServer())
        .post(createApiPath('/auth/onboarding'))
        .send({})
        .expect(401);
    });

    it('should successfully complete individual account onboarding', async () => {
      mockAuth(
        clerkService,
        usersService,
        mockUser1.clerkId,
        mockUser1.email,
        mockUser1,
      );

      // Mock the onboarding service to return a successful result
      const completeOnboardingSpy = jest.spyOn(
        onboardingService,
        'completeOnboarding',
      );
      const completedUser = {
        ...mockUser1,
        setupComplete: true,
        accountType: 'individual' as const,
        bio: 'Test bio for individual account',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      completeOnboardingSpy.mockResolvedValue({
        user: completedUser,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('/auth/onboarding'))
        .set(createAuthHeaders())
        .send({
          accountType: 'individual',
          bio: 'Test bio for individual account',
          avatarUrl: 'https://example.com/avatar.jpg',
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Onboarding completed successfully',
        user: {
          id: completedUser.id,
          clerkId: completedUser.clerkId,
          email: completedUser.email,
          firstName: completedUser.firstName,
          lastName: completedUser.lastName,
          avatarUrl: completedUser.avatarUrl,
          bio: completedUser.bio,
          accountType: completedUser.accountType,
          setupComplete: true,
          createdAt: completedUser.createdAt.toISOString(),
          updatedAt: completedUser.updatedAt.toISOString(),
          groupMemberships: [],
        },
      });

      // Verify the service was called with correct parameters
      expect(completeOnboardingSpy).toHaveBeenCalledWith(mockUser1.clerkId, {
        accountType: 'individual',
        bio: 'Test bio for individual account',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
    });

    it('should successfully complete team account onboarding', async () => {
      mockAuth(
        clerkService,
        usersService,
        mockUser1.clerkId,
        mockUser1.email,
        mockUser1,
      );

      // Mock the onboarding service to return a successful team result
      const completeOnboardingSpy = jest.spyOn(
        onboardingService,
        'completeOnboarding',
      );
      const completedUser = {
        ...mockUser1,
        setupComplete: true,
        accountType: 'team' as const,
        bio: 'Leading our amazing team',
        avatarUrl: 'https://example.com/team-leader.jpg',
      };

      const createdGroup = {
        id: 'group-123',
        name: 'Amazing Dev Team',
        description: 'Building the future together',
        type: 'team' as const,
        website: 'https://amazing-team.com',
        avatarUrl: null,
        ein: null,
        documentsUrls: [],
        verified: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      const groupMember = {
        id: 'member-456',
        userId: mockUser1.id,
        groupId: createdGroup.id,
        role: 'owner' as const,
        status: GroupMemberStatus.active,
        invitationId: null,
        invitedName: null,
        invitedEmail: null,
        joinedAt: new Date('2024-01-01T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };

      completeOnboardingSpy.mockResolvedValue({
        user: completedUser,
        group: createdGroup,
        groupMember: groupMember,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('/auth/onboarding'))
        .set(createAuthHeaders())
        .send({
          accountType: 'team',
          teamName: 'Amazing Dev Team',
          mission: 'Building the future together',
          website: 'https://amazing-team.com',
          bio: 'Leading our amazing team',
          avatarUrl: 'https://example.com/team-leader.jpg',
          members: [
            {
              name: 'John Doe',
              email: 'john@amazing-team.com',
              role: 'viewer',
            },
            {
              name: 'Jane Smith',
              email: 'jane@amazing-team.com',
              role: 'viewer',
            },
          ],
        })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Onboarding completed successfully',
        user: {
          id: completedUser.id,
          clerkId: completedUser.clerkId,
          email: completedUser.email,
          firstName: completedUser.firstName,
          lastName: completedUser.lastName,
          avatarUrl: completedUser.avatarUrl,
          bio: completedUser.bio,
          accountType: completedUser.accountType,
          setupComplete: true,
          createdAt: completedUser.createdAt.toISOString(),
          updatedAt: completedUser.updatedAt.toISOString(),
          groupMemberships: [],
        },
        group: {
          id: createdGroup.id,
          name: createdGroup.name,
          description: createdGroup.description,
          type: createdGroup.type,
          website: createdGroup.website,
          avatarUrl: createdGroup.avatarUrl,
          ein: createdGroup.ein,
          documentsUrls: createdGroup.documentsUrls,
          verified: createdGroup.verified,
          createdAt: createdGroup.createdAt.toISOString(),
          updatedAt: createdGroup.updatedAt.toISOString(),
        },
        groupMember: {
          id: groupMember.id,
          userId: groupMember.userId,
          groupId: groupMember.groupId,
          role: 'owner',
          invitedName: groupMember.invitedName,
          invitedEmail: groupMember.invitedEmail,
          joinedAt: groupMember.joinedAt.toISOString(),
          createdAt: groupMember.createdAt.toISOString(),
          updatedAt: groupMember.updatedAt.toISOString(),
          status: groupMember.status,
          invitationId: groupMember.invitationId,
        },
      });

      // Verify the service was called with correct parameters
      expect(completeOnboardingSpy).toHaveBeenCalledWith(
        mockUser1.clerkId,
        expect.objectContaining({
          accountType: 'team',
          teamName: 'Amazing Dev Team',
          mission: 'Building the future together',
          website: 'https://amazing-team.com',
          bio: 'Leading our amazing team',
          avatarUrl: 'https://example.com/team-leader.jpg',
          members: expect.arrayContaining([
            expect.objectContaining({
              name: 'John Doe',
              email: 'john@amazing-team.com',
              role: 'viewer',
            }),
            expect.objectContaining({
              name: 'Jane Smith',
              email: 'jane@amazing-team.com',
              role: 'viewer',
            }),
          ]),
        }),
      );
    });

    // Add more onboarding tests...
  });
});
