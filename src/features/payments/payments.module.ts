import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { GroupsModule } from '../groups/groups.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { FundraisersModule } from '../fundraisers/fundraisers.module';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [
    GroupsModule,
    AuthModule,
    UsersModule,
    forwardRef(() => FundraisersModule),
    PrismaModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
