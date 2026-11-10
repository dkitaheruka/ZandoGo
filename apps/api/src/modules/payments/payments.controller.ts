import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Chaque appel peut déclencher une demande de validation sur le téléphone d'un tiers
  // (numéro saisi librement) : plafonné. Les webhooks ci-dessous ne le sont JAMAIS : ils
  // viennent des serveurs de CinetPay/Stripe, pas d'un utilisateur.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Post('initiate')
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePayment(user, dto);
  }

  /**
   * Webhook public (CinetPay ne peut pas envoyer de JWT). La sécurité repose
   * ici sur la contre-vérification systématique auprès de l'API CinetPay
   * dans PaymentsService, jamais sur la confiance dans ce payload entrant.
   */
  @Post('webhooks/cinetpay')
  handleCinetPayWebhook(@Body() payload: any) {
    return this.paymentsService.handleCinetPayWebhook(payload);
  }

  /**
   * Nécessite le body brut (non parsé en JSON) pour vérifier la signature
   * Stripe — voir la configuration dédiée de cette route dans main.ts.
   */
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
      // Une signature invalide doit répondre 400, pas 500 : un 500 fait réessayer Stripe sans
      // fin, et renvoie une erreur serveur à quiconque forge un faux appel.
      if ((err as { type?: string })?.type === 'StripeSignatureVerificationError') {
        throw new BadRequestException('Signature Stripe invalide');
      }
      throw err;
    }
  }
}
