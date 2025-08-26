import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import {
  AccountType,
  FundraiserCategory,
  FundraiserStatus,
} from '../../generated/prisma';
import * as request from 'supertest';
import { createFakeUserWithToken } from '../factories/users.factory';
import { createFakeFundraiser } from '../factories/fundraisers.factory';
import { createFakeMilestone } from '../factories/milestones.factory';
import { Decimal } from '@prisma/client/runtime/library';

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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create fundraisers with different statuses
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
        isPublic: true,
      });
      await createFakeFundraiser(group!, {
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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create only draft and non-public fundraisers
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
        isPublic: true,
      });
      await createFakeFundraiser(group!, {
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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create published and public fundraisers with different categories
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.arts,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.health,
      });
      // Create a draft one that shouldn't appear
      await createFakeFundraiser(group!, {
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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create published and public fundraiser with specific title
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        title: 'Unique Art Project',
      });
      // Create a draft one that shouldn't appear
      await createFakeFundraiser(group!, {
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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
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
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: false,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`public/fundraisers/slug/${fundraiser.slug}`))
        .expect(404);
    });

    it('should return 404 for non-published fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
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

  describe('GET /api/v1/public/fundraisers/slug/:slug - Milestones', () => {
    it('should include milestones ordered by stepNumber ascending', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
      });

      // Create milestones in non-sequential order
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
        amount: new Decimal('300'),
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
        amount: new Decimal('100'),
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
        amount: new Decimal('200'),
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath(`public/fundraisers/slug/${fundraiser.slug}`),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.milestones).toBeDefined();
      expect(response.body.milestones).toHaveLength(3);

      // Verify order is ascending by stepNumber
      expect(response.body.milestones[0].stepNumber).toBe(1);
      expect(response.body.milestones[1].stepNumber).toBe(2);
      expect(response.body.milestones[2].stepNumber).toBe(3);
    });

    it('should include complete milestone structure', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
      });

      const { milestone } = await createFakeMilestone(fundraiser, {
        stepNumber: 1,
        amount: new Decimal('100'),
        title: 'First Milestone',
        purpose: 'Initial goal',
        achieved: true,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath(`public/fundraisers/slug/${fundraiser.slug}`),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.milestones).toHaveLength(1);

      const returnedMilestone = response.body.milestones[0];
      expect(returnedMilestone.id).toBe(milestone.id);
      expect(returnedMilestone.fundraiserId).toBe(fundraiser.id);
      expect(returnedMilestone.stepNumber).toBe(1);
      expect(returnedMilestone.amount).toBe('100');
      expect(returnedMilestone.title).toBe('First Milestone');
      expect(returnedMilestone.purpose).toBe('Initial goal');
      expect(returnedMilestone.achieved).toBe(true);
      expect(returnedMilestone.achievedAt).toBeDefined();
      expect(returnedMilestone.createdAt).toBeDefined();
      expect(returnedMilestone.updatedAt).toBeDefined();
    });

    it('should return empty milestones array for fundraiser without milestones', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath(`public/fundraisers/slug/${fundraiser.slug}`),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.milestones).toBeDefined();
      expect(response.body.milestones).toHaveLength(0);
    });
  });

  describe('Progress Information Tests', () => {
    it('should include progress information in list response', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        goalAmount: new Decimal('1000'),
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('public/fundraisers'),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.items).toHaveLength(1);

      const fundraiser = response.body.items[0];
      expect(fundraiser.progress).toBeDefined();
      expect(fundraiser.progress.totalRaised).toBeDefined();
      expect(fundraiser.progress.donationCount).toBeDefined();
      expect(fundraiser.progress.progressPercentage).toBeDefined();

      // Verify progress structure
      expect(typeof fundraiser.progress.totalRaised).toBe('string');
      expect(typeof fundraiser.progress.donationCount).toBe('number');
      expect(typeof fundraiser.progress.progressPercentage).toBe('number');
    });

    it('should include progress information in single fundraiser response', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        goalAmount: new Decimal('1000'),
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath(`public/fundraisers/slug/${fundraiser.slug}`),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.progress).toBeDefined();
      expect(response.body.progress.totalRaised).toBeDefined();
      expect(response.body.progress.donationCount).toBeDefined();
      expect(response.body.progress.progressPercentage).toBeDefined();
    });

    it('should calculate correct progress percentage', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        goalAmount: new Decimal('1000'),
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('public/fundraisers'),
      );

      expect(response.statusCode).toBe(200);
      const fundraiser = response.body.items[0];

      // For new fundraisers, progress should be 0
      expect(fundraiser.progress.totalRaised).toBe('0');
      expect(fundraiser.progress.donationCount).toBe(0);
      expect(fundraiser.progress.progressPercentage).toBe(0);
    });
  });

  describe('GET /api/v1/public/fundraisers/categories', () => {
    it('should return categories with counts of published fundraisers', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create published and public fundraisers with different categories
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.education,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.education,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.education,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: true,
        category: FundraiserCategory.other,
      });

      // Create fundraisers that should not be counted
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
        isPublic: true,
        category: FundraiserCategory.health,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: false,
        category: FundraiserCategory.arts,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('public/fundraisers/categories'),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        education: 3,
        other: 1,
      });
    });

    it('should return empty object when no published and public fundraisers exist', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create only draft and non-public fundraisers
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.draft,
        isPublic: true,
        category: FundraiserCategory.health,
      });
      await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
        isPublic: false,
        category: FundraiserCategory.arts,
      });

      const response = await request(app.getHttpServer()).get(
        createApiPath('public/fundraisers/categories'),
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({});
    });
  });
});
