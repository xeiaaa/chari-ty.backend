import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createApiPath,
  createAuthHeaders,
  createDevelopmentToken,
  mockUser1,
  resetDatabase,
} from './test-utils';
import { UsersService } from '../src/features/users/users.service';
import { ClerkService } from '../src/features/auth/clerk.service';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { FundraiserCategory, FundraiserOwnerType } from '../generated/prisma';

describe('FundraisersController (e2e)', () => {
  let app: INestApplication<App>;
  let usersService: UsersService;
  let clerkService: ClerkService;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    usersService = app.get(UsersService);
    clerkService = app.get(ClerkService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Reset database completely
    await resetDatabase();

    // Seed test user
    await prisma.user.create({
      data: {
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

    // Mock auth services
    jest.spyOn(clerkService, 'verifySessionToken').mockResolvedValue({
      sub: mockUser1.clerkId,
      email: mockUser1.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'clerk-dev',
    });

    jest.spyOn(usersService, 'findUserByClerkId').mockResolvedValue(mockUser1);
  });

  afterEach(async () => {
    // Clean up after each test
    await resetDatabase();
    jest.clearAllMocks();
  });

  describe('POST /fundraisers', () => {
    const validUserFundraiser = {
      title: 'Help Build a Community Garden',
      summary: 'Creating a sustainable garden space for our neighborhood',
      description:
        "We're transforming an empty lot into a vibrant community garden.",
      category: FundraiserCategory.community,
      goalAmount: 5000,
      currency: 'USD',
      endDate: '2025-12-31',
      coverUrl: 'https://example.com/images/garden-cover.jpg',
      galleryUrls: [
        'https://example.com/images/garden-1.jpg',
        'https://example.com/images/garden-2.jpg',
      ],
      ownerType: FundraiserOwnerType.user,
      isPublic: true,
    };

    it('should return 401 Unauthorized when no authentication token is provided', async () => {
      await request(app.getHttpServer())
        .post(createApiPath('/fundraisers'))
        .send(validUserFundraiser)
        .expect(401);
    });

    it('should create a user-owned fundraiser successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(createApiPath('/fundraisers'))
        .set(
          createAuthHeaders(
            createDevelopmentToken(mockUser1.clerkId, mockUser1.email),
          ),
        )
        .send(validUserFundraiser)
        .expect(201);

      expect(response.body).toMatchObject({
        title: validUserFundraiser.title,
        summary: validUserFundraiser.summary,
        description: validUserFundraiser.description,
        category: validUserFundraiser.category,
        goalAmount: validUserFundraiser.goalAmount.toString(),
        currency: validUserFundraiser.currency,
        coverUrl: validUserFundraiser.coverUrl,
        galleryUrls: validUserFundraiser.galleryUrls,
        ownerType: validUserFundraiser.ownerType,
        isPublic: validUserFundraiser.isPublic,
        id: expect.any(String),
        slug: expect.any(String),
        status: 'draft',
        userId: mockUser1.id,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should create a group-owned fundraiser successfully when user has permission', async () => {
      // Create a test group
      const group = await prisma.group.create({
        data: {
          name: 'Test Group',
          type: 'nonprofit',
          members: {
            create: {
              userId: mockUser1.id,
              role: 'admin',
              status: 'active',
            },
          },
        },
      });

      const groupFundraiser = {
        ...validUserFundraiser,
        ownerType: FundraiserOwnerType.group,
        groupId: group.id,
      };

      const response = await request(app.getHttpServer())
        .post(createApiPath('/fundraisers'))
        .set(
          createAuthHeaders(
            createDevelopmentToken(mockUser1.clerkId, mockUser1.email),
          ),
        )
        .send(groupFundraiser)
        .expect(201);

      expect(response.body).toMatchObject({
        title: groupFundraiser.title,
        summary: groupFundraiser.summary,
        description: groupFundraiser.description,
        category: groupFundraiser.category,
        goalAmount: groupFundraiser.goalAmount.toString(),
        currency: groupFundraiser.currency,
        coverUrl: groupFundraiser.coverUrl,
        galleryUrls: groupFundraiser.galleryUrls,
        ownerType: groupFundraiser.ownerType,
        isPublic: groupFundraiser.isPublic,
        id: expect.any(String),
        slug: expect.any(String),
        status: 'draft',
        groupId: group.id,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 403 Forbidden when creating group fundraiser without permission', async () => {
      // Create a test group (user is not a member)
      const group = await prisma.group.create({
        data: {
          name: 'Test Group',
          type: 'nonprofit',
        },
      });

      const groupFundraiser = {
        ...validUserFundraiser,
        ownerType: FundraiserOwnerType.group,
        groupId: group.id,
      };

      await request(app.getHttpServer())
        .post(createApiPath('/fundraisers'))
        .set(
          createAuthHeaders(
            createDevelopmentToken(mockUser1.clerkId, mockUser1.email),
          ),
        )
        .send(groupFundraiser)
        .expect(403);
    });

    it('should return 400 Bad Request when required fields are missing', async () => {
      const invalidFundraiser = {
        title: 'Missing Required Fields',
      };

      await request(app.getHttpServer())
        .post(createApiPath('/fundraisers'))
        .set(
          createAuthHeaders(
            createDevelopmentToken(mockUser1.clerkId, mockUser1.email),
          ),
        )
        .send(invalidFundraiser)
        .expect(400);
    });
  });
});
