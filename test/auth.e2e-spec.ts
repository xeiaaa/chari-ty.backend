import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createTestApp, resetDatabase } from './test-utils';
import { AccountType } from '../generated/prisma';
import * as request from 'supertest';
// import { ClerkService } from '../src/features/auth/clerk.service';
import { createFakeUserWithToken } from './factories/users.factory';

export const mockUser1 = {
  id: 'test-user-1-id',
  clerkId: 'test-clerk-1-id',
  email: 'user1@example.com',
  firstName: 'John',
  lastName: 'Doe',
  avatarUrl: 'https://example.com/avatar1.jpg',
  bio: 'First test user bio',
  accountType: AccountType.individual,
  setupComplete: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  groupMemberships: [],
};

describe('Auth Module', () => {
  let app: INestApplication<App>;
  // let clerkService: ClerkService;

  beforeAll(async () => {
    // Create test app before all tests
    app = await createTestApp();
    // clerkService = app.get(ClerkService);
  });

  afterAll(async () => {
    // Close test app after all tests
    await app.close();
  });

  beforeEach(async () => {
    // Reset database before each test
    await resetDatabase();
  });

  it('test', async () => {
    const { token } = await createFakeUserWithToken({
      accountType: AccountType.individual,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    console.log(response.body);
  });
});
