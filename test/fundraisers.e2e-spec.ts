import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import {
  AccountType,
  GroupMemberRole,
  FundraiserCategory,
  FundraiserOwnerType,
  FundraiserStatus,
} from '../generated/prisma';
import * as request from 'supertest';
import {
  addUserToGroup,
  createFakeUserWithToken,
} from './factories/users.factory';
import {
  buildFakeFundraiser,
  createFakeFundraiser,
} from './factories/fundraisers.factory';

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

  describe('GET /api/v1/fundraisers', () => {
    it('should return a list of fundraisers owned by the authenticated user', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // User 1 fundraiser 1
      await createFakeFundraiser(user);

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(1);
      expect(response.body.meta.total).toBe(1);

      // User 1 creates 2 more fundraisers
      await createFakeFundraiser(user);
      await createFakeFundraiser(user);

      // Create another user and fundraiser (this should not be returned)
      const { user: user2 } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // User 2 creates 1 fundraiser
      await createFakeFundraiser(user2);

      const response2 = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`);

      expect(response2.statusCode).toBe(200);
      expect(response2.body.items.length).toBe(3);
      expect(response2.body.meta.total).toBe(3);
    });

    it('should return an empty list when the user has no fundraisers', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return a list of fundraisers owned by the specified group if the user is a member', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await createFakeFundraiser(group!);
      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .query({ groupId: group!.id }) // Important: add groupId when retrieving group-related fundraisers
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(1);
      expect(response.body.meta.total).toBe(1);
    });

    it('should return fundraisers filtered by the specified category', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await createFakeFundraiser(group!, { category: FundraiserCategory.arts });
      await createFakeFundraiser(group!, {
        category: FundraiserCategory.health,
      });
      await createFakeFundraiser(group!, {
        category: FundraiserCategory.arts,
      });
      await createFakeFundraiser(group!, {
        category: FundraiserCategory.other,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .query({ groupId: group!.id, category: FundraiserCategory.arts })
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('should return fundraisers filtered by the specified status', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.pending,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.suspended,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .query({ groupId: group!.id, status: FundraiserStatus.published })
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('should return fundraisers matching the search term in title or summary', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await createFakeFundraiser(group!, {
        title: 'Test 1',
      });
      await createFakeFundraiser(group!, {
        title: 'Test 2',
      });
      await createFakeFundraiser(group!, {
        title: 'Test 3',
      });
      await createFakeFundraiser(group!, {
        title: 'Test 4',
      });
      await createFakeFundraiser(group!, {
        title: 'Fundraiser 1',
      });
      await createFakeFundraiser(group!, {
        title: 'Orion',
        summary: 'Orion is a Fundraiser',
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .query({ groupId: group!.id, search: 'Fundraiser' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(2);
      expect(response.body.meta.total).toBe(2);
    });

    it('should return fundraisers filtered by isPublic status', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        isPublic: true,
      });
      await createFakeFundraiser(group!, {
        isPublic: false,
      });
      await createFakeFundraiser(group!, {
        isPublic: false,
      });
      await createFakeFundraiser(group!, {
        isPublic: false,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .query({ groupId: group!.id, isPublic: true })
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items[0].title).toBe(fundraiser.title);
    });

    it('should return fundraisers sorted by the specified sortBy and sortOrder', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser: first } = await createFakeFundraiser(group!, {
        createdAt: new Date('2025-01-01'),
      });
      await createFakeFundraiser(group!, { createdAt: new Date('2025-01-02') });
      await createFakeFundraiser(group!, { createdAt: new Date('2025-01-03') });
      const { fundraiser: last } = await createFakeFundraiser(group!, {
        createdAt: new Date('2025-01-04'),
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .query({ groupId: group!.id, page: 1, limit: 4, sortOrder: 'asc' })
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);

      expect(response.body.items[0].title).toBe(first.title);
      expect(response.body.items[3].title).toBe(last.title);
    });
  });

  it('should return paginated results with correct limit and page metadata', async () => {
    const { token, group } = await createFakeUserWithToken({
      accountType: AccountType.team,
      setupComplete: true,
    });

    await createFakeFundraiser(group!, { createdAt: new Date('2025-01-01') });
    await createFakeFundraiser(group!, { createdAt: new Date('2025-01-02') });
    await createFakeFundraiser(group!, { createdAt: new Date('2025-01-03') });
    const { fundraiser } = await createFakeFundraiser(group!, {
      createdAt: new Date('2025-01-04'),
    });

    const response = await request(app.getHttpServer())
      .get(createApiPath('fundraisers'))
      .query({ groupId: group!.id, page: 2, limit: 3, sortOrder: 'asc' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    console.log(response.body, fundraiser);
    expect(response.body.items[0].title).toBe(fundraiser.title);
    expect(response.body.meta.page).toBe(2);
    expect(response.body.meta.totalPages).toBe(2);
    expect(response.body.meta.total).toBe(4);
  });

  it('should return 401 Unauthorized when the user is not authenticated', async () => {
    const { user } = await createFakeUserWithToken({
      accountType: AccountType.individual,
      setupComplete: true,
    });

    // User 1 fundraiser 1
    await createFakeFundraiser(user);

    await request(app.getHttpServer())
      .get(createApiPath('fundraisers'))
      .expect(401);
  });
});
