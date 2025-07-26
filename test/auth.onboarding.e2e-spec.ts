import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createApiPath, createTestApp, resetDatabase } from './test-utils';
import { AccountType } from '../generated/prisma';
import * as request from 'supertest';
import { ClerkService } from '../src/features/auth/clerk.service';
import { faker } from '@faker-js/faker';
import {
  createFakeUserWithToken,
  createIndividualOnboardingData,
  createNonprofitOnboardingData,
  createTeamOnboardingData,
} from './factories/users.factory';
import { TeamMemberRole } from '../src/features/auth/dtos/onboarding.dto';

describe('Auth Module', () => {
  let app: INestApplication<App>;
  let clerkService: ClerkService;

  beforeAll(async () => {
    app = await createTestApp();
    clerkService = app.get(ClerkService);

    // Mock inviteUser method (so it doesn't actually send an email)
    jest
      .spyOn(clerkService, 'inviteUser')
      .mockImplementation(() => Promise.resolve({ id: faker.string.uuid() }));
  });

  afterAll(async () => {
    // Close test app after all tests
    await app.close();
  });

  beforeEach(async () => {
    // Reset database before each test
    await resetDatabase();
  });

  describe('POST /api/v1/auth/onboarding', () => {
    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .send({});

      expect(response.statusCode).toBe(401);
    });

    it('should return 409 if user has already completed onboarding', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: true,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createIndividualOnboardingData());

      expect(response.statusCode).toBe(409);
    });

    it('should successfully complete individual account onboarding', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createIndividualOnboardingData());

      expect(response.statusCode).toBe(201);
      expect(response.body.user.accountType).toBe(AccountType.individual);
      expect(response.body.user.setupComplete).toBe(true);
      // New: Assert group and groupMember are present and correct
      expect(response.body.group).toBeDefined();
      expect(response.body.group.type).toBe('individual');
      expect(response.body.group.ownerId).toBe(response.body.user.id);
      expect(response.body.groupMember).toBeDefined();
      expect(response.body.groupMember.userId).toBe(response.body.user.id);
      expect(response.body.groupMember.groupId).toBe(response.body.group.id);
      expect(response.body.groupMember.role).toBe('owner');
      expect(response.body.groupMember.status).toBe('active');
    });

    it('should successfully complete team account onboarding', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createTeamOnboardingData());

      expect(response.statusCode).toBe(201);
      expect(response.body.user.accountType).toBe(AccountType.team);
      expect(response.body.user.setupComplete).toBe(true);
      // New: Assert group and groupMember are present and correct
      expect(response.body.group).toBeDefined();
      expect(response.body.group.type).toBe('team');
      expect(response.body.group.ownerId).toBe(response.body.user.id);
      expect(response.body.groupMember).toBeDefined();
      expect(response.body.groupMember.userId).toBe(response.body.user.id);
      expect(response.body.groupMember.groupId).toBe(response.body.group.id);
      expect(response.body.groupMember.role).toBe('owner');
      expect(response.body.groupMember.status).toBe('active');
    });

    it('should successfully complete nonprofit account onboarding', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.nonprofit,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createNonprofitOnboardingData());

      expect(response.statusCode).toBe(201);
      expect(response.body.user.accountType).toBe(AccountType.nonprofit);
      expect(response.body.user.setupComplete).toBe(true);
      // New: Assert group and groupMember are present and correct
      expect(response.body.group).toBeDefined();
      expect(response.body.group.type).toBe('nonprofit');
      expect(response.body.group.ownerId).toBe(response.body.user.id);
      expect(response.body.groupMember).toBeDefined();
      expect(response.body.groupMember.userId).toBe(response.body.user.id);
      expect(response.body.groupMember.groupId).toBe(response.body.group.id);
      expect(response.body.groupMember.role).toBe('owner');
    });

    it('should return 400 Bad Request when accountType is missing', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('accountType'),
      );

      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when accountType is invalid', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send({ ...createIndividualOnboardingData(), accountType: 'invalid' });

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('accountType'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when team accountType is missing name', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createTeamOnboardingData({ name: undefined }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('name'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when team name is too short', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createTeamOnboardingData({ name: 'a' }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('name'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when team name is too long', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createTeamOnboardingData({ name: 'a'.repeat(101) }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('name'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when nonprofit accountType is missing name', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.nonprofit,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createNonprofitOnboardingData({ name: undefined }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('name'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when nonprofit accountType is missing ein', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.nonprofit,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createNonprofitOnboardingData({ ein: undefined }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('ein'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when nonprofit ein is too short', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.nonprofit,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createNonprofitOnboardingData({ ein: '12345678' }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('ein'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when nonprofit ein is too long', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.nonprofit,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createNonprofitOnboardingData({ ein: '12345678901' }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('ein'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when bio is too long', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createIndividualOnboardingData({ bio: 'a'.repeat(501) }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('bio'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when avatarUrl is not a valid URL', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createIndividualOnboardingData({ avatarUrl: 'not-a-url' }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('avatarUrl'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when website is not a valid URL', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createTeamOnboardingData({ website: 'not-a-url' }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('website'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when team members have invalid email', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(
          createTeamOnboardingData({
            members: [
              {
                name: 'Test Member',
                email: 'not-an-email',
                role: TeamMemberRole.viewer,
              },
            ],
          }),
        );

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('email'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when team member name is too short', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.team,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(
          createTeamOnboardingData({
            members: [
              {
                name: 'a',
                email: 'test@example.com',
                role: TeamMemberRole.viewer,
              },
            ],
          }),
        );

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('name'),
      );
      expect(hasError).toBe(true);
    });

    it('should return 400 Bad Request when documentsUrls contains invalid URL', async () => {
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.nonprofit,
        setupComplete: false,
      });

      const response = await request(app.getHttpServer())
        .post(createApiPath('auth/onboarding'))
        .set('Authorization', `Bearer ${token}`)
        .send(createNonprofitOnboardingData({ documentsUrls: ['not-a-url'] }));

      expect(response.statusCode).toBe(400);
      const hasError = (response.body as { message: string[] }).message.some(
        (msg) => msg.includes('documentsUrls'),
      );
      expect(hasError).toBe(true);
    });
  });
});
