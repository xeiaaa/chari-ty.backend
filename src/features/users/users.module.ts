import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PublicUsersController } from './public-users.controller';
import { UsersService } from './users.service';

/**
 * UsersModule handles user-related functionality
 */
@Module({
  controllers: [UsersController, PublicUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
