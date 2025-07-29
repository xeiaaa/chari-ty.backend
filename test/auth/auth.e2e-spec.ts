import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import { AccountType } from '../../generated/prisma';
import * as request from 'supertest';
import {
  addUserToGroup,
  createFakeUserWithToken,
} from '../factories/users.factory';
import { GroupMemberStatus, GroupMemberRole } from '../../generated/prisma';

describe('Auth Module', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Create test app before all tests
    app = await createTestApp();
    // clerkService = app.get(ClerkService);
  });

  afterAll(async () => {
    // Close test app after all tests
    await app.close();
  });

  beforeEach(async () => {
    // Reset database before each test
    await resetDatabase();
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return the authenticated user profile when a valid token is provided', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('auth/me'))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(user.id);
    });

    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('auth/me'),
      );

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 Unauthorized when token is invalid or expired', async () => {
      await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('auth/me'))
        .set('Authorization', `Bearer WRONG_TOKEN`);

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me/groups', () => {
    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      const { user: individualUser } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await addUserToGroup(individualUser, group!);

      const response = await request(app.getHttpServer()).get(
        createApiPath('auth/me/groups'),
      );

      expect(response.statusCode).toBe(401);
    });

    it('should return the authenticated user groups when a valid token is provided', async () => {
      // Create an individual user
      const {
        user: individualUser,
        token: individualToken,
        group: individualGroup,
      } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      // Create a team owner (with a group)
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add the individual user to the team group
      await addUserToGroup(individualUser, group!);

      const response = await request(app.getHttpServer())
        .get(createApiPath('auth/me/groups'))
        .set('Authorization', `Bearer ${individualToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body[1].id).toBe(individualGroup!.id);
      expect(response.body[0].id).toBe(group!.id);
    });

    it('should return 200 OK with a one-item array when user has not been invited to any groups', async () => {
      // Create an individual user
      const { token: individualToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      // Create a team owner (with a group)
      await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('auth/me/groups'))
        .set('Authorization', `Bearer ${individualToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBe(1);
    });

    it('should not return groups where user is not an active member', async () => {
      // Create an individual user (to be added to a group)
      const { user: individualUser, token: individualToken } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
        });

      // Create another individual user (will not be added to the group)
      const { token: individual2Token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      // Create a team owner (with a group)
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add the individual user to the team group
      await addUserToGroup(individualUser, group!);

      const response1 = await request(app.getHttpServer())
        .get(createApiPath('auth/me/groups'))
        .set('Authorization', `Bearer ${individualToken}`);

      expect(response1.statusCode).toBe(200);
      expect(response1.body.length).toBe(2);

      const response2 = await request(app.getHttpServer())
        .get(createApiPath('auth/me/groups'))
        .set('Authorization', `Bearer ${individual2Token}`);

      expect(response2.statusCode).toBe(200);
      expect(response2.body.length).toBe(1);
    });
  });

  describe('POST /api/v1/auth/accept-invitation', () => {
    it('should accept a valid group invitation', async () => {
      // Create a user who will receive the invitation
      const { user: invitedUser, token: invitedUserToken } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
        });

      // Create a group owner
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add the user to the group with invited status
      await addUserToGroup(
        invitedUser,
        group!,
        GroupMemberRole.viewer,
        GroupMemberStatus.invited,
      );

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/accept-invitation'))
        .set('Authorization', `Bearer ${invitedUserToken}`)
        .send({
          groupId: group!.id,
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toContain('Successfully joined');
      expect(response.body.groupMember.status).toBe('active');
      expect(response.body.groupMember.groupId).toBe(group!.id);
      expect(response.body.groupMember.userId).toBe(invitedUser.id);
    });

    it('should return 404 when invitation does not exist', async () => {
      const { token: userToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/accept-invitation'))
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          groupId: 'non-existent-group-id',
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe(
        'Invitation not found or already accepted',
      );
    });

    it('should return 404 when invitation is already accepted', async () => {
      // Create a user who will receive the invitation
      const { user: invitedUser, token: invitedUserToken } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
        });

      // Create a group owner
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add the user to the group with active status (already accepted)
      await addUserToGroup(
        invitedUser,
        group!,
        GroupMemberRole.viewer,
        GroupMemberStatus.active,
      );

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/accept-invitation'))
        .set('Authorization', `Bearer ${invitedUserToken}`)
        .send({
          groupId: group!.id,
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe(
        'Invitation not found or already accepted',
      );
    });

    it('should return 401 when no authentication token is provided', async () => {
      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/accept-invitation'))
        .send({
          groupId: 'some-group-id',
        });

      expect(response.statusCode).toBe(401);
    });
  });
});
