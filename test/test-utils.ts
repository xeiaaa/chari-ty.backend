import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AccountType } from '../generated/prisma';
import { PrismaService } from '../src/core/prisma/prisma.service';

/**
 * Creates and configures a NestJS application for e2e testing
 * with the same configuration as the main application
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Apply same configuration as main.ts
  const configService = app.get(ConfigService);

  app.enableCors();

  // Set global API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  return app;
}

/**
 * Helper function to get the API prefix used in tests
 */
export function getApiPrefix(): string {
  return process.env.API_PREFIX || 'api/v1';
}

/**
 * Helper function to create a full API path with prefix
 */
export function createApiPath(path: string): string {
  const prefix = getApiPrefix();
  return `/${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Mock user data for testing
 */
export const mockUser1 = {
  id: 'test-user-1-id',
  clerkId: 'test-clerk-1-id',
  email: 'user1@example.com',
  username: 'user123456',
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

/**
 * Second mock user data for testing
 */
export const mockUser2 = {
  id: 'test-user-2-id',
  clerkId: 'test-clerk-2-id',
  email: 'user2@example.com',
  username: 'user234567',
  firstName: 'Jane',
  lastName: 'Smith',
  avatarUrl: 'https://example.com/avatar2.jpg',
  bio: 'Second test user bio',
  accountType: AccountType.nonprofit,
  setupComplete: false,
  createdAt: new Date('2024-01-02T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  groupMemberships: [],
};

/**
 * Legacy mock user for backward compatibility
 */
export const mockUser = mockUser1;

/**
 * Create a development token for testing
 * This follows the format expected by the ClerkService
 */
export function createDevelopmentToken(
  userId: string = 'test-clerk-1-id',
  email: string = 'user1@example.com',
): string {
  const header = {
    alg: 'dev',
    typ: 'JWT',
  };

  const payload = {
    sub: userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iss: 'clerk-dev',
  };

  // Base64URL encode header and payload
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );

  // Create a simple signature for development
  const signature = Buffer.from(
    `dev-signature-${userId}-${Date.now()}`,
  ).toString('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Create authorization headers for authenticated requests
 */
export function createAuthHeaders(token?: string): { Authorization: string } {
  const authToken = token || createDevelopmentToken();
  return {
    Authorization: `Bearer ${authToken}`,
  };
}

/**
 * Mock authentication for a specific user
 */
export function mockAuth(
  clerkService: any,
  usersService: any,
  clerkId: string,
  email: string,
  user: any,
) {
  const verifySessionTokenSpy = jest.spyOn(clerkService, 'verifySessionToken');
  verifySessionTokenSpy.mockResolvedValue({
    sub: clerkId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'clerk-dev',
  });

  const findUserByClerkIdSpy = jest.spyOn(usersService, 'findUserByClerkId');
  findUserByClerkIdSpy.mockResolvedValue(user);

  return { verifySessionTokenSpy, findUserByClerkIdSpy };
}

/**
 * Completely reset the database by truncating all tables
 */
export async function resetDatabase(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    // Disable foreign key constraints temporarily
    await prisma.$executeRaw`SET session_replication_role = replica;`;

    // Use raw SQL to truncate all tables and reset sequences
    await prisma.$executeRaw`TRUNCATE TABLE "fundraisers" RESTART IDENTITY CASCADE;`;
    await prisma.$executeRaw`TRUNCATE TABLE "group_members" RESTART IDENTITY CASCADE;`;
    await prisma.$executeRaw`TRUNCATE TABLE "groups" RESTART IDENTITY CASCADE;`;
    await prisma.$executeRaw`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE;`;

    // Re-enable foreign key constraints
    await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seed the test database with mock users
 */
export async function seedTestDatabase(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.user.upsert({
    where: { id: mockUser1.id },
    update: {},
    create: {
      id: mockUser1.id,
      clerkId: mockUser1.clerkId,
      email: mockUser1.email,
      username: mockUser1.username,
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
  await prisma.user.upsert({
    where: { id: mockUser2.id },
    update: {},
    create: {
      id: mockUser2.id,
      clerkId: mockUser2.clerkId,
      email: mockUser2.email,
      username: mockUser2.username,
      firstName: mockUser2.firstName,
      lastName: mockUser2.lastName,
      avatarUrl: mockUser2.avatarUrl,
      bio: mockUser2.bio,
      accountType: mockUser2.accountType,
      setupComplete: mockUser2.setupComplete,
      createdAt: mockUser2.createdAt,
      updatedAt: mockUser2.updatedAt,
    },
  });
  await prisma.$disconnect();
}

/**
 * Format milestone response by converting amount to string
 */
export function formatMilestoneResponse<T extends { amount: number }>(
  milestone: T,
): T & { amount: string } {
  return {
    ...milestone,
    amount: milestone.amount.toString(),
  };
}
