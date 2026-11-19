import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AssistantModule } from '../assistant/assistant.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MaishaPayService } from './maishapay.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    AssistantModule,
    AuthModule,
    AuditModule,
    FinanceModule,
    RealtimeModule,
    forwardRef(() => WalletsModule),
  ],
  controllers: [PaymentsController],
  providers: [MaishaPayService, PaymentsService, StripeService],
  exports: [MaishaPayService, PaymentsService, StripeService],
})
export class PaymentsModule {}
