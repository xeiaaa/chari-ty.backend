import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import {
  AccountType,
  GroupMemberRole,
  GroupMemberStatus,
} from '../generated/prisma';
import * as request from 'supertest';
import {
  createFakeUserWithToken,
  addUserToGroup,
} from './factories/users.factory';

describe('Groups Module', () => {
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

  describe('GET /api/v1/groups/slug/:slug', () => {
    it('should return group by slug for authenticated member', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .get(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: group!.id,
        name: group!.name,
        slug: group!.slug,
        stripeId: group!.stripeId,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 403 for non-member user', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath('groups/slug/non-existent-slug'))
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .get(createApiPath(`groups/slug/${group!.slug}`))
        .expect(401);
    });
  });

  describe('PATCH /api/v1/groups/slug/:slug', () => {
    it('should update group by slug for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        website: 'https://updated-website.com',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: group!.id,
        name: updateData.name,
        description: updateData.description,
        website: updateData.website,
        slug: group!.slug,
      });
    });

    it('should return 403 for non-member user', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath('groups/slug/non-existent-slug'))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .send(updateData)
        .expect(401);
    });

    it('should return 403 for group member with editor role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user and add them as editor
      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.editor);

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 403 for group member with viewer role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user and add them as viewer
      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.viewer);

      const updateData = {
        name: 'Updated Group Name',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });

    it('should allow group member with admin role to update group', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a different user and add them as admin
      const { user, token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(user, group!, GroupMemberRole.admin);

      const updateData = {
        name: 'Updated Group Name by Admin',
        description: 'Updated by admin user',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${group!.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: group!.id,
        name: updateData.name,
        description: updateData.description,
        slug: group!.slug,
      });
    });
  });

  describe('PATCH /api/v1/groups/:groupId/members/:memberId', () => {
    it('should allow owner to update member role from editor to admin', async () => {
      const { token: ownerToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a member with editor role
      const { user: member } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const memberRecord = await addUserToGroup(
        member,
        group!,
        GroupMemberRole.editor,
      );

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/${group!.id}/members/${memberRecord.id}`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: GroupMemberRole.admin });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: memberRecord.id,
        userId: member.id,
        groupId: group!.id,
        role: GroupMemberRole.admin,
        status: GroupMemberStatus.active,
      });
    });

    it('should allow admin to update member role from viewer to editor', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an admin user
      const { user: admin, token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(admin, group!, GroupMemberRole.admin);

      // Create a member with viewer role
      const { user: member } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const memberRecord = await addUserToGroup(
        member,
        group!,
        GroupMemberRole.viewer,
      );

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/${group!.id}/members/${memberRecord.id}`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: GroupMemberRole.editor });

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: memberRecord.id,
        userId: member.id,
        groupId: group!.id,
        role: GroupMemberRole.editor,
        status: GroupMemberStatus.active,
      });
    });

    it('should prevent admin from updating another admin role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an admin user
      const { user: admin, token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(admin, group!, GroupMemberRole.admin);

      // Create another admin
      const { user: anotherAdmin } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const anotherAdminRecord = await addUserToGroup(
        anotherAdmin,
        group!,
        GroupMemberRole.admin,
      );

      await request(app.getHttpServer())
        .patch(
          createApiPath(`groups/${group!.id}/members/${anotherAdminRecord.id}`),
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: GroupMemberRole.viewer })
        .expect(403);
    });

    it('should prevent editor from updating member roles', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an editor user
      const { user: editor, token: editorToken } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
          setupComplete: true,
        });

      await addUserToGroup(editor, group!, GroupMemberRole.editor);

      // Create a viewer
      const { user: viewer } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const viewerRecord = await addUserToGroup(
        viewer,
        group!,
        GroupMemberRole.viewer,
      );

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/${group!.id}/members/${viewerRecord.id}`))
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ role: GroupMemberRole.editor })
        .expect(403);
    });

    it('should prevent user from updating their own role', async () => {
      const {
        token: ownerToken,
        group,
        groupMember,
      } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .patch(createApiPath(`groups/${group!.id}/members/${groupMember!.id}`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: GroupMemberRole.admin })
        .expect(400);
    });

    it('should return 404 for non-existent member', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .patch(
          createApiPath(`groups/${group!.id}/members/non-existent-member-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .send({ role: GroupMemberRole.admin })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/groups/:groupId/members/:memberId', () => {
    it('should allow owner to remove admin member', async () => {
      const { token: ownerToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an admin member
      const { user: admin } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const adminRecord = await addUserToGroup(
        admin,
        group!,
        GroupMemberRole.admin,
      );

      const response = await request(app.getHttpServer())
        .delete(createApiPath(`groups/${group!.id}/members/${adminRecord.id}`))
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toContain('Successfully removed');
    });

    it('should allow admin to remove editor member', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an admin user
      const { user: admin, token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(admin, group!, GroupMemberRole.admin);

      // Create an editor member
      const { user: editor } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const editorRecord = await addUserToGroup(
        editor,
        group!,
        GroupMemberRole.editor,
      );

      const response = await request(app.getHttpServer())
        .delete(createApiPath(`groups/${group!.id}/members/${editorRecord.id}`))
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toContain('Successfully removed');
    });

    it('should prevent admin from removing another admin', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an admin user
      const { user: admin, token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      await addUserToGroup(admin, group!, GroupMemberRole.admin);

      // Create another admin
      const { user: anotherAdmin } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const anotherAdminRecord = await addUserToGroup(
        anotherAdmin,
        group!,
        GroupMemberRole.admin,
      );

      await request(app.getHttpServer())
        .delete(
          createApiPath(`groups/${group!.id}/members/${anotherAdminRecord.id}`),
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should prevent editor from removing members', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create an editor user
      const { user: editor, token: editorToken } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
          setupComplete: true,
        });

      await addUserToGroup(editor, group!, GroupMemberRole.editor);

      // Create a viewer
      const { user: viewer } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const viewerRecord = await addUserToGroup(
        viewer,
        group!,
        GroupMemberRole.viewer,
      );

      await request(app.getHttpServer())
        .delete(createApiPath(`groups/${group!.id}/members/${viewerRecord.id}`))
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403);
    });

    it('should prevent user from removing themselves', async () => {
      const {
        token: ownerToken,
        group,
        groupMember,
      } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(createApiPath(`groups/${group!.id}/members/${groupMember!.id}`))
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent member', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      await request(app.getHttpServer())
        .delete(
          createApiPath(`groups/${group!.id}/members/non-existent-member-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
