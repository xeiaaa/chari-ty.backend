import { Module, forwardRef } from '@nestjs/common';
import { PusherService } from './services/pusher.service';
import { PusherAuthController } from './controllers/pusher-auth.controller';
import { AuthModule } from '../features/auth/auth.module';
import { UsersModule } from '../features/users/users.module';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => UsersModule)],
  controllers: [PusherAuthController],
  providers: [PusherService],
  exports: [PusherService],
})
export class CommonModule {}
