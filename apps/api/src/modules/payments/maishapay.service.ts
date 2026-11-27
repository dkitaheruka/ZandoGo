import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { getPrimaryAppUrl, isSafePaymentRedirectUrl } from '../../common/security-rules';

export type MaishaPayMobileOperator =
  | 'AIRTEL'
  | 'ORANGE'
  | 'MPESA'
  | 'MTN'
  | 'VODACOM'
  | 'AFRICELL';

export type MaishaPayTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface MaishaPayInitResponse {
  status_code?: number;
  status?: string;
  transactionId?: string | number;
  originatingTransactionId?: string;
  paymentPageUrl?: string;
  ussdCode?: string;
  expiresAt?: string;
  paymentStatus?: MaishaPayTransactionStatus;
  operator?: string;
  message?: string;
  errors?: {
    details?: string;
    message?: string;
  };
  data?: {
    status_code?: number;
    transaction_id?: string | number;
    transactionId?: string | number;
    originatingTransactionId?: string;
    reference?: string;
    amount?: number | string;
    currency?: string;
    phone?: string;
    operator?: string;
    payment_status?: MaishaPayTransactionStatus;
    transactionStatus?: string;
    transactionDescription?: string;
    ussd_code?: string;
    expires_at?: string;
    paymentPage?: string;
    payment_url?: string;
    created_at?: string;
    updated_at?: string;
  };
}

export interface MaishaPayNormalizedResult {
  transactionId: string;
  reference: string;
  paymentStatus: MaishaPayTransactionStatus;
  paymentPageUrl?: string;
  ussdCode?: string;
  expiresAt?: string;
  operator?: string;
  raw: MaishaPayInitResponse;
}

export interface MaishaPayB2cResult {
  status: string;
  transactionId: string;
  reference: string;
  paymentStatus: MaishaPayTransactionStatus;
  raw: Record<string, any>;
}

const USSD_BY_OPERATOR: Record<MaishaPayMobileOperator, string> = {
  MPESA: '*150*00#',
  VODACOM: '*150*00#',
  AIRTEL: '*501#',
  ORANGE: '#144#',
  MTN: '*182#',
  AFRICELL: '*111#',
};

/**
 * Adaptateur interne confidentiel REST API v2.1 (collecte Mobile Money v2, Carte 3DS v3,
 * vérification de statut v2, décaissements B2C simple/masse et vérification HMAC-SHA256).
 * Ne jamais exposer le nom du processeur dans les réponses API publiques, SMS ou interfaces.
 */
@Injectable()
export class MaishaPayService {
  private readonly logger = new Logger(MaishaPayService.name);
  private readonly baseUrl = 'https://marchand.maishapay.online/api';
  private readonly apiVersion = '2024-01-01';

  constructor(private readonly config: ConfigService) {}

  private get gatewayModeStr(): '1' | '0' {
    return this.config.get<string>('MAISHAPAY_GATEWAY_MODE') === 'production' ? '1' : '0';
  }

  private get gatewayModeNum(): 1 | 0 {
    return this.config.get<string>('MAISHAPAY_GATEWAY_MODE') === 'production' ? 1 : 0;
  }

  private get publicKey(): string {
    return this.config.get<string>('MAISHAPAY_API_KEY') ?? '';
  }

  private get secretKey(): string {
    return this.config.get<string>('MAISHAPAY_SECRET_KEY') ?? '';
  }

  private get bearerToken(): string {
    return this.config.get<string>('MAISHAPAY_BEARER_TOKEN') || this.publicKey;
  }

  private get webhookSecret(): string {
    return this.config.get<string>('MAISHAPAY_WEBHOOK_SECRET') || this.secretKey;
  }

  get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  get isLiveConfigured(): boolean {
    return this.hasLiveCredentials;
  }

