import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import { AccountType, GroupMemberRole } from '../../generated/prisma';
import * as request from 'supertest';
import {
  createFakeUserWithToken,
  addUserToGroup,
} from '../factories/users.factory';
import { createFakeFundraiser } from '../factories/fundraisers.factory';
import { createFakeMilestone } from '../factories/milestones.factory';
import { UploadsService } from '../../src/features/uploads/uploads.service';
import { faker } from '@faker-js/faker/.';

describe('Milestones Module - Uploads', () => {
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
    jest
      .spyOn(uploadsService, 'getResourceByPublicId')
      // eslint-disable-next-line @typescript-eslint/require-await
      .mockImplementation(async () => {
        return {
          asset_id: faker.string.uuid(),
          public_id: faker.string.uuid(),
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
        };
      });

    jest.spyOn(uploadsService, 'deleteCloudinaryResource').mockResolvedValue({
      result: 'ok',
    });
  });

  describe('POST /api/v1/milestones/:milestoneId/uploads', () => {
    it('should add milestone uploads for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      const uploadData = {
        items: [
          {
            publicId: 'test-public-id-1',
            caption: 'Test image 1',
          },
          {
            publicId: 'test-public-id-2',
            caption: 'Test image 2',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        milestoneId: milestone.id,
        caption: 'Test image 1',
        order: 0,
        uploadId: expect.any(String),
      });
      expect(response.body[1]).toMatchObject({
        milestoneId: milestone.id,
        caption: 'Test image 2',
        order: 1,
        uploadId: expect.any(String),
      });
    });

    it('should add milestone uploads for group admin', async () => {
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
      const { milestone } = await createFakeMilestone(fundraiser);

      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Test image by admin',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      expect(response.statusCode).toBe(201);
      expect(response.body[0]).toMatchObject({
        milestoneId: milestone.id,
        caption: 'Test image by admin',
      });
    });

    it('should add milestone uploads for group editor', async () => {
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
      const { milestone } = await createFakeMilestone(fundraiser);

      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Test image by editor',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      expect(response.statusCode).toBe(201);
    });

    it('should return 403 for group viewer', async () => {
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
      const { milestone } = await createFakeMilestone(fundraiser);

      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Test image',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData)
        .expect(403);
    });

    it('should return 403 for non-member user', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Test image',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData)
        .expect(403);
    });

    it('should return 404 for non-existent milestone', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Test image',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(createApiPath('milestones/non-existent-milestone-id/uploads'))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/milestones/:milestoneId/uploads/:uploadItemId', () => {
    it('should update milestone upload caption for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // First add an upload
      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Original caption',
          },
        ],
      };

      const addResponse = await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      const uploadItemId = addResponse.body[0].id;

      // Update the caption
      const updateData = {
        caption: 'Updated caption',
      };

      const response = await request(app.getHttpServer())
        .patch(
          createApiPath(`milestones/${milestone.id}/uploads/${uploadItemId}`),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: uploadItemId,
        milestoneId: milestone.id,
        caption: 'Updated caption',
      });
    });

    it('should return 404 for non-existent upload item', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      const updateData = {
        caption: 'Updated caption',
      };

      await request(app.getHttpServer())
        .patch(
          createApiPath(`milestones/${milestone.id}/uploads/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(404);
    });

    it('should return 403 for group viewer', async () => {
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
      const { milestone } = await createFakeMilestone(fundraiser);

      const updateData = {
        caption: 'Updated caption',
      };

      await request(app.getHttpServer())
        .patch(
          createApiPath(`milestones/${milestone.id}/uploads/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/v1/milestones/:milestoneId/uploads/:uploadItemId', () => {
    it('should delete milestone upload for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // First add an upload
      const uploadData = {
        items: [
          {
            publicId: 'test-public-id',
            caption: 'Test image to delete',
          },
        ],
      };

      const addResponse = await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      const uploadItemId = addResponse.body[0].id;

      // Delete the upload
      const response = await request(app.getHttpServer())
        .delete(
          createApiPath(`milestones/${milestone.id}/uploads/${uploadItemId}`),
        )
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent upload item', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      await request(app.getHttpServer())
        .delete(
          createApiPath(`milestones/${milestone.id}/uploads/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 403 for group viewer', async () => {
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
      const { milestone } = await createFakeMilestone(fundraiser);

      await request(app.getHttpServer())
        .delete(
          createApiPath(`milestones/${milestone.id}/uploads/non-existent-id`),
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/milestones/:milestoneId/uploads/reorder', () => {
    it('should reorder milestone uploads for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      // First add multiple uploads
      const uploadData = {
        items: [
          {
            publicId: 'test-public-id-1',
            caption: 'First image',
          },
          {
            publicId: 'test-public-id-2',
            caption: 'Second image',
          },
          {
            publicId: 'test-public-id-3',
            caption: 'Third image',
          },
        ],
      };

      const addResponse = await request(app.getHttpServer())
        .post(createApiPath(`milestones/${milestone.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      const uploadItems = addResponse.body;

      // Reorder the uploads (reverse the order)
      const reorderData = {
        orderMap: [
          {
            milestoneUploadId: uploadItems[2].id,
            order: 0,
          },
          {
            milestoneUploadId: uploadItems[1].id,
            order: 1,
          },
          {
            milestoneUploadId: uploadItems[0].id,
            order: 2,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`milestones/${milestone.id}/uploads/reorder`))
        .set('Authorization', `Bearer ${token}`)
        .send(reorderData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveLength(3);

      // Check that the order was updated correctly
      const reorderedItems = response.body;
      expect(reorderedItems[0].order).toBe(0);
      expect(reorderedItems[1].order).toBe(1);
      expect(reorderedItems[2].order).toBe(2);
    });

    it('should return 404 for non-existent upload items', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const { fundraiser } = await createFakeFundraiser(group!);
      const { milestone } = await createFakeMilestone(fundraiser);

      const reorderData = {
        orderMap: [
          {
            milestoneUploadId: 'non-existent-id',
            order: 0,
          },
        ],
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`milestones/${milestone.id}/uploads/reorder`))
        .set('Authorization', `Bearer ${token}`)
        .send(reorderData)
        .expect(404);
    });

    it('should return 403 for group viewer', async () => {
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
      const { milestone } = await createFakeMilestone(fundraiser);

      const reorderData = {
        orderMap: [
          {
            milestoneUploadId: 'test-id',
            order: 0,
          },
        ],
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`milestones/${milestone.id}/uploads/reorder`))
        .set('Authorization', `Bearer ${token}`)
        .send(reorderData)
        .expect(403);
    });
  });
});
