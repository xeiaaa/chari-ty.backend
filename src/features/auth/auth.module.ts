import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { ClerkService } from './clerk.service';
import { UsersModule } from '../users/users.module';

/**
 * AuthModule handles authentication functionality
 * and provides the AuthGuard globally to the application
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    ClerkService,
    AuthGuard,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
