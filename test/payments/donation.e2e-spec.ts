// Mock Stripe before any imports
jest.mock('stripe', () => {
  const mockStripe = jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_secret_123',
      }),
    },
    accounts: {
      create: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
    },
    accountLinks: {
      create: jest.fn().mockResolvedValue({
        url: 'https://connect.stripe.com/onboarding/test-link',
      }),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
        }),
      },
    },
  }));

  // Return the mock as both default and named export
  return {
    __esModule: true,
    default: mockStripe,
    Stripe: mockStripe,
  };
});

import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import { AccountType } from '../../generated/prisma';
import * as request from 'supertest';
import { createFakeUserWithToken } from '../factories/users.factory';
import { createFakeFundraiser } from '../factories/fundraisers.factory';
import { createFakeLink } from '../factories/links.factory';
import { PrismaService } from '../../src/core/prisma/prisma.service';

describe('Payments Module', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/v1/payments/stripe/create-intent', () => {
    it('should successfully Create a Stripe PaymentIntent for a donation (with alias)', async () => {
      const { group, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Update group to have Stripe ID (required for payment intent creation)
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test_123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { link } = await createFakeLink(user, fundraiser);
      const response = await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/create-intent'))
        .send({ fundraiserId: fundraiser.id, amount: 100, alias: link.alias });

      expect(response.status).toBe(201);

      const donation = await prisma.donation.findFirst({
        where: { fundraiserId: fundraiser.id },
      });

      expect(donation).toBeDefined();
      expect(donation?.fundraiserLinkId).toBe(link.id);
    });

    it('should successfully Create a Stripe PaymentIntent for a donation (without alias)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Update group to have Stripe ID (required for payment intent creation)
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test_123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const response = await request(app.getHttpServer())
        .post(createApiPath('payments/stripe/create-intent'))
        .send({ fundraiserId: fundraiser.id, amount: 100 });

      expect(response.status).toBe(201);

      const donation = await prisma.donation.findFirst({
        where: { fundraiserId: fundraiser.id },
      });

      expect(donation).toBeDefined();
      expect(donation?.fundraiserLinkId).toBeNull();
    });
  });
});
