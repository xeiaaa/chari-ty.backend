import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  getUserNotifications(
    @AuthUser() user: UserEntity,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  @Get('unread-count')
  @Throttle({ default: { limit: 120, ttl: 60000 } }) // 120 requests per minute per user
  async getUnreadCount(@AuthUser() user: UserEntity) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute per user
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('mark-all-read')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per user
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
