import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [AuthModule, AuditModule, RealtimeModule, WalletsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
