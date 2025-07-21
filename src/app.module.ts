import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WebhooksModule,
    FundraisersModule,
    LinksModule,
    DonationsModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
