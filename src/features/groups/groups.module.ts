import { Module, forwardRef } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PublicGroupsController } from './public-groups.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { FundraisersModule } from '../fundraisers/fundraisers.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FundraisersModule),
    AuthModule,
    UsersModule,
  ],
  controllers: [GroupsController, PublicGroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
