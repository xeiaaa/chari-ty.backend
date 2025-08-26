import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationType } from '../../../generated/prisma';

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

  getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
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
