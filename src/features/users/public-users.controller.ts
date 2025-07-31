import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '../../common/decorators';

/**
 * Public controller for users
 * These endpoints don't require authentication
 */
@Controller('public/users')
export class PublicUsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get a single public user by username
   * GET /api/v1/public/users/username/:username
   */
  @Public()
  @Get('username/:username')
  async findPublicByUsername(@Param('username') username: string) {
    return await this.usersService.findPublicByUsername(username);
  }
}
