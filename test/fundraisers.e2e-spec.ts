import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import { AccountType, GroupMemberRole } from '../generated/prisma';
import * as request from 'supertest';
import {
  addUserToGroup,
  createFakeUserWithToken,
} from './factories/users.factory';
import { buildFakeFundraiser } from './factories/fundraisers.factory';
import {
  FundraiserCategory,
  FundraiserOwnerType,
} from '../src/features/fundraisers/dtos/create-fundraiser.dto';

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

  describe('POST /api/v1/fundraisers', () => {
    it('should return 401 Unauthorized when user is not authenticated', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(user);

      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .send(fundraiser)
        .expect(401);
    });

    it('should create a group-owned fundraiser when user is authorized and group exists', async () => {
      // Create a Team
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(group!);

      const response = await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(fundraiser);

      expect(response.statusCode).toBe(201);
    });

    it('should create a user-owned fundraiser when valid data is provided', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(user);

      const response = await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(fundraiser);

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 Bad Request when required fields are missing or invalid', async () => {
      // Create a Team
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Empty title
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { title: '' }))
        .expect(400);

      // Title too long
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { title: 'a'.repeat(101) }))
        .expect(400);

      // Empty summary
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { summary: '' }))
        .expect(400);

      // Empty description
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { description: '' }))
        .expect(400);

      // Invalid Category
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(
          buildFakeFundraiser(group!, {
            category: 'invalid' as FundraiserCategory,
          }),
        )
        .expect(400);

      // Invalid Owner Type
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(
          buildFakeFundraiser(group!, {
            ownerType: 'invalid' as FundraiserOwnerType,
          }),
        )
        .expect(400);

      // Cover URL not valid
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { coverUrl: 'invalid' }))
        .expect(400);

      // Gallery URLs not valid
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { galleryUrls: ['invalid'] }))
        .expect(400);

      // Goal amount 0
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { goalAmount: 0 }))
        .expect(400);

      // Goal amount not a number
      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(buildFakeFundraiser(group!, { goalAmount: 'invalid' as any }))
        .expect(400);
    });

    it('should return 400 Bad Request when ownerType is group but groupId is missing', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(group!, {
        groupId: undefined,
      });

      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`)
        .send(fundraiser)
        .expect(400);
    });

    it('should return 403 Forbidden when user is not a member of the group', async () => {
      // Individual Account
      const { token: individualToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Team Account
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(group!);

      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${individualToken}`)
        .send(fundraiser)
        .expect(403);
    });

    it('should return 403 Forbidden when user has insufficient group role', async () => {
      // Individual Account
      const { token: individualToken, user: individualUser } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
          setupComplete: true,
        });

      // Team Account
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await addUserToGroup(individualUser, group!, GroupMemberRole.viewer);

      const fundraiser = buildFakeFundraiser(group!);

      await request(app.getHttpServer())
        .post(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${individualToken}`)
        .send(fundraiser)
        .expect(403);
    });
  });
});
