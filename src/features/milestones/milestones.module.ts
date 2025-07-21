import { Module, forwardRef } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => UsersModule)],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
