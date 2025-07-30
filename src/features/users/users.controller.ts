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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dtos/update-user.dto';
import { User } from '../../../generated/prisma';
import { Public } from '../../common/decorators';

/**
 * UsersController handles HTTP requests for user management
 */
@ApiTags('users')
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
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'All users retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          clerkId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          username: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          accountType: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getAllUsers(): Promise<User[]> {
    return this.usersService.getAllUsers();
  }

  /**
   * Search for users by partial name, exact email, or exact username
   * Used for invitation purposes
   */
  @Get('search')
  @ApiOperation({ summary: 'Search for users by name, email, or username' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results (1-50)',
    required: false,
  })
  @ApiQuery({
    name: 'groupId',
    description: 'Group ID to exclude members from results',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Users found successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string' },
          avatarUrl: { type: 'string', nullable: true },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid query parameters',
  })
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
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User found successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        clerkId: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        username: { type: 'string', nullable: true },
        avatarUrl: { type: 'string', nullable: true },
        accountType: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findUserById(id);
  }

  /**
   * Generate Clerk development token by email (DEVELOPMENT ONLY)
   * @param email - User email to search for
   */
  @Public()
  @Get('clerk/token')
  @ApiOperation({
    summary: 'Generate Clerk development token (DEVELOPMENT ONLY)',
  })
  @ApiQuery({ name: 'email', description: 'User email', required: true })
  @ApiResponse({
    status: 200,
    description: 'Token generated successfully',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        clerkId: { type: 'string' },
        email: { type: 'string' },
        note: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only available in development',
  })
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
  @ApiOperation({ summary: 'Get user by Clerk ID' })
  @ApiParam({ name: 'clerkId', description: 'Clerk user ID' })
  @ApiResponse({
    status: 200,
    description: 'User found successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        clerkId: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        username: { type: 'string', nullable: true },
        avatarUrl: { type: 'string', nullable: true },
        accountType: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByClerkId(
    @Param('clerkId') clerkId: string,
  ): Promise<User | null> {
    return this.usersService.findUserByClerkId(clerkId);
  }

  /**
   * Update user by ID
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        clerkId: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        username: { type: 'string', nullable: true },
        avatarUrl: { type: 'string', nullable: true },
        accountType: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string): Promise<void> {
    await this.usersService.deleteUser(id);
  }

  /**
   * Admin test endpoint for smoke testing
   */
  @Public()
  @Get('admin/test')
  @ApiOperation({ summary: 'Admin test endpoint for smoke testing' })
  @ApiResponse({
    status: 200,
    description: 'Users module is working correctly',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  adminTest(): { message: string; timestamp: string } {
    return {
      message: 'Users module is working correctly',
      timestamp: new Date().toISOString(),
    };
  }
}
