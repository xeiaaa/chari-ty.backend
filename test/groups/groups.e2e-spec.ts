import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import {
  AccountType,
  GroupMemberRole,
  GroupMemberStatus,
} from '../../generated/prisma';
import * as request from 'supertest';
import {
  createFakeUserWithToken,
  addUserToGroup,
} from '../factories/users.factory';
import { UploadsService } from '../../src/features/uploads/uploads.service';

describe('Groups Module - CRUD', () => {
  let app: INestApplication<App>;
  let uploadsService: UploadsService;

  beforeAll(async () => {
    app = await createTestApp();
    uploadsService = app.get(UploadsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();

    // Mock UploadsService methods
    jest.spyOn(uploadsService, 'getResourceByPublicId').mockResolvedValue({
      asset_id: 'test-asset-id',
      public_id: 'test-public-id',
      secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
      derived: [
        {
          transformation: 'q_auto,f_auto',
          transformation_signature: 'test-signature',
          format: 'jpg',
          bytes: 1024,
          id: 'test-derived-id',
          url: 'https://res.cloudinary.com/test/image/upload/q_auto,f_auto/test.jpg',
          secure_url:
            'https://res.cloudinary.com/test/image/upload/q_auto,f_auto/test.jpg',
        },
      ],
      format: 'jpg',
      resource_type: 'image',
      version: 1,
      type: 'upload',
      created_at: '2025-01-01T00:00:00Z',
      bytes: 1024,
      width: 800,
      height: 600,
      asset_folder: 'test-folder',
      display_name: 'test-image.jpg',
      url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
      next_cursor: undefined,
      rate_limit_allowed: 1000,
      rate_limit_reset_at: '2025-01-01T00:00:00Z',
      rate_limit_remaining: 999,
    });

    jest.spyOn(uploadsService, 'deleteCloudinaryResource').mockResolvedValue({
      result: 'ok',
    });
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

    it('should remove avatar when removeAvatar is true', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // First, create a group with an avatar
      const createGroupData = {
        name: 'Group with Avatar',
        description: 'A group with an avatar',
        type: 'team',
        avatarPublicId: 'test-public-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(createGroupData);

      expect(createResponse.statusCode).toBe(201);
      const groupWithAvatar = createResponse.body.group;
      expect(groupWithAvatar.avatarUploadId).toBeTruthy();

      // Now remove the avatar
      const updateData = {
        removeAvatar: true,
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${groupWithAvatar.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: groupWithAvatar.id,
        name: groupWithAvatar.name,
        slug: groupWithAvatar.slug,
        avatarUploadId: null,
      });
    });

    it('should update other fields while removing avatar', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // First, create a group with an avatar
      const createGroupData = {
        name: 'Group with Avatar',
        description: 'A group with an avatar',
        type: 'team',
        avatarPublicId: 'test-public-id',
      };

      const createResponse = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(createGroupData);

      expect(createResponse.statusCode).toBe(201);
      const groupWithAvatar = createResponse.body.group;

      // Update multiple fields including removing avatar
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        removeAvatar: true,
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`groups/slug/${groupWithAvatar.slug}`))
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: groupWithAvatar.id,
        name: 'Updated Group Name',
        description: 'Updated description',
        slug: groupWithAvatar.slug,
        avatarUploadId: null,
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

  describe('POST /api/v1/groups', () => {
    it('should create a group successfully with basic data', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Test Group',
        description: 'A test group for testing',
        type: 'team',
        website: 'https://testgroup.com',
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        group: {
          name: groupData.name,
          description: groupData.description,
          type: groupData.type,
          website: groupData.website,
          verified: false,
          slug: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        groupMember: {
          role: 'owner',
          status: 'active',
        },
      });
    });

    it('should create a nonprofit group with EIN', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Nonprofit Test Group',
        description: 'A nonprofit test group',
        type: 'nonprofit',
        ein: '123456789',
        website: 'https://nonprofit-test.com',
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData);

      expect(response.statusCode).toBe(201);
      expect(response.body.group).toMatchObject({
        name: groupData.name,
        description: groupData.description,
        type: groupData.type,
        ein: groupData.ein,
        website: groupData.website,
        verified: false,
      });
    });

    it('should create a group with avatar using avatarPublicId', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Group with Avatar',
        description: 'A group with an avatar',
        type: 'team',
        avatarPublicId: 'test-public-id',
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData);

      expect(response.statusCode).toBe(201);
      expect(response.body.group).toMatchObject({
        name: groupData.name,
        description: groupData.description,
        type: groupData.type,
        avatarUploadId: expect.any(String),
      });
    });

    it('should return 400 if user has not completed setup', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const groupData = {
        name: 'Test Group',
        type: 'team',
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData)
        .expect(400);
    });

    it('should return 400 if nonprofit group is missing EIN', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Nonprofit Group',
        type: 'nonprofit',
        description: 'A nonprofit group without EIN',
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData)
        .expect(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const groupData = {
        name: 'Test Group',
        type: 'team',
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .send(groupData)
        .expect(401);
    });

    it('should return 400 for invalid group type', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Test Group',
        type: 'invalid-type',
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData)
        .expect(400);
    });

    it('should return 400 for invalid website URL', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Test Group',
        type: 'team',
        website: 'invalid-url',
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData)
        .expect(400);
    });

    it('should return 400 for invalid documents URLs', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Test Group',
        type: 'team',
        documentsUrls: ['invalid-url', 'https://valid-url.com'],
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData)
        .expect(400);
    });

    it('should generate unique slug for groups with same name', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const groupData = {
        name: 'Same Name Group',
        type: 'team',
      };

      // Create first group
      const response1 = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData);

      expect(response1.statusCode).toBe(201);
      const slug1 = response1.body.group.slug;

      // Create second group with same name
      const response2 = await request(app.getHttpServer())
        .post(createApiPath('groups'))
        .set('Authorization', `Bearer ${token}`)
        .send(groupData);

      expect(response2.statusCode).toBe(201);
      const slug2 = response2.body.group.slug;

      // Slugs should be different
      expect(slug1).not.toBe(slug2);
      expect(slug1).toContain('same-name-group');
      expect(slug2).toContain('same-name-group');
    });
  });

  describe('POST /api/v1/groups/:groupId/verification-request', () => {
    it('should create verification request for group member', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const verificationRequestData = {
        reason: 'We are a legitimate nonprofit organization',
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${token}`)
        .send(verificationRequestData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        groupId: group!.id,
        status: 'pending',
        reason: verificationRequestData.reason,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        group: {
          id: group!.id,
          name: group!.name,
          slug: group!.slug,
        },
        submitter: {
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
        },
      });
      expect(response.body.reviewedBy).toBeNull();
      expect(response.body.reviewedAt).toBeNull();
    });

    it('should create verification request without reason', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.statusCode).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        groupId: group!.id,
        status: 'pending',
        reason: null,
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
        accountType: AccountType.team,
        setupComplete: true,
      });

      const verificationRequestData = {
        reason: 'We are a legitimate nonprofit organization',
      };

      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${token}`)
        .send(verificationRequestData)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const verificationRequestData = {
        reason: 'We are a legitimate nonprofit organization',
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups/non-existent-id/verification-request'))
        .set('Authorization', `Bearer ${token}`)
        .send(verificationRequestData)
        .expect(404);
    });

    it('should return 409 for duplicate verification request', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const verificationRequestData = {
        reason: 'We are a legitimate nonprofit organization',
      };

      // Create first verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${token}`)
        .send(verificationRequestData)
        .expect(201);

      // Try to create second verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${token}`)
        .send(verificationRequestData)
        .expect(409);
    });

    it('should return 400 for invalid reason length', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const verificationRequestData = {
        reason: 'a'.repeat(1001), // Exceeds 1000 character limit
      };

      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${token}`)
        .send(verificationRequestData)
        .expect(400);
    });
  });
});
