import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

const CINETPAY_CHANNEL_BY_METHOD: Record<string, string> = {
  MOBILE_MONEY_ORANGE: 'MOBILE_MONEY',
  MOBILE_MONEY_AIRTEL: 'MOBILE_MONEY',
  MOBILE_MONEY_MPESA: 'MOBILE_MONEY',
};

interface CinetPayInitResponse {
  code: string;
  message: string;
  data?: { payment_url: string; payment_token: string };
}

/**
 * Wrapper autour de l'API CinetPay (https://docs.cinetpay.com).
 * Couvre Orange Money, Airtel Money et M-Pesa en RDC, en USD et CDF.
 */
@Injectable()
export class CinetPayService {
  constructor(private readonly config: ConfigService) {}

  async initiatePayment(params: {
    transactionId: string;
    amount: number;
    currency: 'USD' | 'CDF';
    description: string;
    customerPhone?: string;
    returnUrl: string;
    notifyUrl: string;
  }): Promise<CinetPayInitResponse> {
    const body = {
      apikey: this.config.get<string>('CINETPAY_API_KEY'),
      site_id: this.config.get<string>('CINETPAY_SITE_ID'),
      transaction_id: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      customer_phone_number: params.customerPhone,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      channels: 'MOBILE_MONEY',
    };

    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  /**
   * CinetPay ne signe pas ses webhooks avec un HMAC standard : la pratique
   * recommandée est de rappeler leur endpoint de vérification côté serveur
   * avec le transaction_id reçu, plutôt que de faire confiance au payload
   * entrant tel quel. On ne met JAMAIS à jour une transaction sur la seule
   * foi du webhook sans cette contre-vérification.
   */
  async verifyTransaction(transactionId: string) {
    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: this.config.get<string>('CINETPAY_API_KEY'),
        site_id: this.config.get<string>('CINETPAY_SITE_ID'),
        transaction_id: transactionId,
      }),
    });
    return response.json();
  }

  /** Utilitaire conservé si CinetPay ajoute une signature HMAC sur un compte donné */
  verifyHmacSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get<string>('CINETPAY_SECRET_KEY') ?? '';
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return expected === signature;
  }
}
