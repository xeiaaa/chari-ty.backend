import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationType } from '../../../generated/prisma';
import { ListNotificationsDto } from './dtos/list-notifications.dto';
import { PaginatedNotificationsDto } from './dtos/paginated-notifications.dto';
import { PusherService } from '../../common/services/pusher.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pusherService: PusherService,
  ) {}

  async notify(userId: string, type: NotificationType, data: any) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        data,
      },
    });

    // Send real-time notification via Pusher
    try {
      await this.pusherService.sendNotificationToUser(userId, notification);

      // Update unread count
      const unreadCount = await this.getUnreadCount(userId);
      await this.pusherService.sendUnreadCountUpdate(userId, unreadCount);
    } catch (error) {
      // Log error but don't fail the notification creation
      console.error('Failed to send Pusher notification:', error);
    }

    return notification;
  }

  async notifyAll(userIds: string[], type: NotificationType, data: any) {
    const notifications = userIds.map((userId) => ({
      userId,
      type,
      data,
    }));

    const result = await this.prisma.notification.createMany({
      data: notifications,
    });

    // Send real-time notifications via Pusher
    try {
      // Create notification object for Pusher
      const notificationData = {
        type,
        data,
        createdAt: new Date(),
        read: false,
      };

      await this.pusherService.sendNotificationToUsers(
        userIds,
        notificationData,
      );

      // Update unread counts for all users
      for (const userId of userIds) {
        const unreadCount = await this.getUnreadCount(userId);
        await this.pusherService.sendUnreadCountUpdate(userId, unreadCount);
      }
    } catch (error) {
      // Log error but don't fail the notification creation
      console.error('Failed to send Pusher notifications:', error);
    }

    return result;
  }

  async markAsRead(id: string) {
    const notification = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
      include: { user: true },
    });

    // Send unread count update via Pusher
    try {
      const unreadCount = await this.getUnreadCount(notification.userId);
      await this.pusherService.sendUnreadCountUpdate(
        notification.userId,
        unreadCount,
      );
    } catch (error) {
      console.error('Failed to send unread count update:', error);
    }

    return notification;
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    // Send unread count update via Pusher
    try {
      const unreadCount = await this.getUnreadCount(userId);
      await this.pusherService.sendUnreadCountUpdate(userId, unreadCount);
    } catch (error) {
      console.error('Failed to send unread count update:', error);
    }

    return result;
  }

  async getUserNotifications(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<PaginatedNotificationsDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };
  }

  getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  deleteNotification(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  deleteAllNotifications(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }
}
