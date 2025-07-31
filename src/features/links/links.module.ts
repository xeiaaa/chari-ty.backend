import { Module } from '@nestjs/common';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { LinkOwnerGuard } from './guards/link-owner.guard';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [LinksController],
  providers: [LinksService, LinkOwnerGuard],
  exports: [LinksService],
})
export class LinksModule {}
