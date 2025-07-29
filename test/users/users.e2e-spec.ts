import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/core/prisma/prisma.service';
import { User, AccountType } from '../../generated/prisma';
import { createTestApp, resetDatabase, createApiPath } from '../test-utils';
import { createFakeUserWithToken } from '../factories/users.factory';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /users/search', () => {
    let testUsers: User[];
    let authToken: string;

    beforeEach(async () => {
      // Create an authenticated user for the tests
      const { token } = await createFakeUserWithToken({
        accountType: AccountType.individual,
      });
      authToken = token;

      // Create test users for searching
      testUsers = await Promise.all([
        prisma.user.create({
          data: {
            clerkId: 'clerk_1',
            email: 'john.doe@example.com',
            username: 'johndoe',
            firstName: 'John',
            lastName: 'Doe',
            avatarUrl: 'https://example.com/avatar1.jpg',
            accountType: AccountType.individual,
          },
        }),
        prisma.user.create({
          data: {
            clerkId: 'clerk_2',
            email: 'jane.smith@example.com',
            username: 'janesmith',
            firstName: 'Jane',
            lastName: 'Smith',
            avatarUrl: 'https://example.com/avatar2.jpg',
            accountType: AccountType.individual,
          },
        }),
        prisma.user.create({
          data: {
            clerkId: 'clerk_3',
            email: 'bob.wilson@example.com',
            username: 'bobwilson',
            firstName: 'Bob',
            lastName: 'Wilson',
            avatarUrl: null,
            accountType: AccountType.individual,
          },
        }),
      ]);
    });

    it('should search users by partial name', async () => {
      const response = await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual({
        id: testUsers[0].id,
        name: 'John Doe',
        username: 'johndoe',
        email: 'john.doe@example.com',
        avatarUrl: 'https://example.com/avatar1.jpg',
      });
    });

    it('should search users by exact email', async () => {
      const response = await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'jane.smith@example.com' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual({
        id: testUsers[1].id,
        name: 'Jane Smith',
        username: 'janesmith',
        email: 'jane.smith@example.com',
        avatarUrl: 'https://example.com/avatar2.jpg',
      });
    });

    it('should search users by exact username', async () => {
      const response = await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'bobwilson' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual({
        id: testUsers[2].id,
        name: 'Bob Wilson',
        username: 'bobwilson',
        email: 'bob.wilson@example.com',
        avatarUrl: null,
      });
    });

    it('should respect the limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'o', limit: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should exclude users already in a group when groupId is provided', async () => {
      // Create a test group
      const testGroup = await prisma.group.create({
        data: {
          name: 'Test Group',
          slug: 'test-group',
          type: 'team',
          ownerId: testUsers[0].id,
        },
      });

      // Add a user to the group
      await prisma.groupMember.create({
        data: {
          groupId: testGroup.id,
          userId: testUsers[0].id,
          role: 'viewer',
          status: 'active',
        },
      });

      // Search for users, excluding those in the group
      const response = await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'o', groupId: testGroup.id })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should not include the user who is already in the group
      const userIds = response.body.map((user: any) => user.id);
      expect(userIds).not.toContain(testUsers[0].id);
    });

    it('should return 401 when no authentication token is provided', async () => {
      await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'test' })
        .expect(401);
    });

    it('should return 400 when search query is missing', async () => {
      await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 400 when limit is invalid', async () => {
      await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'test', limit: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'test', limit: '0' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'test', limit: '51' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return empty array when no users match', async () => {
      const response = await request(app.getHttpServer())
        .get(createApiPath('users/search'))
        .query({ q: 'nonexistent' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });
});
