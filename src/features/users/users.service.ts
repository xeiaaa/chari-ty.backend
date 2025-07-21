import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { User, AccountType } from '../../../generated/prisma';

/**
 * UsersService handles all user-related database operations
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        Fundraiser: {
          where: {
            isPublic: true,
            status: 'published',
          },
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            category: true,
            goalAmount: true,
            currency: true,
            endDate: true,
            coverUrl: true,
            createdAt: true,
          },
        },
      },
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
      fundraisers: user.Fundraiser,
    };
  }
}
