import { Injectable, Logger } from '@nestjs/common';
import * as Pusher from 'pusher';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PusherService {
  private readonly logger = new Logger(PusherService.name);
  private pusher: Pusher;

  constructor(private configService: ConfigService) {
    const appId = this.configService.get<string>('PUSHER_APP_ID');
    const key = this.configService.get<string>('PUSHER_API_KEY');
    const secret = this.configService.get<string>('PUSHER_SECRET_KEY');
    const cluster = this.configService.get<string>('PUSHER_CLUSTER');

    if (!appId || !key || !secret || !cluster) {
      throw new Error(
        'Missing required Pusher configuration. Please check your environment variables.',
      );
    }

    this.pusher = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  /**
   * Send a notification to a specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: any,
  ): Promise<void> {
    try {
      await this.pusher.trigger(`private-user-${userId}`, 'notification', {
        notification,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`Notification sent to user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification to user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send a notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[],
    notification: any,
  ): Promise<void> {
    try {
      const promises = userIds.map((userId) =>
        this.pusher.trigger(`private-user-${userId}`, 'notification', {
          notification,
          timestamp: new Date().toISOString(),
        }),
      );

      await Promise.all(promises);
      this.logger.log(`Notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error(`Failed to send notification to users:`, error);
      throw error;
    }
  }

  /**
   * Send unread count update to a user
   */
  async sendUnreadCountUpdate(userId: string, count: number): Promise<void> {
    try {
      await this.pusher.trigger(
        `private-user-${userId}`,
        'unread-count-update',
        {
          count,
          timestamp: new Date().toISOString(),
        },
      );
      this.logger.log(`Unread count update sent to user ${userId}: ${count}`);
    } catch (error) {
      this.logger.error(
        `Failed to send unread count update to user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate authentication token for client
   */
  authenticateUser(userId: string, socketId: string, channel: string): any {
    try {
      const authResponse = this.pusher.authorizeChannel(socketId, channel);
      this.logger.log(
        `Authentication successful for user ${userId} on channel ${channel}`,
      );
      return authResponse;
    } catch (error) {
      this.logger.error(
        `Authentication failed for user ${userId} on channel ${channel}:`,
        error,
      );
      throw error;
    }
  }
}
