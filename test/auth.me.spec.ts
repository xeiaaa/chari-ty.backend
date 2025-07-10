import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createApiPath,
  createAuthHeaders,
  createDevelopmentToken,
  mockUser1,
  mockUser2,
  seedTestDatabase,
  mockAuth,
} from './test-utils';
import { UsersService } from '../src/features/users/users.service';
import { ClerkService } from '../src/features/auth/clerk.service';

describe('AuthController Me (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let clerkService: ClerkService;

  beforeEach(async () => {
    await seedTestDatabase();
    app = await createTestApp();
    usersService = app.get(UsersService);
    clerkService = app.get(ClerkService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('GET /auth/me', () => {
    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      await request(app.getHttpServer())
        .get(createApiPath('/auth/me'))
        .expect(401);
    });

    it('should return the authenticated user profile when a valid token is provided', async () => {
      // Create tokens for both users
      const user1Token = createDevelopmentToken(
        mockUser1.clerkId,
        mockUser1.email,
      );
      const user2Token = createDevelopmentToken(
        mockUser2.clerkId,
        mockUser2.email,
      );

      // Mock auth for both users
      mockAuth(
        clerkService,
        usersService,
        mockUser1.clerkId,
        mockUser1.email,
        mockUser1,
      );
      mockAuth(
        clerkService,
        usersService,
        mockUser2.clerkId,
        mockUser2.email,
        mockUser2,
      );

      // Test first user
      const response1 = await request(app.getHttpServer())
        .get(createApiPath('/auth/me'))
        .set(createAuthHeaders(user1Token))
        .expect(200);

      expect(response1.body).toEqual({
        id: mockUser1.id,
        clerkId: mockUser1.clerkId,
        email: mockUser1.email,
        firstName: mockUser1.firstName,
        lastName: mockUser1.lastName,
        avatarUrl: mockUser1.avatarUrl,
        bio: mockUser1.bio,
        accountType: mockUser1.accountType,
        setupComplete: mockUser1.setupComplete,
        createdAt: mockUser1.createdAt.toISOString(),
        updatedAt: mockUser1.updatedAt.toISOString(),
      });

      // Test second user
      const response2 = await request(app.getHttpServer())
        .get(createApiPath('/auth/me'))
        .set(createAuthHeaders(user2Token))
        .expect(200);

      expect(response2.body).toEqual({
        id: mockUser2.id,
        clerkId: mockUser2.clerkId,
        email: mockUser2.email,
        firstName: mockUser2.firstName,
        lastName: mockUser2.lastName,
        avatarUrl: mockUser2.avatarUrl,
        bio: mockUser2.bio,
        accountType: mockUser2.accountType,
        setupComplete: mockUser2.setupComplete,
        createdAt: mockUser2.createdAt.toISOString(),
        updatedAt: mockUser2.updatedAt.toISOString(),
      });
    });
  });

  describe('GET /auth/admin/test', () => {
    it('should return 200 OK for public smoke test endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(createApiPath('/auth/admin/test'))
        .expect(200);

      expect(response.body).toEqual({
        message: 'Auth module is working correctly',
        timestamp: expect.any(String),
      });
    });
  });
});
