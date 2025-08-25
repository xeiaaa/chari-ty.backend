import { Module, forwardRef } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PublicGroupsController } from './public-groups.controller';
import { AdminGroupsController } from './admin-groups.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { FundraisersModule } from '../fundraisers/fundraisers.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { DonationsModule } from '../donations/donations.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FundraisersModule),
    AuthModule,
    UsersModule,
    DonationsModule,
    UploadsModule,
  ],
  controllers: [
    GroupsController,
    PublicGroupsController,
    AdminGroupsController,
  ],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
