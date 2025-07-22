import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import { AccountType } from '../generated/prisma';
import * as request from 'supertest';
import { createFakeUserWithToken } from './factories/users.factory';

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
});
