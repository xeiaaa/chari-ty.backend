import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import { AccountType, GroupMemberRole } from '../../generated/prisma';
import * as request from 'supertest';
import {
  addUserToGroup,
  createFakeUserWithToken,
} from '../factories/users.factory';
import { createFakeFundraiser } from '../factories/fundraisers.factory';
import { buildFakeLink, createFakeLink } from '../factories/links.factory';

describe('Links Module', () => {
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

  describe('POST /api/v1/fundraisers/:id/links', () => {
    it('should add link to fundraiser (as individual)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const link = buildFakeLink();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        alias: link.alias,
        note: link.note,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should add link to fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const link = buildFakeLink();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        alias: link.alias,
        note: link.note,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should add link to fundraiser (as editor)', async () => {
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
      const link = buildFakeLink();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        alias: link.alias,
        note: link.note,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should add link to fundraiser (as admin)', async () => {
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
      const link = buildFakeLink();

      const response = await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        alias: link.alias,
        note: link.note,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 403 when adding a link to fundraiser (as group viewer)', async () => {
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
      const link = buildFakeLink();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link)
        .expect(403);
    });

    it('should return 400 when adding a link with invalid data', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const link = buildFakeLink();

      // Test empty alias
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...link, alias: '' })
        .expect(400);

      // Test alias too long
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...link, alias: 'a'.repeat(51) })
        .expect(400);

      // Test note too long
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...link, note: 'a'.repeat(501) })
        .expect(400);
    });

    it('should return 409 when adding a link with duplicate alias', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const link = buildFakeLink();

      // Create first link
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link)
        .expect(201);

      // Try to create second link with same alias
      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link)
        .expect(409);
    });

    it('should throw ForbiddenException when the user tries to add a link to a fundraiser they do not own', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const link = buildFakeLink();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link)
        .expect(403);
    });

    it('should throw ForbiddenException when the user tries to add a link to a group fundraiser they are not a member of', async () => {
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
      const link = buildFakeLink();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link)
        .expect(403);
    });

    it('should throw ForbiddenException when the group member has insufficient role to add a link to a group fundraiser', async () => {
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
      const link = buildFakeLink();

      await request(app.getHttpServer())
        .post(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`)
        .send(link)
        .expect(403);
    });
  });

  describe('GET /api/v1/fundraisers/:id/links', () => {
    it('should return all links for a fundraiser', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });
      await createFakeLink(fundraiser, { alias: 'twitter' });
      await createFakeLink(fundraiser, { alias: 'instagram' });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all links for a fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });
      await createFakeLink(fundraiser, { alias: 'twitter' });
      await createFakeLink(fundraiser, { alias: 'instagram' });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all links for a fundraiser (as group admin)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });
      await createFakeLink(fundraiser, { alias: 'twitter' });
      await createFakeLink(fundraiser, { alias: 'instagram' });

      // Create a group member with admin role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all links for a fundraiser (as group editor)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });
      await createFakeLink(fundraiser, { alias: 'twitter' });
      await createFakeLink(fundraiser, { alias: 'instagram' });

      // Create a group member with editor role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return all links for a fundraiser (as group viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });
      await createFakeLink(fundraiser, { alias: 'twitter' });
      await createFakeLink(fundraiser, { alias: 'instagram' });

      // Create a group member with viewer role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    it('should return filtered links when search query is provided', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, {
        alias: 'facebook',
        note: 'Social media campaign',
      });
      await createFakeLink(fundraiser, {
        alias: 'twitter',
        note: 'Twitter promotion',
      });
      await createFakeLink(fundraiser, {
        alias: 'newsletter',
        note: 'Email campaign',
      });

      const response = await request(app.getHttpServer())
        .get(
          createApiPath(`fundraisers/${fundraiser.id}/links?search=facebook`),
        )
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].alias).toBe('facebook');
    });

    it('should return 403 when the user tries to list links for a fundraiser they do not own', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(403);
    });

    it('should return 403 when the user tries to list links for a group fundraiser they are not a member of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, { alias: 'facebook' });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/fundraisers/:id/links/:linkId', () => {
    it('should return a specific link', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser, { alias: 'facebook' });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: link.id,
        alias: 'facebook',
        note: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 404 when link does not exist', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .get(
          createApiPath(`fundraisers/${fundraiser.id}/links/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 when user does not have access to fundraiser', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser, { alias: 'facebook' });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/fundraisers/:id/links/:linkId', () => {
    it('should update link for a fundraiser (as individual)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);
      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: link.id,
        alias: 'updated-alias',
        note: 'Updated note',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should update link for a fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);
      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: link.id,
        alias: 'updated-alias',
        note: 'Updated note',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should update link for a fundraiser (as group admin)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a group member with admin role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: link.id,
        alias: 'updated-alias',
        note: 'Updated note',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should update link for a fundraiser (as group editor)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a group member with editor role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: link.id,
        alias: 'updated-alias',
        note: 'Updated note',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 403 when updating link for a fundraiser (as group viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a group member with viewer role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 when the user tries to update a link for a fundraiser they do not own', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 when the user tries to update a link for a group fundraiser they are not a member of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        alias: 'updated-alias',
        note: 'Updated note',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 when updating a link with invalid data', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Test empty alias
      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: '' })
        .expect(400);

      // Test alias too long
      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: 'a'.repeat(51) })
        .expect(400);

      // Test note too long
      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ note: 'a'.repeat(501) })
        .expect(400);
    });

    it('should return 409 when updating a link with duplicate alias', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      await createFakeLink(fundraiser, {
        alias: 'existing-alias',
      });
      const { link: link2 } = await createFakeLink(fundraiser, {
        alias: 'different-alias',
      });

      // Try to update link2 with link1's alias
      await request(app.getHttpServer())
        .patch(createApiPath(`fundraisers/${fundraiser.id}/links/${link2.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: 'existing-alias' })
        .expect(409);
    });

    it('should return 404 when link does not exist', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .patch(
          createApiPath(`fundraisers/${fundraiser.id}/links/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ alias: 'new-alias' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/fundraisers/:id/links/:linkId', () => {
    it('should delete link from fundraiser (as individual)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify link was deleted
      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(0);
    });

    it('should delete link from fundraiser (as group owner)', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify link was deleted
      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(0);
    });

    it('should delete link from fundraiser (as group admin)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a group member with admin role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.admin);

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify link was deleted
      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(0);
    });

    it('should delete link from fundraiser (as group editor)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a group member with editor role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.editor);

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify link was deleted
      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(0);
    });

    it('should return 403 when deleting link from fundraiser (as group viewer)', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a group member with viewer role
      const { token, user } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });
      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // Verify link was not deleted
      const response = await request(app.getHttpServer())
        .get(createApiPath(`fundraisers/${fundraiser.id}/links`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveLength(1);
    });

    it('should return 403 when the user tries to delete a link from a fundraiser they do not own', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 403 when the user tries to delete a link from a group fundraiser they are not a member of', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { link } = await createFakeLink(fundraiser);

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(createApiPath(`fundraisers/${fundraiser.id}/links/${link.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 404 when link does not exist', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);

      await request(app.getHttpServer())
        .delete(
          createApiPath(`fundraisers/${fundraiser.id}/links/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
