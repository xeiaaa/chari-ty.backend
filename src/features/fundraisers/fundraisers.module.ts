import { Module, forwardRef } from '@nestjs/common';
import { FundraisersController } from './fundraisers.controller';
import { PublicFundraisersController } from './public-fundraisers.controller';
import { FundraisersService } from './fundraisers.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MilestonesModule } from '../milestones/milestones.module';
import { UsersModule } from '../users/users.module';
import { DonationsModule } from '../donations/donations.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MilestonesModule,
    DonationsModule,
    UploadsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [FundraisersController, PublicFundraisersController],
  providers: [FundraisersService],
  exports: [FundraisersService],
})
export class FundraisersModule {}
