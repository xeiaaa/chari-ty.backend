import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PublicUsersController } from './public-users.controller';
import { UsersService } from './users.service';
import { FundraisersModule } from '../fundraisers/fundraisers.module';
import { CommonModule } from '../../common/common.module';

/**
 * UsersModule handles user-related functionality
 */
@Module({
  imports: [
    forwardRef(() => FundraisersModule),
    forwardRef(() => CommonModule),
  ],
  controllers: [UsersController, PublicUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