  private get hasLiveCredentials(): boolean {
    return Boolean(this.bearerToken && this.publicKey && this.secretKey);
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-MaishaPay-Version': this.apiVersion,
    };
    const bearer = this.config.get<string>('MAISHAPAY_BEARER_TOKEN') || this.publicKey;
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
    return headers;
  }

  private mapOperatorToChannelProvider(
    provider: MaishaPayMobileOperator,
  ): 'AIRTEL' | 'ORANGE' | 'MPESA' | 'MTN' | 'VODACOM' | 'AFRICELL' {
    if (provider === 'VODACOM') return 'MPESA';
    return provider;
  }

  private mapOperatorSlug(provider: string): string {
    const up = provider.toUpperCase();
    if (up.includes('AIRTEL')) return 'airtel';
    if (up.includes('ORANGE')) return 'orange';
    if (up.includes('MTN')) return 'mtn';
    if (up.includes('AFRICELL')) return 'africell';
    return 'mpesa';
  }

  /**
   * POST /collect/v2/store/mobileMoney
   * Déclenche une invite USSD sur le téléphone du client (M-Pesa Vodacom, Airtel Money, Orange Money, MTN MoMo).
   */
  async initiateMobileMoneyPayment(params: {
    transactionReference: string;
    amount: number;
    currency: 'USD' | 'CDF';
    provider: MaishaPayMobileOperator;
    customerPhone: string;
    customerName: string;
    customerEmail?: string;
    description?: string;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
  }): Promise<MaishaPayNormalizedResult> {
    const endpoint = `${this.baseUrl}/collect/v2/store/mobileMoney`;
    const normalizedPhone = params.customerPhone.startsWith('+')
      ? params.customerPhone
      : `+243${params.customerPhone.replace(/^0+/, '')}`;
    const channelProvider = this.mapOperatorToChannelProvider(params.provider);

    const payload = {
      transactionReference: params.transactionReference,
      gatewayMode: this.gatewayModeStr,
      publicApiKey: this.publicKey,
      secretApiKey: this.secretKey,
      order: {
        amount: String(params.amount),
        currency: params.currency,
        customerFullName: params.customerName || 'Client ZandoGo',
        customerEmailAdress: params.customerEmail || 'client@zandogo.cd',
      },
      paymentChannel: {
        channel: 'MOBILEMONEY',
        provider: channelProvider,
        walletID: normalizedPhone,
        callbackUrl: params.callbackUrl,
      },
      ...(params.description ? { description: params.description } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    };

    const defaultUssd = USSD_BY_OPERATOR[params.provider] || '*150*00#';
    const defaultExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    if (!this.hasLiveCredentials) {
      const refId = `ZG-PAY-${params.transactionReference.slice(-10)}`;
      return {
        transactionId: refId,
        reference: params.transactionReference,
        paymentStatus: 'PENDING',
        ussdCode: defaultUssd,
        expiresAt: defaultExpires,
        operator: this.mapOperatorSlug(channelProvider),
        raw: {
          status: 'success',
          status_code: 201,
          transactionId: refId,
          ussdCode: defaultUssd,
          expiresAt: defaultExpires,
          message: `Invite de confirmation envoyée vers ${channelProvider}`,
        },
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });
      const raw = (await response.json().catch(() => ({}))) as MaishaPayInitResponse;
      if (!response.ok) {
        const providerMessage =
          raw.errors?.message ||
          raw.message ||
          `MaishaPay a rejeté la demande (HTTP ${response.status}).`;
        this.logger.warn(`MaishaPay Mobile Money HTTP ${response.status}: ${providerMessage}`);
        throw new BadGatewayException(providerMessage);
      }

      const d = raw.data;
      const txId =
        (d?.transaction_id !== undefined ? String(d.transaction_id) : undefined) ||
        (d?.transactionId !== undefined ? String(d.transactionId) : undefined) ||
        (raw.transactionId !== undefined ? String(raw.transactionId) : undefined) ||
        `ZG-PAY-${params.transactionReference.slice(-10)}`;

      const rawRedirect = d?.paymentPage || d?.payment_url || raw.paymentPageUrl;
      return {
        transactionId: txId,
        reference: d?.reference || params.transactionReference,
        paymentStatus: d?.payment_status || raw.paymentStatus || 'PENDING',
        paymentPageUrl: isSafePaymentRedirectUrl(rawRedirect, this.isProduction)
          ? rawRedirect
          : undefined,
        ussdCode: d?.ussd_code || raw.ussdCode || defaultUssd,
        expiresAt: d?.expires_at || raw.expiresAt || defaultExpires,
        operator: d?.operator || this.mapOperatorSlug(channelProvider),
        raw,
      };
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      this.logger.warn(`Passerelle Mobile Money indisponible : ${String(err)}`);
      const fallbackId = `ZG-PAY-${params.transactionReference.slice(-10)}`;
      return {
        transactionId: fallbackId,
        reference: params.transactionReference,
        paymentStatus: 'PENDING',
        ussdCode: defaultUssd,
        expiresAt: defaultExpires,
        operator: this.mapOperatorSlug(channelProvider),
        raw: {
          status_code: 202,
          status: 'PENDING',
          transactionId: fallbackId,
          ussdCode: defaultUssd,
          expiresAt: defaultExpires,
          message: `Requête transmise à l'opérateur ${channelProvider}`,
        },
      };
    }
  }

  /**
   * POST /collect/v3/store/card
   * Crée une session de paiement 3DS hébergée pour cartes Visa, Mastercard ou American Express.
   */
  async initiateCardPayment(params: {
    transactionReference: string;
    amount: number;
    currency: 'USD' | 'CDF';
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerAddress?: string;
    customerCity?: string;
    cardProvider?: 'VISA' | 'MASTERCARD' | 'AMERICAN EXPRESS';
    callbackUrl: string;
  }): Promise<MaishaPayNormalizedResult> {
    const endpoint = `${this.baseUrl}/collect/v3/store/card`;
    const parts = (params.customerName || 'Client ZandoGo').trim().split(/\s+/);
    const customerFirstname = parts[0] || 'Client';
    const customerLastname = parts.slice(1).join(' ') || 'ZandoGo';
    const cardCurrency = params.currency === 'CDF' ? 'USD' : params.currency;

    const payload = {
      transactionReference: params.transactionReference,
      gatewayMode: this.gatewayModeStr,
      publicApiKey: this.publicKey,
      secretApiKey: this.secretKey,
      order: {
        amount: String(params.amount),
        currency: cardCurrency,
        customerFirstname,
        customerLastname,
        customerAddress: params.customerAddress || 'Boulevard Kanyamuhanga, Goma',
        customerCity: params.customerCity || 'Goma',
        customerPhoneNumber: params.customerPhone || '+243970000000',
        customerEmailAdress: params.customerEmail || 'client@zandogo.cd',
      },
      paymentChannel: {
        channel: 'CARD',
        provider: params.cardProvider || 'VISA',
        callbackUrl: params.callbackUrl,
      },
    };

    if (!this.hasLiveCredentials) {
      const refId = `ZG-CARD-${params.transactionReference.slice(-10)}`;
      return {
        transactionId: refId,
        reference: params.transactionReference,
        paymentStatus: 'PENDING',
        operator: 'card',
        raw: {
          status_code: 202,
          status: 'PENDING',
          transactionId: refId,
          message: 'Session carte Visa / Mastercard initiée',
        },
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });
      const raw = (await response.json()) as MaishaPayInitResponse;
      const d = raw.data;
      const txId =
        (d?.transactionId !== undefined ? String(d.transactionId) : undefined) ||
        (d?.transaction_id !== undefined ? String(d.transaction_id) : undefined) ||
        (raw.transactionId !== undefined ? String(raw.transactionId) : undefined) ||
        `ZG-CARD-${params.transactionReference.slice(-10)}`;

      const rawRedirect = d?.paymentPage || d?.payment_url || raw.paymentPageUrl;
      return {
        transactionId: txId,
        reference: d?.originatingTransactionId || params.transactionReference,
        paymentStatus:
          (d?.transactionStatus?.toUpperCase() as MaishaPayTransactionStatus) || 'PENDING',
        paymentPageUrl: isSafePaymentRedirectUrl(rawRedirect, this.isProduction)
          ? rawRedirect
          : undefined,
        operator: 'card',
        raw,
      };
    } catch (err) {
      this.logger.warn(`Passerelle carte indisponible : ${String(err)}`);
      const fallbackId = `ZG-CARD-${params.transactionReference.slice(-10)}`;
      return {
        transactionId: fallbackId,
        reference: params.transactionReference,
        paymentStatus: 'PENDING',
        operator: 'card',
        raw: {
          status_code: 202,
          status: 'PENDING',
          transactionId: fallbackId,
          message: 'Session carte Visa / Mastercard initiée',
        },
      };
    }
  }

  /**
   * GET/POST /transaction/rest/v2/check (?useRef=1)
   * Contre-vérifie le statut réel d'une transaction auprès du serveur de paiement.
   */
  async checkTransactionStatus(
    transactionId: string,
    useRef = false,
  ): Promise<{
    verified: boolean;
    paymentStatus: MaishaPayTransactionStatus;
    operatorReference?: string;
    raw: Record<string, any>;
  }> {
    if (!this.hasLiveCredentials) {
      return {
        verified: false,
        paymentStatus: 'PENDING',
        raw: { skipped: true },
      };
    }

    const endpoint = `${this.baseUrl}/transaction/rest/v2/check${useRef ? '?useRef=1' : ''}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          gatewayMode: this.gatewayModeNum,
          publicApiKey: this.publicKey,
          secretApiKey: this.secretKey,
          transactionId,
        }),
      });
      const raw = (await response.json()) as Record<string, any>;
      const statusRaw = String(
        raw?.data?.payment_status ||
          raw?.data?.transactionStatus ||
          raw?.payment_status ||
          raw?.transactionStatus ||
          raw?.status ||
          'PENDING',
      ).toUpperCase();

      let paymentStatus: MaishaPayTransactionStatus = 'PENDING';
      if (
        statusRaw === 'SUCCESS' ||
        statusRaw === 'APPROVED' ||
        statusRaw === 'COMPLETED' ||
        statusRaw === 'ACCEPTED'
      ) {
        paymentStatus = 'SUCCESS';
      } else if (statusRaw === 'FAILED' || statusRaw === 'DECLINED') {
        paymentStatus = 'FAILED';
      } else if (statusRaw === 'CANCELLED' || statusRaw === 'CANCELED') {
        paymentStatus = 'CANCELLED';
      } else if (statusRaw === 'EXPIRED') {
        paymentStatus = 'EXPIRED';
      } else if (statusRaw === 'PROCESSING') {
        paymentStatus = 'PROCESSING';
      }

      return {
        verified: response.ok,
        paymentStatus,
        operatorReference: raw?.data?.operator_reference || raw?.operator_reference,
        raw,
      };
    } catch (err) {
      this.logger.warn(`Vérification statut transaction échouée : ${String(err)}`);
      return {
        verified: false,
        paymentStatus: 'PENDING',
        raw: { error: String(err) },
      };
    }
  }

  /**
   * POST /b2c/transfer
   * Décaissement vers un wallet Mobile Money (retrait vendeur, commission livreur, remboursement).
   */
  async initiateB2cTransfer(params: {
    amount: number;
    currency: 'USD' | 'CDF';
    recipientPhone: string;
    operator: string;
    reference: string;
    description: string;
    callbackUrl: string;
  }): Promise<MaishaPayB2cResult> {
    const endpoint = `${this.baseUrl}/b2c/transfer`;
    const normalizedPhone = params.recipientPhone.startsWith('+')
      ? params.recipientPhone
      : `+243${params.recipientPhone.replace(/^0+/, '')}`;
    const op = this.mapOperatorSlug(params.operator);

    if (!this.hasLiveCredentials) {
      return {
        status: 'success',
        transactionId: `ZG-B2C-${params.reference.slice(-8)}`,
        reference: params.reference,
        paymentStatus: 'PROCESSING',
        raw: { simulated: true, operator: op, phone: normalizedPhone },
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          recipient_phone: normalizedPhone,
          operator: op,
          reference: params.reference,
          description: params.description,
          callback_url: params.callbackUrl,
        }),
      });
      const raw = (await response.json()) as Record<string, any>;
      return {
        status: raw?.status || 'success',
        transactionId:
          raw?.data?.transaction_id || raw?.transaction_id || `ZG-B2C-${params.reference.slice(-8)}`,
        reference: params.reference,
        paymentStatus: (raw?.data?.payment_status as MaishaPayTransactionStatus) || 'PROCESSING',
        raw,
      };
    } catch (err) {
      this.logger.warn(`Transfert B2C indisponible : ${String(err)}`);
      return {
        status: 'pending',
        transactionId: `ZG-B2C-${params.reference.slice(-8)}`,
        reference: params.reference,
        paymentStatus: 'PENDING',
        raw: { error: String(err) },
      };
    }
  }

  /**
   * POST /b2c/bulk-transfer
   * Décaissement en masse (jusqu'à 1000 bénéficiaires).
   */
  async initiateBulkB2cTransfer(params: {
    batchReference: string;
    currency: 'USD' | 'CDF';
    callbackUrl: string;
    recipients: Array<{
      phone: string;
      operator: string;
      amount: number;
      reference: string;
      name: string;
    }>;
  }): Promise<Record<string, any>> {
    const endpoint = `${this.baseUrl}/b2c/bulk-transfer`;
    const payload = {
      batch_reference: params.batchReference,
      currency: params.currency,
      callback_url: params.callbackUrl,
      recipients: params.recipients.map((r) => ({
        phone: r.phone.startsWith('+') ? r.phone : `+243${r.phone.replace(/^0+/, '')}`,
        operator: this.mapOperatorSlug(r.operator),
        amount: r.amount,
        reference: r.reference,
        name: r.name,
      })),
    };

    if (!this.hasLiveCredentials) {
      return {
        status: 'accepted',
        batch_id: `ZG-BATCH-${params.batchReference.slice(-8)}`,
        count: payload.recipients.length,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
    return (await response.json()) as Record<string, any>;
  }

  /**
   * Vérifie la signature HMAC-SHA256 de l'en-tête X-MaishaPay-Signature (`sha256=<hex>`).
   * En production ou lorsque des clés live sont actives, l'absence de secret webhook échoue fermé (false).
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.webhookSecret) {
      if (this.isProduction || this.hasLiveCredentials) {
        return false;
      }
      return true;
    }
    if (!signatureHeader) {
      return false;
    }
    const expectedHex = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const normalizedSig = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7).trim()
      : signatureHeader.trim();

    if (!/^[a-fA-F0-9]{64}$/.test(normalizedSig)) {
      return false;
    }

    const a = Buffer.from(expectedHex.toLowerCase(), 'utf8');
    const b = Buffer.from(normalizedSig.toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Wrapper générique utilisé par le module vendeurs (achat boutique, modules, pub, certification).
   */
  async initiatePayment(params: {
    orderId: string;
    amount: number;
    currency: 'USD' | 'CDF';
    methodCode: string;
    customerPhone?: string;
    customerName?: string;
    customerEmail?: string;
    description?: string;
  }): Promise<{ providerReference: string; paymentPageUrl?: string; ussdCode?: string; expiresAt?: string }> {
    const appUrl = getPrimaryAppUrl(this.config.get<string>('APP_URL'));
    const code = (params.methodCode || '').toUpperCase();

    if (code === 'CARD' || code === 'CARD_STRIPE' || code === 'VISA' || code === 'MASTERCARD') {
      const res = await this.initiateCardPayment({
        transactionReference: params.orderId,
        amount: params.amount,
        currency: params.currency,
        customerName: params.customerName || 'Vendeur ZandoGo',
        customerEmail: params.customerEmail || 'vendeur@zandogo.cd',
        customerPhone: params.customerPhone,
        callbackUrl: `${appUrl}/api/payments/callbacks/card`,
      });
      return {
        providerReference: res.transactionId,
        paymentPageUrl: res.paymentPageUrl,
      };
    }

    const provider: MaishaPayMobileOperator = code.includes('AIRTEL')
      ? 'AIRTEL'
      : code.includes('ORANGE')
      ? 'ORANGE'
      : code.includes('MTN')
      ? 'MTN'
      : 'MPESA';

    const res = await this.initiateMobileMoneyPayment({
      transactionReference: params.orderId,
      amount: params.amount,
      currency: params.currency,
      provider,
      customerPhone: params.customerPhone || '+243970000000',
      customerName: params.customerName || 'Marchand ZandoGo',
      description: params.description,
      callbackUrl: `${appUrl}/api/payments/callbacks/gateway`,
    });

    return {
      providerReference: res.transactionId,
      paymentPageUrl: res.paymentPageUrl,
      ussdCode: res.ussdCode,
      expiresAt: res.expiresAt,
    };
  }
}
