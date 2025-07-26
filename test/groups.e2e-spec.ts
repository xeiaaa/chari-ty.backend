import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import { AccountType, GroupMemberRole } from '../generated/prisma';
import * as request from 'supertest';
import {
  createFakeUserWithToken,
  addUserToGroup,
} from './factories/users.factory';

describe('Groups Module', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('GET /api/v1/groups/slug/:slug', () => {
    it('should return group by slug for authenticated member', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: group!.id,
        name: group!.name,
        slug: group!.slug,
        stripeId: group!.stripeId,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 403 for non-member user', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath('groups/slug/non-existent-slug'))
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`groups/slug/${group!.slug}`))
        .expect(401);
    });
  });

  describe('PATCH /api/v1/groups/slug/:slug', () => {
    it('should update group by slug for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        website: 'https://updated-website.com',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: group!.id,
        name: updateData.name,
        description: updateData.description,
        website: updateData.website,
        slug: group!.slug,
      });
    });

    it('should return 403 for non-member user', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath('groups/slug/non-existent-slug'))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .send(updateData)
        .expect(401);
    });

    it('should return 403 for group member with editor role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user and add them as editor
      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 for group member with viewer role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user and add them as viewer
      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should allow group member with admin role to update group', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user and add them as admin
      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const updateData = {
        name: 'Updated Group Name by Admin',
        description: 'Updated by admin user',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: group!.id,
        name: updateData.name,
        description: updateData.description,
        slug: group!.slug,
      });
    });
  });
});
