import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FinanceService } from '../finance/finance.service';
import { WalletsService } from '../wallets/wallets.service';
import { CinetPayService } from './cinetpay.service';
import { MaishaPayMobileOperator, MaishaPayService } from './maishapay.service';
import { StripeService } from './stripe.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

const OPERATOR_LABELS: Record<string, string> = {
  MOBILE_MONEY_MPESA: 'M-Pesa Vodacom',
  MOBILE_MONEY_AIRTEL: 'Airtel Money',
  MOBILE_MONEY_ORANGE: 'Orange Money',
  MOBILE_MONEY_MTN: 'MTN MoMo',
  CARD_STRIPE: 'Carte Visa / Mastercard',
  CASH_ON_DELIVERY: 'Espèces à la livraison',
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cinetpay: CinetPayService,
    private readonly maishapay: MaishaPayService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly finance: FinanceService,
    @Inject(forwardRef(() => WalletsService))
    private readonly wallets: WalletsService,
  ) {}

  async initiatePayment(user: AuthenticatedUser, dto: InitiatePaymentDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.customerId !== user.id) {
      throw new ForbiddenException("Cette commande ne vous appartient pas");
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Cette commande a déjà été payée ou annulée');
    }

    const baseTotal = Number(order.total);
    const isCash = dto.methodCode === 'CASH_ON_DELIVERY';
    const pricing = await this.finance.getPlatformPricing();
    const transactionFeePercent = isCash ? 0 : Number(pricing.paymentTransactionFeePercent ?? 3.5);
    const transactionFeeAmount = isCash
      ? 0
      : Number((baseTotal * (transactionFeePercent / 100)).toFixed(2));
    const chargedTotal = Number((baseTotal + transactionFeeAmount).toFixed(2));

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        methodCode: dto.methodCode,
        amount: chargedTotal,
        currency: order.currency,
        status: 'INITIATED',
      },
    });

    // --- Paiement à la livraison : pas de flux financier immédiat ---
    if (isCash) {
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: 'PENDING' },
        }),
        this.prisma.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } }),
        this.prisma.orderSubOrder.updateMany({
          where: { orderId: order.id },
          data: { status: 'PROCESSING' },
        }),
        this.prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'PENDING_PAYMENT',
            toStatus: 'PROCESSING',
            changedByUserId: user.id,
            note: 'Commande confirmée en paiement à la livraison',
          },
        }),
      ]);

      return {
        method: 'cash_on_delivery',
        operator: 'CASH_ON_DELIVERY',
        operatorLabel: OPERATOR_LABELS.CASH_ON_DELIVERY,
        baseTotal,
        transactionFeePercent: 0,
        transactionFeeAmount: 0,
        chargedTotal: baseTotal,
        message: 'Commande confirmée, paiement à la livraison',
      };
    }

    const appUrl = this.config.get<string>('APP_URL') ?? '';
    const operatorLabel = OPERATOR_LABELS[dto.methodCode] || 'Mobile Money';

    // --- Mobile Money (M-Pesa Vodacom, Airtel Money, Orange Money, MTN MoMo) ---
    if (
      dto.methodCode === 'MOBILE_MONEY_ORANGE' ||
      dto.methodCode === 'MOBILE_MONEY_AIRTEL' ||
      dto.methodCode === 'MOBILE_MONEY_MPESA' ||
      dto.methodCode === 'MOBILE_MONEY_MTN'
    ) {
      if (!dto.phoneNumber) {
        throw new BadRequestException('Le numéro de téléphone Mobile Money est requis');
      }

      const usePrimaryGateway = Boolean(
        this.config.get<string>('MAISHAPAY_API_KEY') ||
          this.config.get<string>('MAISHAPAY_BEARER_TOKEN'),
      );
      const useCinetPayOnly = !usePrimaryGateway && Boolean(this.config.get<string>('CINETPAY_API_KEY'));

      if (!useCinetPayOnly) {
        const provider: MaishaPayMobileOperator =
          dto.methodCode === 'MOBILE_MONEY_AIRTEL'
            ? 'AIRTEL'
            : dto.methodCode === 'MOBILE_MONEY_ORANGE'
            ? 'ORANGE'
            : dto.methodCode === 'MOBILE_MONEY_MTN'
            ? 'MTN'
            : 'MPESA';

        const mpRes = await this.maishapay.initiateMobileMoneyPayment({
          transactionReference: transaction.id,
          amount: chargedTotal,
          currency: order.currency as 'USD' | 'CDF',
          provider,
          customerPhone: dto.phoneNumber,
          customerName: user.email || 'Client ZandoGo',
          customerEmail: user.email || 'client@zandogo.cd',
          description: `Commande ZandoGo ${order.orderNumber} (Total ${chargedTotal} ${order.currency})`,
          callbackUrl: `${appUrl}/api/payments/callbacks/gateway`,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            operator: dto.methodCode,
            baseTotal,
            transactionFeePercent,
            transactionFeeAmount,
            chargedTotal,
          },
        });

        await this.prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'PENDING',
            providerReference: mpRes.transactionId,
            rawProviderPayload: mpRes.raw as any,
          },
        });

        return {
          method: dto.methodCode,
          operator: dto.methodCode,
          operatorLabel,
          transactionId: transaction.id,
          paymentRef: mpRes.transactionId,
          paymentStatus: mpRes.paymentStatus,
          ussdCode: mpRes.ussdCode,
          expiresAt: mpRes.expiresAt,
          paymentUrl: mpRes.paymentPageUrl,
          baseTotal,
          transactionFeePercent,
          transactionFeeAmount,
          chargedTotal,
        };
      }

      const result = await this.cinetpay.initiatePayment({
        transactionId: transaction.id,
        amount: chargedTotal,
        currency: order.currency as 'USD' | 'CDF',
        description: `Commande ${order.orderNumber}`,
        customerPhone: dto.phoneNumber,
        returnUrl: `${appUrl}/orders/${order.id}`,
        notifyUrl: `${appUrl}/api/payments/webhooks/cinetpay`,
      });

      const paymentRef = result.data?.payment_token || `ZG-PAY-${transaction.id.slice(-10)}`;
      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PENDING',
          providerReference: paymentRef,
          rawProviderPayload: result as any,
        },
      });

      return {
        method: dto.methodCode,
        operator: dto.methodCode,
        operatorLabel,
        transactionId: transaction.id,
        paymentRef,
        paymentStatus: 'PENDING',
        paymentUrl: result.data?.payment_url,
        baseTotal,
        transactionFeePercent,
        transactionFeeAmount,
        chargedTotal,
      };
    }

    // --- Carte bancaire Visa / Mastercard ---
    if (dto.methodCode === 'CARD_STRIPE') {
      const usePrimaryGateway = Boolean(
        this.config.get<string>('MAISHAPAY_API_KEY') ||
          this.config.get<string>('MAISHAPAY_BEARER_TOKEN') ||
          !this.config.get<string>('STRIPE_SECRET_KEY'),
      );

      if (usePrimaryGateway) {
        const cardRes = await this.maishapay.initiateCardPayment({
          transactionReference: transaction.id,
          amount: chargedTotal,
          currency: order.currency as 'USD' | 'CDF',
          customerName: user.email || 'Client ZandoGo',
          customerEmail: user.email || 'client@zandogo.cd',
          customerPhone: dto.phoneNumber,
          customerCity: 'Goma',
          cardProvider: 'VISA',
          callbackUrl: `${appUrl}/api/payments/callbacks/card`,
        });

        await this.prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'PENDING',
            providerReference: cardRes.transactionId,
            rawProviderPayload: cardRes.raw as any,
          },
        });

        return {
          method: 'CARD_STRIPE',
          operator: 'CARD_STRIPE',
          operatorLabel,
          transactionId: transaction.id,
          paymentRef: cardRes.transactionId,
          paymentStatus: cardRes.paymentStatus,
          paymentUrl: cardRes.paymentPageUrl,
          baseTotal,
          transactionFeePercent,
          transactionFeeAmount,
          chargedTotal,
        };
      }

      const intent = await this.stripe.createPaymentIntent({
        amount: chargedTotal,
        currency: 'usd',
        orderId: order.id,
      });

      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'PENDING', providerReference: intent.id },
      });

      return {
        method: 'CARD_STRIPE',
        operator: 'CARD_STRIPE',
        operatorLabel,
        transactionId: transaction.id,
        clientSecret: intent.client_secret,
        baseTotal,
        transactionFeePercent,
        transactionFeeAmount,
        chargedTotal,
      };
    }

    throw new BadRequestException('Moyen de paiement non pris en charge');
  }

  /**
   * Webhook C2B / B2C unifié (vérification HMAC-SHA256 + contre-vérification serveur).
   */
  async handleGatewayWebhook(
    rawBody: Buffer | string | undefined,
    signatureHeader: string | undefined,
    payload: Record<string, any>,
  ) {
    if (rawBody !== undefined) {
      const validSig = this.maishapay.verifyWebhookSignature(rawBody, signatureHeader);
      if (!validSig) {
        this.logger.warn('Signature webhook invalide détectée');
        throw new UnauthorizedException('Signature invalide');
      }
    }

    const eventType = String(payload?.type || '').toLowerCase();
    const data = (payload?.data as Record<string, any>) || payload;
    const providerTxId = String(
      data?.transaction_id || data?.transactionId || data?.operatorRefId || '',
    );
    const merchantRef = String(
      data?.reference || data?.transactionRefId || data?.originatingTransactionId || '',
    );

    // --- Événements B2C (décaissement vendeurs / livreurs) ---
    if (eventType.startsWith('b2c.transfer.')) {
      if (merchantRef) {
        const existingPayout = await this.prisma.payoutRequest.findUnique({
          where: { id: merchantRef },
          include: { wallet: true },
        });
        if (existingPayout && existingPayout.status !== 'PAID' && existingPayout.status !== 'REJECTED') {
          const isPaid = eventType === 'b2c.transfer.success';
          await this.prisma.$transaction(async (tx) => {
            await tx.payoutRequest.update({
              where: { id: existingPayout.id },
              data: {
                status: isPaid ? 'PAID' : 'REJECTED',
                processedAt: new Date(),
              },
            });
            if (!isPaid) {
              const amount = Number(existingPayout.amount);
              const nextBalance = Number(existingPayout.wallet.balance) + amount;
              await tx.wallet.update({
                where: { id: existingPayout.walletId },
                data: { balance: nextBalance },
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: existingPayout.walletId,
                  type: 'CREDIT',
                  amount,
                  currency: existingPayout.wallet.currency,
                  referenceType: 'REFUND',
                  referenceId: existingPayout.id,
                  status: 'AVAILABLE',
                  balanceAfter: nextBalance,
                },
              });
            }
          });
        }
      }
      return { received: true };
    }

    // --- Événements C2B (collecte commandes) ---
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          ...(merchantRef ? [{ id: merchantRef }] : []),
          ...(providerTxId ? [{ providerReference: providerTxId }] : []),
        ],
      },
    });

    if (!transaction) {
      this.logger.warn(`Webhook paiement : transaction introuvable (ref=${merchantRef}, tx=${providerTxId})`);
      return { received: true };
    }

    const rawStatus = String(data?.payment_status || payload?.status || '').toUpperCase();
    const isSuccessEvent = eventType === 'transaction.success' || rawStatus === 'SUCCESS';
    const isFailEvent =
      eventType === 'transaction.failed' ||
      eventType === 'transaction.cancelled' ||
      rawStatus === 'FAILED' ||
      rawStatus === 'CANCELLED' ||
      rawStatus === 'EXPIRED';

    if (isSuccessEvent) {
      // Contre-vérification systématique auprès de /transaction/rest/v2/check si clés actives
      const checkId = providerTxId || transaction.providerReference || transaction.id;
      const check = await this.maishapay.checkTransactionStatus(checkId, !providerTxId);
      if (!check.verified || check.paymentStatus === 'SUCCESS') {
        await this.markPaymentSuccess(transaction.id, { webhook: payload, check: check.raw });
      }
    } else if (isFailEvent) {
      await this.markPaymentFailed(transaction.id, payload);
    }

    return { received: true };
  }

  /**
   * Callback GET après redirection carte 3DS (?status=200&description=APPROVED&transactionRefId=...&operatorRefId=...)
   */
  async handleCardRedirectCallback(query: {
    status?: string;
    description?: string;
    transactionRefId?: string;
    operatorRefId?: string;
  }) {
    const refId = query.transactionRefId;
    const opId = query.operatorRefId;
    if (!refId && !opId) {
      throw new BadRequestException('Référence de transaction manquante');
    }

    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          ...(refId ? [{ id: refId }] : []),
          ...(opId ? [{ providerReference: opId }] : []),
        ],
      },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction introuvable');
    }

    const statusCode = Number(query.status || 0);
    const desc = String(query.description || '').toUpperCase();

    if (statusCode === 200 && desc === 'APPROVED') {
      const check = await this.maishapay.checkTransactionStatus(opId || transaction.id, !opId);
      if (!check.verified || check.paymentStatus === 'SUCCESS') {
        await this.markPaymentSuccess(transaction.id, { callbackQuery: query, check: check.raw });
      }
      return {
        status: 'SUCCESS',
        paymentStatus: 'SUCCESS',
        orderId: transaction.orderId,
        paymentRef: opId || transaction.providerReference,
        operator: transaction.methodCode,
        operatorLabel: OPERATOR_LABELS[transaction.methodCode] || 'Carte Visa / Mastercard',
      };
    }

    await this.markPaymentFailed(transaction.id, { callbackQuery: query });
    return {
      status: desc === 'CANCELED' ? 'CANCELLED' : 'FAILED',
      paymentStatus: desc === 'CANCELED' ? 'CANCELLED' : 'FAILED',
      orderId: transaction.orderId,
      paymentRef: opId || transaction.providerReference,
      operator: transaction.methodCode,
      operatorLabel: OPERATOR_LABELS[transaction.methodCode] || 'Carte Visa / Mastercard',
    };
  }

  /**
   * Vérification de statut authentifiée (pollable par l'utilisateur ou l'admin).
   */
  async checkPaymentStatus(user: AuthenticatedUser, idOrOrderId: string) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ id: idOrOrderId }, { orderId: idOrOrderId }, { providerReference: idOrOrderId }],
      },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!transaction) throw new NotFoundException('Transaction introuvable');
    if (transaction.order.customerId !== user.id) {
      throw new ForbiddenException("Cette transaction ne vous appartient pas");
    }

    if (transaction.status === 'PENDING' || transaction.status === 'INITIATED') {
      const checkId = transaction.providerReference || transaction.id;
      const liveCheck = await this.maishapay.checkTransactionStatus(
        checkId,
        !transaction.providerReference,
      );
      if (liveCheck.verified && liveCheck.paymentStatus === 'SUCCESS') {
        await this.markPaymentSuccess(transaction.id, liveCheck.raw);
      } else if (
        liveCheck.verified &&
        (liveCheck.paymentStatus === 'FAILED' ||
          liveCheck.paymentStatus === 'CANCELLED' ||
          liveCheck.paymentStatus === 'EXPIRED')
      ) {
        await this.markPaymentFailed(transaction.id, liveCheck.raw);
      }
    }

    const updated = await this.prisma.paymentTransaction.findUnique({ where: { id: transaction.id } });
    return {
      transactionId: transaction.id,
      orderId: transaction.orderId,
      status: updated?.status || transaction.status,
      paymentStatus: updated?.status || transaction.status,
      operator: transaction.methodCode,
      operatorLabel: OPERATOR_LABELS[transaction.methodCode] || 'Mobile Money',
      paymentRef: transaction.providerReference,
      confirmedAt: updated?.confirmedAt,
    };
  }

  /**
   * Contre-vérification de secours CinetPay.
   */
  async handleCinetPayWebhook(payload: { cpm_trans_id?: string; transaction_id?: string }) {
    const transactionId = payload.cpm_trans_id ?? payload.transaction_id;
    if (!transactionId) {
      this.logger.warn('Webhook de secours reçu sans transaction_id');
      return { received: true };
    }

    const verification = await this.cinetpay.verifyTransaction(transactionId);

    if (verification.code === '00' || verification.data?.status === 'ACCEPTED') {
      await this.markPaymentSuccess(transactionId, verification);
    } else {
      await this.markPaymentFailed(transactionId, verification);
    }

    return { received: true };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const event = this.stripe.constructWebhookEvent(rawBody, signature);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as { id: string };
      const transaction = await this.prisma.paymentTransaction.findFirst({
        where: { providerReference: intent.id },
      });
      if (transaction) await this.markPaymentSuccess(transaction.id, event.data.object);
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as { id: string };
      const transaction = await this.prisma.paymentTransaction.findFirst({
        where: { providerReference: intent.id },
      });
      if (transaction) await this.markPaymentFailed(transaction.id, event.data.object);
    }

    return { received: true };
  }

  private async markPaymentSuccess(transactionId: string, rawPayload: unknown) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction || transaction.status === 'SUCCESS') return;

    const confirmedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'SUCCESS', confirmedAt, rawProviderPayload: rawPayload as any },
      }),
      this.prisma.order.update({ where: { id: transaction.orderId }, data: { status: 'PAID' } }),
      this.prisma.orderSubOrder.updateMany({
        where: { orderId: transaction.orderId },
        data: { status: 'PROCESSING' },
      }),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: transaction.orderId,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'PAID',
          note: `Paiement confirmé via ${OPERATOR_LABELS[transaction.methodCode] || transaction.methodCode} — délai 48h démarré`,
        },
      }),
    ]);

    // Le délai de 48 heures commence dès la confirmation du paiement
    await this.wallets.creditOrderFundsOnPayment(transaction.orderId, confirmedAt).catch((err) => {
      this.logger.warn(`Crédit wallet différé (${transaction.orderId}) : ${String(err)}`);
    });

    await this.audit.log({
      action: 'payment.success',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      afterState: { orderId: transaction.orderId, amount: transaction.amount },
    });
  }

  private async markPaymentFailed(transactionId: string, rawPayload: unknown) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: {
        order: { include: { subOrders: { include: { items: true } } } },
      },
    });
    if (!transaction || transaction.status === 'FAILED') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED', rawProviderPayload: rawPayload as any },
      });

      await tx.order.update({ where: { id: transaction.orderId }, data: { status: 'CANCELLED' } });

      for (const subOrder of transaction.order.subOrders) {
        await tx.orderSubOrder.update({ where: { id: subOrder.id }, data: { status: 'CANCELLED' } });
        for (const item of subOrder.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: transaction.orderId,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'CANCELLED',
          note: `Échec du paiement via ${OPERATOR_LABELS[transaction.methodCode] || transaction.methodCode} — stock restauré`,
        },
      });
    });

    await this.audit.log({
      action: 'payment.failed',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      afterState: { orderId: transaction.orderId },
    });
  }

  async confirmCashOnDelivery(orderId: string, lat: number, lng: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        orderId,
        methodCode: 'CASH_ON_DELIVERY',
        amount: order.total,
        currency: order.currency,
        status: 'SUCCESS',
        confirmedAt: new Date(),
        rawProviderPayload: { collectedAt: { lat, lng } },
      },
    });

    await this.audit.log({
      action: 'payment.cash_confirmed',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      afterState: { orderId, lat, lng },
    });

    return transaction;
  }
}
