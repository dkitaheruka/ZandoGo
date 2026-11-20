import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { WsJwtGuard } from '../../common/realtime/ws-jwt.guard';
import { AssistantModule } from '../assistant/assistant.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AfricasTalkingSmsController } from './africastalking-sms.controller';
import { AfricasTalkingSmsService } from './africastalking-sms.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [AuditModule, AuthModule, AssistantModule, UploadsModule],
  controllers: [AfricasTalkingSmsController, ChatController, NotificationsController],
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
