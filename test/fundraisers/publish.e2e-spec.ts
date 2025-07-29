import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import {
  AccountType,
  GroupMemberRole,
  FundraiserStatus,
} from '../../generated/prisma';
import * as request from 'supertest';
import {
  addUserToGroup,
  createFakeUserWithToken,
} from '../factories/users.factory';
import { createFakeFundraiser } from '../factories/fundraisers.factory';
import { PrismaService } from '../../src/core/prisma/prisma.service';
import {
  createFakeDonation,
  createFakeFailedDonation,
  createFakePendingDonation,
  createFakeRefundedDonation,
} from '../factories/donations.factory';

describe('Fundraisers Module - Publish', () => {
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

    it('should allow unpublishing fundraiser even when group has no Stripe connection (no donations)', async () => {
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

    it('should throw BadRequestException when trying to unpublish fundraiser that has completed donations', async () => {
      const { token, group, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      // Create a completed donation for the fundraiser
      await createFakeDonation(fundraiser, user, { status: 'completed' });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Cannot unpublish fundraiser: Fundraiser has received donations and cannot be unpublished',
          );
        });
    });

    it('should allow unpublishing fundraiser when it has no donations', async () => {
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
        status: FundraiserStatus.published,
      });

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.draft);
    });

    it('should allow unpublishing fundraiser with failed donations', async () => {
      const { token, group, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      // Create a failed donation for the fundraiser
      await createFakeFailedDonation(fundraiser, user);

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.draft);
    });

    it('should throw BadRequestException when trying to unpublish fundraiser with completed donations', async () => {
      const { token, group, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      // Create a completed donation for the fundraiser
      await createFakeDonation(fundraiser, user, { status: 'completed' });

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Cannot unpublish fundraiser: Fundraiser has received donations and cannot be unpublished',
          );
        });
    });

    it('should throw BadRequestException when trying to unpublish fundraiser with pending donations', async () => {
      const { token, group, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      // Create a pending donation for the fundraiser
      await createFakePendingDonation(fundraiser, user);

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe(
            'Cannot unpublish fundraiser: Fundraiser has received donations and cannot be unpublished',
          );
        });
    });

    it('should allow unpublishing fundraiser with refunded donations', async () => {
      const { token, group, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Add Stripe ID to the group
      await prisma.group.update({
        where: { id: group!.id },
        data: { stripeId: 'acct_test123' },
      });

      const { fundraiser } = await createFakeFundraiser(group!, {
        status: FundraiserStatus.published,
      });

      // Create a refunded donation for the fundraiser
      await createFakeRefundedDonation(fundraiser, user);

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/publish`))
        .set('Authorization', `Bearer ${token}`)
        .send({ published: false });

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe(FundraiserStatus.draft);
    });
  });
});
