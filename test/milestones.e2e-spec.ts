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
import {
  buildFakeMilestone,
  createFakeMilestone,
} from './factories/milestones.factory';

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

  describe('GET /api/v1/fundraisers/:id/milestones', () => {
    it('should return all milestones for a fundraiser', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all milestones for a fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all milestones for a fundraiser (as group admin)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      // Create a group member with admin role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all milestones for a fundraiser (as group editor)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      // Create a group member with editor role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all milestones for a fundraiser (as group viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      // Create a group member with viewer role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return 403 when the user tries to list milestones for a fundraiser they do not own', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);
      console.log(response.body);
      expect(response.statusCode).toBe(403);
    });

    it('should return 403 when the user tries to list milestones for a group fundraiser they are not a member of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeMilestone(fundraiser, {
        stepNumber: 1,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 2,
      });
      await createFakeMilestone(fundraiser, {
        stepNumber: 3,
      });

      // Create a group member with viewer role
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/milestones`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/fundraisers/:id/milestones/:milestoneId', () => {
    it('should update milestone for a fundraiser (as individual)', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const { milestone } = await createFakeMilestone(fundraiser);
      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        ...formatMilestoneResponse(updateData),
        id: milestone.id,
      });
    });

    it('should update milestone for a fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);
      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        ...formatMilestoneResponse(updateData),
        id: milestone.id,
      });
    });

    it('should update milestone for a fundraiser (as group admin)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // Create a group member with admin role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        ...formatMilestoneResponse(updateData),
        id: milestone.id,
      });
    });

    it('should update milestone for a fundraiser (as group editor)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // Create a group member with editor role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        ...formatMilestoneResponse(updateData),
        id: milestone.id,
      });
    });

    it('should return 403 when updating milestone for a fundraiser (as group viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // Create a group member with viewer role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 when the user tries to update a milestone for a fundraiser they do not own', async () => {
      const { user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const { milestone } = await createFakeMilestone(fundraiser);

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 when the user tries to update a milestone for a group fundraiser they are not a member of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 when updating a milestone with invalid data', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const { milestone } = await createFakeMilestone(fundraiser);

      // Test 0 amount
      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 0 })
        .expect(400);

      // Test empty title
      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' })
        .expect(400);

      // Test empty purpose
      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ purpose: '' })
        .expect(400);

      // Test title too long
      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'a'.repeat(101) })
        .expect(400);

      // Test purpose too long
      await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ purpose: 'a'.repeat(501) })
        .expect(400);
    });

    it('should return 400 when trying to update an achieved milestone', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(user);
      const { milestone } = await createFakeMilestone(fundraiser, {
        achieved: true,
        achievedAt: new Date(),
      });

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Cannot update an achieved milestone');
    });

    it('should return 400 when milestone does not belong to the specified fundraiser', async () => {
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create two fundraisers
      const { fundraiser: fundraiser1 } = await createFakeFundraiser(user);
      const { fundraiser: fundraiser2 } = await createFakeFundraiser(user);

      // Create milestone for fundraiser1
      const { milestone } = await createFakeMilestone(fundraiser1);

      const updateData = {
        title: 'Updated Title',
        purpose: 'Updated Purpose',
        amount: 2000,
      };

      // Try to update using fundraiser2's ID
      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(
            `fundraisers/${fundraiser2.id}/milestones/${milestone.id}`,
          ),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe(
        'Milestone does not belong to this fundraiser',
      );
    });
  });
});
