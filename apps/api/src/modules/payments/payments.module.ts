import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CinetPayService } from './cinetpay.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [PaymentsController],
  providers: [CinetPayService, PaymentsService, StripeService],
  exports: [CinetPayService, PaymentsService, StripeService],
})
export class PaymentsModule {}
