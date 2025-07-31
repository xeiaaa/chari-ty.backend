import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FundraisersService } from '../fundraisers/fundraisers.service';
import { User, AccountType, Prisma } from '../../../generated/prisma';

/**
 * UsersService handles all user-related database operations
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => FundraisersService))
    private readonly fundraisersService: FundraisersService,
  ) {}

  async createUser(userData: {
    clerkId: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    bio?: string;
    accountType: AccountType;
  }): Promise<User> {
    return this.prisma.user.create({
      data: userData,
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findUserByClerkId(clerkId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { clerkId },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: userData,
    });
  }

  async deleteUser(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async getAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  /**
   * Find a user by username
   */
  async findUserByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Get public user data by username
   * Returns only non-private information
   */
  async findPublicByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return only public data
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      accountType: user.accountType,
      createdAt: user.createdAt,
    };
  }

  /**
   * Search for users by partial name, exact email, or exact username
   * Optionally exclude users already in a specific group
   */
  async searchUsers(params: {
    q: string;
    limit?: number;
    groupId?: string;
  }): Promise<
    Array<{
      id: string;
      name: string;
      username: string;
      email: string;
      avatarUrl: string | null;
    }>
  > {
    const { q, limit = 10, groupId } = params;

    // Build the where clause for the search
    const whereClause: Prisma.UserWhereInput = {
      OR: [
        // Search by partial name (firstName or lastName)
        {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ],
        },
        // Search by exact email
        { email: { equals: q, mode: 'insensitive' } },
        // Search by exact username
        { username: { equals: q, mode: 'insensitive' } },
      ],
    };

    // If groupId is provided, exclude users already in that group
    if (groupId) {
      whereClause.NOT = {
        groupMemberships: {
          some: {
            groupId,
            status: { in: ['active', 'invited'] }, // Exclude both active and invited members
          },
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
      take: limit,
      orderBy: [
        // Prioritize exact matches
        { email: 'asc' },
        { username: 'asc' },
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    });

    // Transform the results to match the expected format
    return users.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    }));
  }
}
