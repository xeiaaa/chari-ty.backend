import { Controller, Get, NotFoundException } from '@nestjs/common';
import { Public, User } from '../../common/decorators';
import { UsersService } from '../users/users.service';
import { User as UserEntity } from '../../../generated/prisma';

/**
 * AuthController handles authentication-related HTTP requests
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current authenticated user's data
   * GET /api/v1/auth/me
   */
  @Get('me')
  async getCurrentUser(@User() user: any): Promise<UserEntity> {
    const currentUser = await this.usersService.findUserByClerkId(user.sub);

    if (!currentUser) {
      throw new NotFoundException('User not found in database');
    }

    return currentUser;
  }

  /**
   * Admin test endpoint for smoke testing
   */
  @Public()
  @Get('admin/test')
  adminTest(): { message: string; timestamp: string } {
    return {
      message: 'Auth module is working correctly',
      timestamp: new Date().toISOString(),
    };
  }
}
