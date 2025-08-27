import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../../common/decorators';
import { User as UserEntity } from '../../../generated/prisma';
import { ListNotificationsDto } from './dtos/list-notifications.dto';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getUserNotifications(
    @AuthUser() user: UserEntity,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('unread-count')
  async getUnreadCount(@AuthUser() user: UserEntity) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('mark-all-read')
  markAllAsRead(@AuthUser() user: UserEntity) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  deleteNotification(@Param('id') id: string) {
    return this.notificationsService.deleteNotification(id);
  }

  @Delete()
  deleteAllNotifications(@AuthUser() user: UserEntity) {
    return this.notificationsService.deleteAllNotifications(user.id);
  }
}
