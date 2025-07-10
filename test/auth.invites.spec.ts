import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createApiPath,
  createAuthHeaders,
  createDevelopmentToken,
  mockUser1,
  seedTestDatabase,
  mockAuth,
} from './test-utils';
import { UsersService } from '../src/features/users/users.service';
import { ClerkService } from '../src/features/auth/clerk.service';
import {
  GroupMemberRole,
  GroupMemberStatus,
  GroupType,
} from '../generated/prisma';
import { PrismaService } from '../src/core/prisma/prisma.service';

describe('AuthController Invites (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let clerkService: ClerkService;
  let prisma: PrismaService;

  beforeEach(async () => {
    await seedTestDatabase();
    app = await createTestApp();
    usersService = app.get(UsersService);
    clerkService = app.get(ClerkService);
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    // Clean up the database
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await app.close();
    jest.clearAllMocks();
  });

  describe('GET /auth/me/invites', () => {
    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      await request(app.getHttpServer())
        .get(createApiPath('/auth/me/invites'))
        .expect(401);
    });

    it('should return 401 Unauthorized when token is invalid or expired', async () => {
      // Mock the ClerkService to simulate an invalid token
      const { verifySessionTokenSpy } = mockAuth(
        clerkService,
        usersService,
        mockUser1.clerkId,
        mockUser1.email,
        mockUser1,
      );
      verifySessionTokenSpy.mockRejectedValue(new Error('Invalid token'));

      await request(app.getHttpServer())
        .get(createApiPath('/auth/me/invites'))
        .set(createAuthHeaders('invalid-token'))
        .expect(401);
    });

    it('should return 200 OK with an empty array when user has no invites', async () => {
      mockAuth(
        clerkService,
        usersService,
        mockUser1.clerkId,
        mockUser1.email,
        mockUser1,
      );

      const response = await request(app.getHttpServer())
        .get(createApiPath('/auth/me/invites'))
        .set(
          createAuthHeaders(
            createDevelopmentToken(mockUser1.clerkId, mockUser1.email),
          ),
        )
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return only invites where user is registered and status is invited', async () => {
      try {
        mockAuth(
          clerkService,
          usersService,
          mockUser1.clerkId,
          mockUser1.email,
          mockUser1,
        );

        // Create test data
        const group1 = await prisma.group.create({
          data: {
            name: 'Test Team 1',
            type: GroupType.team,
            description: 'Test team 1 description',
          },
        });

        const group2 = await prisma.group.create({
          data: {
            name: 'Test Nonprofit 1',
            type: GroupType.nonprofit,
            description: 'Test nonprofit 1 description',
          },
        });

        const group3 = await prisma.group.create({
          data: {
            name: 'Test Team 2',
            type: GroupType.team,
            description: 'Test team 2 description',
          },
        });

        // Create different types of memberships
        const olderDate = new Date('2024-01-01');
        const newerDate = new Date('2024-02-01');

        // Create an invited membership for registered user (should be returned)
        await prisma.groupMember.create({
          data: {
            userId: mockUser1.id,
            groupId: group1.id,
            role: GroupMemberRole.admin,
            status: GroupMemberStatus.invited,
            joinedAt: olderDate,
          },
        });

        // Create another invited membership for registered user (should be returned)
        await prisma.groupMember.create({
          data: {
            userId: mockUser1.id,
            groupId: group2.id,
            role: GroupMemberRole.editor,
            status: GroupMemberStatus.invited,
            joinedAt: newerDate,
          },
        });

        // Create an invited membership for unregistered user (should NOT be returned)
        await prisma.groupMember.create({
          data: {
            groupId: group1.id,
            role: GroupMemberRole.viewer,
            status: GroupMemberStatus.invited,
            invitedEmail: 'unregistered@example.com',
            invitedName: 'Unregistered User',
            joinedAt: newerDate,
          },
        });

        // Create an active membership (should NOT be returned)
        await prisma.groupMember.create({
          data: {
            userId: mockUser1.id,
            groupId: group3.id,
            role: GroupMemberRole.viewer,
            status: GroupMemberStatus.active,
            joinedAt: newerDate,
          },
        });

        const response = await request(app.getHttpServer())
          .get(createApiPath('/auth/me/invites'))
          .set(
            createAuthHeaders(
              createDevelopmentToken(mockUser1.clerkId, mockUser1.email),
            ),
          )
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body).toEqual([
          {
            id: group2.id,
            name: group2.name,
            type: group2.type,
            role: GroupMemberRole.editor,
            dateActive: newerDate.toISOString(),
          },
          {
            id: group1.id,
            name: group1.name,
            type: group1.type,
            role: GroupMemberRole.admin,
            dateActive: olderDate.toISOString(),
          },
        ]);
      } finally {
        // Clean up test data
        await prisma.groupMember.deleteMany();
        await prisma.group.deleteMany();
      }
    });
  });
});
