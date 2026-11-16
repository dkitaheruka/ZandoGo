import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { WalletsModule } from '../wallets/wallets.module';
import { CinetPayService } from './cinetpay.service';
import { MaishaPayService } from './maishapay.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [AuthModule, AuditModule, FinanceModule, forwardRef(() => WalletsModule)],
  controllers: [PaymentsController],
  providers: [CinetPayService, MaishaPayService, PaymentsService, StripeService],
  exports: [CinetPayService, MaishaPayService, PaymentsService, StripeService],
})
export class PaymentsModule {}
