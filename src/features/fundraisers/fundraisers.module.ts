import { Module } from '@nestjs/common';
import { FundraisersController } from './fundraisers.controller';
import { FundraisersService } from './fundraisers.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MilestonesModule } from '../milestones/milestones.module';

@Module({
  imports: [PrismaModule, AuthModule, MilestonesModule],
  controllers: [FundraisersController],
  providers: [FundraisersService],
  exports: [FundraisersService],
})
export class FundraisersModule {}
