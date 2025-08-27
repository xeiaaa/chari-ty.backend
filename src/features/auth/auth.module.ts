import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { ClerkService } from './clerk.service';
import { OnboardingService } from './onboarding.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../../common/common.module';

/**
 * AuthModule handles authentication functionality
 * and provides the AuthGuard globally to the application
 */
@Module({
  imports: [
    forwardRef(() => UsersModule),
    PrismaModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => CommonModule),
  ],
  controllers: [AuthController],
  providers: [
    ClerkService,
    OnboardingService,
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [ClerkService],
})
export class AuthModule {}
