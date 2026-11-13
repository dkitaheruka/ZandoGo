import { Module } from '@nestjs/common';
import { WsJwtGuard } from '../../common/realtime/ws-jwt.guard';
import { AuthModule } from '../auth/auth.module';
import { AfricasTalkingSmsService } from './africastalking-sms.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [AuthModule],
  controllers: [ChatController, NotificationsController],
  providers: [
    AfricasTalkingSmsService,
    ChatGateway,
    ChatService,
    NotificationsGateway,
    TrackingGateway,
    WsJwtGuard,
  ],
  exports: [AfricasTalkingSmsService, ChatService, NotificationsGateway, TrackingGateway],
})
export class RealtimeModule {}
