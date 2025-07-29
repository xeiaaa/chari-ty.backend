import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import { AccountType, GroupMemberRole } from '../../generated/prisma';
import * as request from 'supertest';
import {
  createFakeUserWithToken,
  addUserToGroup,
} from '../factories/users.factory';
import { buildFakeUpload } from '../factories/uploads.factory';

describe('Groups Module - CRUD', () => {
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

  describe('POST /api/v1/groups/:groupId/uploads', () => {
    it('should create group uploads for group owner', async () => {
      const { token, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const uploadData = {
        items: [
          {
            asset: buildFakeUpload(),
            caption: 'Test upload 1',
            type: 'gallery',
          },
          {
            asset: buildFakeUpload(),
            caption: 'Test upload 2',
            type: 'verification',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveLength(2);
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

      const uploadData = {
        items: [
          {
            asset: {
              cloudinaryAssetId: 'test-asset-1',
              publicId: 'test/public-1',
              url: 'https://example.com/test1.jpg',
              eagerUrl: 'https://example.com/test1-eager.jpg',
              format: 'jpg',
              resourceType: 'image',
              size: 1024,
              originalFilename: 'test1.jpg',
              uploadedAt: new Date().toISOString(),
            },
            caption: 'Test upload',
            type: 'gallery',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/uploads`))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData)
        .expect(403);
    });

    it('should return 403 for viewer role', async () => {
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Create a viewer user
      const { user: viewer, token: viewerToken } =
        await createFakeUserWithToken({
          accountType: AccountType.individual,
          setupComplete: true,
        });

      await addUserToGroup(viewer, group!, GroupMemberRole.viewer);

      const uploadData = {
        items: [
          {
            asset: {
              cloudinaryAssetId: 'test-asset-1',
              publicId: 'test/public-1',
              url: 'https://example.com/test1.jpg',
              eagerUrl: 'https://example.com/test1-eager.jpg',
              format: 'jpg',
              resourceType: 'image',
              size: 1024,
              originalFilename: 'test1.jpg',
              uploadedAt: new Date().toISOString(),
            },
            caption: 'Test upload',
            type: 'gallery',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/uploads`))
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(uploadData)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const uploadData = {
        items: [
          {
            asset: {
              cloudinaryAssetId: 'test-asset-1',
              publicId: 'test/public-1',
              url: 'https://example.com/test1.jpg',
              eagerUrl: 'https://example.com/test1-eager.jpg',
              format: 'jpg',
              resourceType: 'image',
              size: 1024,
              originalFilename: 'test1.jpg',
              uploadedAt: new Date().toISOString(),
            },
            caption: 'Test upload',
            type: 'gallery',
          },
        ],
      };

      await request(app.getHttpServer())
        .post(createApiPath('groups/non-existent-group-id/uploads'))
        .set('Authorization', `Bearer ${token}`)
        .send(uploadData)
        .expect(404);
    });
  });
});
