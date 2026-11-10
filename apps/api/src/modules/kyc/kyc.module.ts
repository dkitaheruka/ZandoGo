import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UploadsModule } from '../uploads/uploads.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [AuthModule, AuditModule, RealtimeModule, UploadsModule],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
