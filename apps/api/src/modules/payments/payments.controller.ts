import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePayment(user, dto);
  }

  /** Vérifie le statut en direct d'une transaction ou commande */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Get('status/:id')
  checkStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.paymentsService.checkPaymentStatus(user, id);
  }

  /** Webhook principal neutre (C2B & B2C, vérification HMAC-SHA256) */
  @SkipThrottle()
  @Post('callbacks/gateway')
  handleGatewayCallback(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-maishapay-signature') signature: string | undefined,
    @Body() payload: Record<string, any>,
  ) {
    return this.paymentsService.handleGatewayWebhook(req.rawBody, signature, payload);
  }

  /** Alias silencieux pour compatibilité webhook */
  @SkipThrottle()
  @Post('webhooks/maishapay')
  handleGatewayWebhookAlias(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-maishapay-signature') signature: string | undefined,
    @Body() payload: Record<string, any>,
  ) {
    return this.paymentsService.handleGatewayWebhook(req.rawBody, signature, payload);
  }

  /** Callback GET de retour Carte Visa / Mastercard (?status=200&description=APPROVED&...) */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('callbacks/card')
  handleCardRedirect(
    @Query('status') status?: string,
    @Query('description') description?: string,
    @Query('transactionRefId') transactionRefId?: string,
    @Query('operatorRefId') operatorRefId?: string,
  ) {
    return this.paymentsService.handleCardRedirectCallback({
      status,
      description,
      transactionRefId,
      operatorRefId,
    });
  }

  @SkipThrottle()
  @Post('webhooks/stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Corps brut ou signature Stripe manquant');
    }
    try {
      return await this.paymentsService.handleStripeWebhook(req.rawBody, signature);
    } catch (err) {
      if ((err as { type?: string })?.type === 'StripeSignatureVerificationError') {
        throw new BadRequestException('Signature Stripe invalide');
      }
      throw err;
    }
  }
}
