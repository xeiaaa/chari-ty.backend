import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PusherService } from '../services/pusher.service';
import { AuthGuard } from '../../features/auth/auth.guard';
import { AuthUser } from '../decorators';
import { User as UserEntity } from '../../../generated/prisma';

@Controller('pusher')
@UseGuards(AuthGuard)
export class PusherAuthController {
  constructor(private readonly pusherService: PusherService) {}

  @Post('auth')
  authenticate(
    @Body() body: { socket_id: string; channel_name: string },
    @AuthUser() user: UserEntity,
  ) {
    // Verify that the user is trying to subscribe to their own channel
    const expectedChannel = `private-user-${user.id}`;
    if (body.channel_name !== expectedChannel) {
      throw new Error('Unauthorized channel access');
    }

    return this.pusherService.authenticateUser(
      user.id,
      body.socket_id,
      body.channel_name,
    );
  }
}
