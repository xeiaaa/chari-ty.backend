import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from '../test-utils';
import { AccountType, VerificationStatus } from '../../generated/prisma';
import * as request from 'supertest';
import { createFakeUserWithToken } from '../factories/users.factory';
import { UploadsService } from '../../src/features/uploads/uploads.service';

describe('Admin Groups Module - Verification Requests', () => {
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

  describe('PATCH /api/v1/admin/group/:groupId/verification-request', () => {
    it('should approve verification request and update group verified status', async () => {
      // Create admin user
      const { token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: true,
      });

      // Create regular user and group with verification request
      const { token: userToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Submit verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'We are a legitimate nonprofit organization',
        })
        .expect(201);

      // Approve the verification request
      const updateData = {
        status: VerificationStatus.approved,
        reason: 'Approved after review of documentation',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`admin/group/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        groupId: group!.id,
        status: 'approved',
        reason: updateData.reason,
        reviewedAt: expect.any(String),
        group: {
          id: group!.id,
          name: group!.name,
          slug: group!.slug,
          verified: true,
        },
        submitter: {
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
        },
        reviewer: {
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
        },
      });
    });

    it('should reject verification request without updating group verified status', async () => {
      // Create admin user
      const { token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: true,
      });

      // Create regular user and group with verification request
      const { token: userToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Submit verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'We are a legitimate nonprofit organization',
        })
        .expect(201);

      // Reject the verification request
      const updateData = {
        status: VerificationStatus.rejected,
        reason: 'Insufficient documentation provided',
      };

      const response = await request(app.getHttpServer())
        .patch(createApiPath(`admin/group/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.statusCode).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        groupId: group!.id,
        status: 'rejected',
        reason: updateData.reason,
        reviewedAt: expect.any(String),
        group: {
          id: group!.id,
          name: group!.name,
          slug: group!.slug,
          verified: false,
        },
        submitter: {
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
        },
        reviewer: {
          id: expect.any(String),
          firstName: expect.any(String),
          lastName: expect.any(String),
          email: expect.any(String),
        },
      });
    });

    it('should return 403 for non-admin user', async () => {
      // Create regular user (non-admin)
      const { token: regularToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: false,
      });

      // Create another user and group with verification request
      const { token: userToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Submit verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'We are a legitimate nonprofit organization',
        })
        .expect(201);

      // Try to update verification request as non-admin
      const updateData = {
        status: VerificationStatus.approved,
        reason: 'Approved after review',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`admin/group/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${regularToken}`)
        .send(updateData)
        .expect(403);
    });

    it('should return 404 for non-existent group', async () => {
      // Create admin user
      const { token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: true,
      });

      const updateData = {
        status: VerificationStatus.approved,
        reason: 'Approved after review',
      };

      await request(app.getHttpServer())
        .patch(
          createApiPath('admin/group/non-existent-id/verification-request'),
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should return 404 for group without verification request', async () => {
      // Create admin user
      const { token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: true,
      });

      // Create group without verification request
      const { group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      const updateData = {
        status: VerificationStatus.approved,
        reason: 'Approved after review',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`admin/group/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });

    it('should return 400 for invalid status', async () => {
      // Create admin user
      const { token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: true,
      });

      // Create regular user and group with verification request
      const { token: userToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Submit verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'We are a legitimate nonprofit organization',
        })
        .expect(201);

      // Try to update with invalid status
      const updateData = {
        status: 'invalid-status',
        reason: 'Approved after review',
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`admin/group/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);
    });

    it('should return 400 for invalid reason length', async () => {
      // Create admin user
      const { token: adminToken } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
        isAdmin: true,
      });

      // Create regular user and group with verification request
      const { token: userToken, group } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: true,
      });

      // Submit verification request
      await request(app.getHttpServer())
        .post(createApiPath(`groups/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'We are a legitimate nonprofit organization',
        })
        .expect(201);

      // Try to update with invalid reason length
      const updateData = {
        status: VerificationStatus.approved,
        reason: 'a'.repeat(1001), // Exceeds 1000 character limit
      };

      await request(app.getHttpServer())
        .patch(createApiPath(`admin/group/${group!.id}/verification-request`))
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);
    });
  });
});
