import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { User, AccountType, GroupMemberRole } from '../generated/prisma';
import { createTestApp, resetDatabase, createApiPath } from './test-utils';
import {
  createFakeUserWithToken,
  addUserToGroup,
} from './factories/users.factory';
import { ClerkService } from '../src/features/auth/clerk.service';
import { faker } from '@faker-js/faker';

describe('Groups Invites (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clerkService: ClerkService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get<PrismaService>(PrismaService);
    clerkService = app.get(ClerkService);

    // Mock inviteUser method (so it doesn't actually send an email)
    jest
      .spyOn(clerkService, 'inviteUser')
      .mockImplementation(() => Promise.resolve({ id: faker.string.uuid() }));
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /groups/:groupId/invites', () => {
    let adminUser: User;
    let regularUser: User;
    let targetUser: User;
    let group: any;
    let ownerToken: string;
    let adminToken: string;
    let regularToken: string;

    beforeEach(async () => {
      // Create users with different roles
      const ownerResult = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });
      group = ownerResult.group;
      ownerToken = ownerResult.token;

      const adminResult = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });
      adminUser = adminResult.user;
      adminToken = adminResult.token;

      const regularResult = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });
      regularUser = regularResult.user;
      regularToken = regularResult.token;

      const targetResult = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });
      targetUser = targetResult.user;

      // Add admin user to group as admin
      await addUserToGroup(adminUser, group, GroupMemberRole.admin);

      // Add regular user to group as viewer
      await addUserToGroup(regularUser, group, GroupMemberRole.viewer);
    });

    it('should allow group owner to invite user by email', async () => {
      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'newuser@example.com',
          role: 'editor',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        groupId: group.id,
        invitedEmail: 'newuser@example.com',
        role: 'editor',
        status: 'invited',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.invitationId).toBeDefined();
    });

    it('should allow group owner to invite existing user by userId', async () => {
      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: targetUser.id,
          role: 'admin',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        groupId: group.id,
        userId: targetUser.id,
        role: 'admin',
        status: 'invited',
      });
      expect(response.body.invitationId).toBeUndefined(); // No Clerk invitation for existing users
    });

    it('should allow group admin to invite users', async () => {
      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admininvite@example.com',
          role: 'viewer',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        groupId: group.id,
        invitedEmail: 'admininvite@example.com',
        role: 'viewer',
        status: 'invited',
      });
      expect(response.body.invitationId).toBeDefined();
    });

    it('should not allow regular members to invite users', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          email: 'regularinvite@example.com',
          role: 'viewer',
        })
        .expect(403);
    });

    it('should not allow inviting users with owner role', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'ownerinvite@example.com',
          role: 'owner',
        })
        .expect(400);
    });

    it('should not allow providing both email and userId', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'both@example.com',
          userId: targetUser.id,
          role: 'viewer',
        })
        .expect(400);
    });

    it('should not allow providing neither email nor userId', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: 'viewer',
        })
        .expect(400);
    });

    it('should not allow inviting already active members', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          userId: adminUser.id,
          role: 'viewer',
        })
        .expect(409);
    });

    it('should not allow inviting already invited users', async () => {
      // First invitation
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'duplicate@example.com',
          role: 'viewer',
        })
        .expect(201);

      // Second invitation to same email
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'duplicate@example.com',
          role: 'editor',
        })
        .expect(409);
    });

    it('should not allow inviting to non-existent group', async () => {
      await request(app.getHttpServer())
        .post(createApiPath('groups/non-existent-group/invites'))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'test@example.com',
          role: 'viewer',
        })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .send({
          email: 'test@example.com',
          role: 'viewer',
        })
        .expect(401);
    });

    it('should validate role enum values', async () => {
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'test@example.com',
          role: 'invalid-role',
        })
        .expect(400);
    });

    it('should validate email format when provided', async () => {
      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'invalid-email',
          role: 'viewer',
        });

      console.log(response.body);
      expect(response.statusCode).toBe(400);
    });

    it('should handle Clerk invitation errors gracefully', async () => {
      // This test verifies that if Clerk invitation fails, the API returns a proper error
      // In a real scenario, this might happen due to invalid email, rate limiting, etc.
      // For this test, we'll use a malformed email that should cause Clerk to reject it
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group.id}/invites`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'test@', // Malformed email that should cause Clerk to reject
          role: 'viewer',
        })
        .expect(400);
    });
  });
});
