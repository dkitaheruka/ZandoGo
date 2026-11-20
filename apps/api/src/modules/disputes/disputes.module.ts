import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WalletsModule } from '../wallets/wallets.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [AssistantModule, AuthModule, AuditModule, RealtimeModule, UploadsModule, WalletsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
