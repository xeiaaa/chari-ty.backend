import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { createTestApp, resetDatabase } from './test-utils';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { AccountType } from '../generated/prisma';

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

  beforeAll(async () => {
    // Create test app before all tests
    app = await createTestApp();
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
    const prisma = new PrismaService();

    await prisma.user.upsert({
      where: { id: mockUser1.id },
      update: {},
      create: {
        id: mockUser1.id,
        clerkId: mockUser1.clerkId,
        email: mockUser1.email,
        firstName: mockUser1.firstName,
        lastName: mockUser1.lastName,
        avatarUrl: mockUser1.avatarUrl,
        bio: mockUser1.bio,
        accountType: mockUser1.accountType,
        setupComplete: mockUser1.setupComplete,
        createdAt: mockUser1.createdAt,
        updatedAt: mockUser1.updatedAt,
      },
    });
  });
});
