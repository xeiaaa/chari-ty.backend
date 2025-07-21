import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PublicGroupsController } from './public-groups.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GroupsController, PublicGroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
