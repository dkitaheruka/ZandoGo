import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceController, PlatformPricingController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [FinanceController, PlatformPricingController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
