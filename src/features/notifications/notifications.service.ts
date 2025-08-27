import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationType } from '../../../generated/prisma';
import { ListNotificationsDto } from './dtos/list-notifications.dto';
import { PaginatedNotificationsDto } from './dtos/paginated-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  notify(userId: string, type: NotificationType, data: any) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        data,
      },
    });
  }

  notifyAll(userIds: string[], type: NotificationType, data: any) {
    const notifications = userIds.map((userId) => ({
      userId,
      type,
      data,
    }));

    return this.prisma.notification.createMany({
      data: notifications,
    });
  }

  markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
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
