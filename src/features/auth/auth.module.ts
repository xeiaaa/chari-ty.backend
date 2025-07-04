import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { ClerkService } from './clerk.service';
import { OnboardingService } from './onboarding.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../../core/prisma/prisma.module';

/**
 * AuthModule handles authentication functionality
 * and provides the AuthGuard globally to the application
 */
@Module({
  imports: [UsersModule, PrismaModule],
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
})
export class AuthModule {}
