import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [AuthModule, AuditModule, PaymentsModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
