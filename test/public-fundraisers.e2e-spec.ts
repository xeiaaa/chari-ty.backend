import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import {
  AccountType,
  FundraiserCategory,
  FundraiserStatus,
} from '../generated/prisma';
import * as request from 'supertest';
import { createFakeUserWithToken } from './factories/users.factory';
import { createFakeFundraiser } from './factories/fundraisers.factory';

describe('Public Fundraisers', () => {
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

  describe('GET /api/v1/public/fundraisers', () => {
    it('should only return published and public fundraisers', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create fundraisers with different statuses
      await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: true,
      });
      await createFakeFundraiser(user, {
        status: FundraiserStatus.draft,
        isPublic: true,
      });
      await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: false,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('public/fundraisers'),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].status).toBe(FundraiserStatus.published);
      expect(response.body.items[0].isPublic).toBe(true);
    });

    it('should return empty list when no published and public fundraisers exist', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create only draft and non-public fundraisers
      await createFakeFundraiser(user, {
        status: FundraiserStatus.draft,
        isPublic: true,
      });
      await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: false,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('public/fundraisers'),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(0);
      expect(response.body.meta.total).toBe(0);
    });

    it('should return published and public fundraisers filtered by category', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create published and public fundraisers with different categories
      await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.arts,
      });
      await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.health,
      });
      // Create a draft one that shouldn't appear
      await createFakeFundraiser(user, {
        status: FundraiserStatus.draft,
        isPublic: true,
        category: FundraiserCategory.arts,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('public/fundraisers'))
        .query({ category: FundraiserCategory.arts });

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].category).toBe(FundraiserCategory.arts);
      expect(response.body.items[0].status).toBe(FundraiserStatus.published);
      expect(response.body.items[0].isPublic).toBe(true);
    });

    it('should return published and public fundraisers matching search term', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create published and public fundraiser with specific title
      await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: true,
        title: 'Unique Art Project',
      });
      // Create a draft one that shouldn't appear
      await createFakeFundraiser(user, {
        status: FundraiserStatus.draft,
        isPublic: true,
        title: 'Unique Health Project',
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath('public/fundraisers'))
        .query({ search: 'Unique' });

      expect(response.statusCode).toBe(200);
      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].title).toBe('Unique Art Project');
      expect(response.body.items[0].status).toBe(FundraiserStatus.published);
      expect(response.body.items[0].isPublic).toBe(true);
    });
  });

  describe('GET /api/v1/public/fundraisers/slug/:slug', () => {
    it('should return a published and public fundraiser by slug', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: true,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath(`public/fundraisers/slug/${fundraiser.slug}`),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(fundraiser.id);
      expect(response.body.status).toBe(FundraiserStatus.published);
      expect(response.body.isPublic).toBe(true);
    });

    it('should return 404 for non-public fundraiser', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user, {
        status: FundraiserStatus.published,
        isPublic: false,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`public/fundraisers/slug/${fundraiser.slug}`))
        .expect(404);
    });

    it('should return 404 for non-published fundraiser', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user, {
        status: FundraiserStatus.draft,
        isPublic: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`public/fundraisers/slug/${fundraiser.slug}`))
        .expect(404);
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app.getHttpServer())
        .get(createApiPath('public/fundraisers/slug/non-existent-slug'))
        .expect(404);
    });
  });
});
