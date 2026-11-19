import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY')?.trim();
    this.stripe = secretKey
      ? new Stripe(secretKey, {
          appInfo: {
            name: 'ZandoGo Marketplace',
            version: '1.0.0',
          },
        })
      : null;
  }

  isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  private mapStripeError(err: unknown): never {
    if (err instanceof Stripe.errors.StripeError) {
      this.logger.warn(`Stripe ${err.type} (${err.code || 'unknown'}): ${err.message}`);
      if (err.type === 'StripeCardError' || err.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(err.message || 'Paramètres de paiement carte invalides.');
      }
      if (err.type === 'StripeAuthenticationError' || err.type === 'StripePermissionError') {
        throw new ServiceUnavailableException('Clé API Stripe non autorisée ou invalide.');
      }
      throw new BadGatewayException(err.message || 'Erreur passagère du service carte Stripe.');
    }
    throw err;
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    orderId: string;
    orderNumber?: string;
    transactionId?: string;
    customerEmail?: string;
    idempotencyKey?: string;
  }): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Le paiement par carte Stripe n’est pas configuré');
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new BadRequestException('Le montant du paiement doit être supérieur à zéro.');
    }

    const currency = (params.currency || 'usd').toLowerCase();
    const unitAmount = Math.round(params.amount * 100);
    const idempotencyKey =
      params.idempotencyKey ||
      (params.transactionId ? `pi-order-${params.orderId}-tx-${params.transactionId}` : undefined);

    try {
      return await this.stripe.paymentIntents.create(
        {
          amount: unitAmount,
          currency,
          automatic_payment_methods: { enabled: true },
          description: params.orderNumber
            ? `Commande ZandoGo ${params.orderNumber}`
            : `Paiement ZandoGo ${params.orderId}`,
          receipt_email: params.customerEmail || undefined,
          metadata: {
            orderId: params.orderId,
            ...(params.orderNumber ? { orderNumber: params.orderNumber } : {}),
            ...(params.transactionId ? { transactionId: params.transactionId } : {}),
          },
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );
    } catch (err) {
      this.mapStripeError(err);
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent | null> {
    if (!this.stripe || !paymentIntentId) return null;
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      });
    } catch (err) {
      this.logger.warn(`Vérification PaymentIntent Stripe échouée (${paymentIntentId}): ${String(err)}`);
      return null;
    }
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!this.stripe || !webhookSecret) {
      throw new ServiceUnavailableException('Le webhook Stripe n’est pas configuré');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
