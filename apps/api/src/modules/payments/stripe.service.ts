import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    orderId: string;
  }): Promise<Stripe.PaymentIntent> {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Le paiement par carte n’est pas configuré');
    }
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new Error('Stripe payment amount must be a positive finite number');
    }

    return this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      metadata: { orderId: params.orderId },
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !webhookSecret) {
      throw new ServiceUnavailableException('Le webhook Stripe n’est pas configuré');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
