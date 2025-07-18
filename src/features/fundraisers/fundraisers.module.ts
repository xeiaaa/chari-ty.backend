import { Module } from '@nestjs/common';
import { FundraisersController } from './fundraisers.controller';
import { PublicFundraisersController } from './public-fundraisers.controller';
import { FundraisersService } from './fundraisers.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MilestonesModule } from '../milestones/milestones.module';

@Module({
  imports: [PrismaModule, AuthModule, MilestonesModule],
  controllers: [FundraisersController, PublicFundraisersController],
  providers: [FundraisersService],
  exports: [FundraisersService],
})
export class FundraisersModule {}
