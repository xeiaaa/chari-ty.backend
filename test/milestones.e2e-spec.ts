import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  createApiPath,
  createTestApp,
  resetDatabase,
  formatMilestoneResponse,
} from './test-utils';
import { AccountType, GroupMemberRole } from '../generated/prisma';
import * as request from 'supertest';
import {
  addUserToGroup,
  createFakeUserWithToken,
} from './factories/users.factory';
import { createFakeFundraiser } from './factories/fundraisers.factory';
import { buildFakeMilestone } from './factories/milestones.factory';

describe('Milestones Module', () => {
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

  describe('POST /api/v1/fundraisers/:id/milestones', () => {
    it('should add milestone to fundraiser (as individual)', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const milestone = buildFakeMilestone();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject(formatMilestoneResponse(milestone));
    });

    it('should add milestone to fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const milestone = buildFakeMilestone();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject(formatMilestoneResponse(milestone));
    });

    it('should add milestone to fundraiser (as editor)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const { fundraiser } = await createFakeFundraiser(group!);
      const milestone = buildFakeMilestone();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject(formatMilestoneResponse(milestone));
    });

    it('should add milestone to fundraiser (as admin)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const { fundraiser } = await createFakeFundraiser(group!);
      const milestone = buildFakeMilestone();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject(formatMilestoneResponse(milestone));
    });

    it('should return 403 when adding a milestone to fundraiser (as group viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const { fundraiser } = await createFakeFundraiser(group!);
      const milestone = buildFakeMilestone();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone)
        .expect(403);
    });

    it('should return 400 when adding a milestone with invalid data', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const milestone = buildFakeMilestone();

      // Test 0 amount
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...milestone, amount: 0 })
        .expect(400);

      // Test empty title
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...milestone, title: '' })
        .expect(400);

      // Test empty purpose
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...milestone, purpose: '' })
        .expect(400);

      // Test title too long
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...milestone, title: 'a'.repeat(101) })
        .expect(400);

      // Test purpose too long
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...milestone, purpose: 'a'.repeat(501) })
        .expect(400);
    });

    it('should throw ForbiddenException when the user tries to add a milestone to a fundraiser they do not own', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const milestone = buildFakeMilestone();

      // Test 0 amount
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone)
        .expect(403);
    });

    it('should throw ForbiddenException when the user tries to add a milestone to a group fundraiser they are not a member of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const milestone = buildFakeMilestone();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone)
        .expect(403);
    });

    it('should throw ForbiddenException when the group member has insufficient role to add a milestone to a group fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const { fundraiser } = await createFakeFundraiser(group!);
      const milestone = buildFakeMilestone();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`)
        .send(milestone)
        .expect(403);
    });
  });
});
