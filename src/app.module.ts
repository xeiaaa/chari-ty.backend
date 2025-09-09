import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/prisma/prisma.module';
import { UsersModule } from './features/users/users.module';
import { AuthModule } from './features/auth/auth.module';
import { WebhooksModule } from './features/webhooks/webhooks.module';
import { FundraisersModule } from './features/fundraisers/fundraisers.module';
import { LinksModule } from './features/links/links.module';
import { DonationsModule } from './features/donations/donations.module';
import { UploadsModule } from './features/uploads/uploads.module';
import { GroupsModule } from './features/groups/groups.module';
import { PaymentsModule } from './features/payments/payments.module';
import { MilestonesModule } from './features/milestones/milestones.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { CommonModule } from './common/common.module';
import { getThrottlerConfig } from './common/config/throttler.config';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getThrottlerConfig,
    }),
    CacheModule.registerAsync<{ stores?: unknown[]; ttl?: number }>({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl: string | undefined =
          configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          return { ttl: 60_000 };
        }
        return {
          ttl: 60_000,
          stores: [new KeyvRedis(redisUrl)],
        };
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WebhooksModule,
    FundraisersModule,
    LinksModule,
    DonationsModule,
    UploadsModule,
    GroupsModule,
    PaymentsModule,
    MilestonesModule,
    NotificationsModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
