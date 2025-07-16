import { Module } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
