import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import {
  AccountType,
  GroupMemberRole,
  FundraiserCategory,
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
import { PrismaService } from '../src/core/prisma/prisma.service';

describe('Auth Module', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Create test app before all tests
    app = await createTestApp();
    prisma = app.get(PrismaService);
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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(group!);

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

    it('should create a fundraiser for individual user group when valid data is provided', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const fundraiser = buildFakeFundraiser(group!);

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

    it('should return 400 Bad Request when groupId is missing', async () => {
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
    it('should return a list of fundraisers from groups the user is a member of', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // User's group fundraiser 1
      await createFakeFundraiser(group!);

      const response = await request(app.getHttpServer())
        .get(createApiPath('fundraisers'))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(1);
      expect(response.body.meta.total).toBe(1);

      // User's group creates 2 more fundraisers
      await createFakeFundraiser(group!);
      await createFakeFundraiser(group!);

      // Create another user and fundraiser (this should not be returned)
      const { group: group2 } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // User 2's group creates 1 fundraiser
      await createFakeFundraiser(group2!);

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

  describe('GET /api/v1/fundraisers/:fundraiserId', () => {
    it("should return a fundraiser owned by the requesting user's group", async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(fundraiser.title);
    });

    it('should return a fundraiser owned by a group the user is a member of', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // User 1 fundraiser 1
      const { fundraiser } = await createFakeFundraiser(group!);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(fundraiser.title);
    });

    it('should throw NotFoundException when the fundraiser does not exist', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a fundraiser
      const { fundraiser } = await createFakeFundraiser(group!);

      // Delete the fundraiser
      await prisma.fundraiser.delete({
        where: { id: fundraiser.id },
      });

      // Try to get the fundraiser
      await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it("should throw ForbiddenException when the user tries to access another group's fundraiser", async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);
    });

    it('should throw ForbiddenException when the user is not a member of the group that owns the fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${anotherUserToken}`);

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/fundraisers/:fundraiserId', () => {
    it("should update a fundraiser owned by the user's group", async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const newTitle = 'New Title';

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: newTitle });

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(newTitle);
    });

    it('should update a fundraiser owned by a group the user is an owner of', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const newTitle = 'New Title';

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: newTitle });

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(newTitle);
    });

    it('should throw NotFoundException when the fundraiser does not exist', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a fundraiser
      const { fundraiser } = await createFakeFundraiser(group!);

      // Delete the fundraiser
      await prisma.fundraiser.delete({
        where: { id: fundraiser.id },
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' })
        .expect(404);
    });

    it("should throw ForbiddenException when the user tries to access another group's fundraiser", async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ title: 'New Title' })
        .expect(403);
    });

    it('should throw ForbiddenException when the user is not a member of the group that owns the fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ title: 'New Title' });

      expect(response.statusCode).toBe(403);
    });

    it('should throw ForbiddenException when the group member has an insufficient role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'New Title' })
        .expect(403);
    });

    it('should update a fundraiser owned by a group the user is an editor of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await addUserToGroup(user, group!, GroupMemberRole.editor);
      const newTitle = 'New Title';

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: newTitle });

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(newTitle);
    });

    it('should update a fundraiser owned by a group the user is an admin of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await addUserToGroup(user, group!, GroupMemberRole.admin);
      const newTitle = 'New Title';

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: newTitle });

      expect(response.statusCode).toBe(200);
      expect(response.body.title).toBe(newTitle);
    });

    it('should return 400 Bad Request when the update payload contains invalid fields', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'a'.repeat(101) })
        .expect(400);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ goalAmount: 0 })
        .expect(400);
    });

    it('should throw ForbiddenException when attempting to update ownership fields like groupId', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ groupId: 'cmd3wyy1l0000hl1rd41su9hx' })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/fundraisers/:fundraiserId', () => {
    it("should delete a fundraiser owned by the user's group", async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const response = await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(204);

      // Verify fundraiser was deleted
      const deletedFundraiser = await prisma.fundraiser.findUnique({
        where: { id: fundraiser.id },
      });
      expect(deletedFundraiser).toBeNull();
    });

    it('should delete a fundraiser owned by a group the user is an admin of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const response = await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(204);

      // Verify fundraiser was deleted
      const deletedFundraiser = await prisma.fundraiser.findUnique({
        where: { id: fundraiser.id },
      });
      expect(deletedFundraiser).toBeNull();
    });

    it('should throw NotFoundException when the fundraiser does not exist', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(createApiPath('fundraisers/non-existent-id'))
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it("should throw ForbiddenException when the user tries to delete another group's fundraiser", async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);

      // Verify fundraiser was not deleted
      const existingFundraiser = await prisma.fundraiser.findUnique({
        where: { id: fundraiser.id },
      });
      expect(existingFundraiser).not.toBeNull();
    });

    it('should throw ForbiddenException when the user is not a member of the group that owns the fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);

      // Verify fundraiser was not deleted
      const existingFundraiser = await prisma.fundraiser.findUnique({
        where: { id: fundraiser.id },
      });
      expect(existingFundraiser).not.toBeNull();
    });

    it('should throw ForbiddenException when the group member has insufficient role to delete the fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      // Add user as editor (insufficient role for deletion)
      await addUserToGroup(user, group!, GroupMemberRole.editor);

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // Verify fundraiser was not deleted
      const existingFundraiser = await prisma.fundraiser.findUnique({
        where: { id: fundraiser.id },
      });
      expect(existingFundraiser).not.toBeNull();
    });
  });

  describe('PATCH /api/v1/fundraisers/:fundraiserId/publish', () => {
    it('should return 401 Unauthorized when user is not authenticated', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .send({ published: true })
        .expect(401);
    });

    it('should publish a group-owned fundraiser when group has Stripe connected', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
      });

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.published);
    });

    it('should unpublish a group-owned fundraiser', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.draft);
    });

    it('should publish a group-owned fundraiser when user is the owner and group has Stripe connected', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
      });

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.published);
    });

    it('should publish a group-owned fundraiser when user is an admin and group has Stripe connected', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
      });

      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.published);
    });

    it('should publish a group-owned fundraiser when user is an editor and group has Stripe connected', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
      });

      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.published);
    });

    it('should throw NotFoundException when the fundraiser does not exist', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/non-existent-id/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true })
        .expect(404);
    });

    it("should throw ForbiddenException when the user tries to publish another group's fundraiser", async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group to ensure the test fails due to permissions, not Stripe
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ published: true })
        .expect(403);
    });

    it('should throw ForbiddenException when the user is not a member of the group that owns the fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add Stripe ID to the group to ensure the test fails due to permissions, not Stripe
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      const { token: anotherUserToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ published: true })
        .expect(403);
    });

    it('should throw BadRequestException when trying to publish fundraiser for group without Stripe connection', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Cannot publish fundraiser: Group must be connected to Stripe to accept donations',
          );
        });
    });

    it('should allow unpublishing fundraiser even when group has no Stripe connection', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.draft);
    });

    it('should throw ForbiddenException when the group member has insufficient role (viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Add Stripe ID to the group to ensure the test fails due to permissions, not Stripe
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: true })
        .expect(403);
    });

    it('should return 400 Bad Request when published field is missing', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group to ensure the test fails due to validation, not Stripe
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should return 400 Bad Request when published field is not a boolean', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group to ensure the test fails due to validation, not Stripe
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: 'invalid' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: 1 })
        .expect(400);
    });
  });
});
