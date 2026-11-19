import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { FinanceModule } from '../finance/finance.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  imports: [AssistantModule, AuthModule, AuditModule, CatalogModule, FinanceModule, PaymentsModule, RealtimeModule],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
