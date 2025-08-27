import { Module, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationHelpersService } from './notification-helpers.service';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
    CommonModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationHelpersService],
  exports: [NotificationsService, NotificationHelpersService],
})
export class NotificationsModule {}
