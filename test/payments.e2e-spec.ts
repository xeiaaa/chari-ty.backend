import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import { AccountType } from '../generated/prisma';
import * as request from 'supertest';
import { createFakeUserWithToken } from './factories/users.factory';

describe('Payments Module', () => {
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

  describe('POST /api/v1/payments/stripe/connect', () => {
    it('should return 401 Unauthorized when user is not authenticated', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/connect'))
        .send({ groupId: group!.id })
        .expect(401);
    });

    it('should return 400 Bad Request when groupId is missing', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/connect'))
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should return 404 Not Found when group does not exist', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/connect'))
        .set('Authorization', `Bearer ${token}`)
        .send({ groupId: 'non-existent-group-id' })
        .expect(404);
    });

    it('should return 400 Bad Request when user is not the group owner', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create another user and group
      const { group: otherGroup } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/connect'))
        .set('Authorization', `Bearer ${token}`)
        .send({ groupId: otherGroup!.id })
        .expect(400);
    });

    it('should create Stripe Connect account and return onboarding URL when user is group owner', async () => {
      // Mock Stripe SDK
      jest.mock('stripe', () => {
        return jest.fn().mockImplementation(() => ({
          accounts: {
            create: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
          },
          accountLinks: {
            create: jest.fn().mockResolvedValue({
              url: 'https://connect.stripe.com/onboarding/test-link',
            }),
          },
        }));
      });

      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/connect'))
        .set('Authorization', `Bearer ${token}`)
        .send({ groupId: group!.id });

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty('url');
      expect(typeof response.body.url).toBe('string');
      expect(response.body.url).toContain('stripe.com');
    });
  });
});
