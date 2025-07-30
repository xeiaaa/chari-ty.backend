import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { User } from '../../../generated/prisma';
import { Public } from '../../common/decorators';

/**
 * UsersController handles HTTP requests for user management
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get all users
   */
  @Get()
  async getAllUsers(): Promise<User[]> {
    return this.usersService.getAllUsers();
  }

  /**
   * Search for users by partial name, exact email, or exact username
   * Used for invitation purposes
   */
  @Get('search')
  async searchUsers(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('groupId') groupId?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      username: string;
      email: string;
      avatarUrl: string | null;
    }>
  > {
    if (!q) {
      throw new BadRequestException('Search query parameter "q" is required');
    }

    const limitNumber = limit ? parseInt(limit, 10) : 10;
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50) {
      throw new BadRequestException('Limit must be a number between 1 and 50');
    }

    return this.usersService.searchUsers({
      q: q.trim(),
      limit: limitNumber,
      groupId,
    });
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findUserById(id);
  }

  /**
   * Generate Clerk development token by email (DEVELOPMENT ONLY)
   * @param email - User email to search for
   */
  @Public()
  @Get('clerk/token')
  async generateClerkDevToken(@Query('email') email: string): Promise<{
    token: string;
    clerkId: string;
    email: string;
    note: string;
  }> {
    // Only allow in development environment
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv !== 'development') {
      throw new ForbiddenException(
        'This endpoint is only available in development mode',
      );
    }

    if (!email) {
      throw new BadRequestException('Email query parameter is required');
    }

    // Find user by email
    const user = await this.usersService.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    try {
      // Get Clerk secret key
      const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      if (!clerkSecretKey) {
        throw new Error('CLERK_SECRET_KEY not found in environment variables');
      }

      // Create a development token for testing
      // Note: This is a simplified token for development testing
      // In production, you would use Clerk's actual token generation
      const timestamp = Date.now();
      const tokenData = {
        sub: user.clerkId,
        email: user.email,
        iat: Math.floor(timestamp / 1000),
        exp: Math.floor(timestamp / 1000) + 24 * 60 * 60, // 24 hours
        iss: 'clerk-dev',
      };

      // Create a simple JWT-like token for development
      const header = Buffer.from(
        JSON.stringify({ alg: 'dev', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(JSON.stringify(tokenData)).toString(
        'base64url',
      );
      const signature = Buffer.from(
        `dev-signature-${user.clerkId}-${timestamp}`,
      ).toString('base64url');

      const token = `${header}.${payload}.${signature}`;

      return {
        token,
        clerkId: user.clerkId,
        email: user.email,
        note: 'This is a development token for testing purposes only',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate development token: ${error.message}`,
      );
    }
  }

  /**
   * Get user by Clerk ID
   */
  @Get('clerk/:clerkId')
  async getUserByClerkId(
    @Param('clerkId') clerkId: string,
  ): Promise<User | null> {
    return this.usersService.findUserByClerkId(clerkId);
  }

  /**
   * Update user by ID
   */
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateUser(id, updateUserDto);
  }

  /**
   * Delete user by ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string): Promise<void> {
    await this.usersService.deleteUser(id);
  }

  /**
   * Admin test endpoint for smoke testing
   */
  @Public()
  @Get('admin/test')
  adminTest(): { message: string; timestamp: string } {
    return {
      message: 'Users module is working correctly',
      timestamp: new Date().toISOString(),
    };
  }
}
