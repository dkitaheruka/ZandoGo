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
import { AssistantService } from '../assistant/assistant.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FinanceService } from '../finance/finance.service';
import { AfricasTalkingSmsService } from '../realtime/africastalking-sms.service';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { WalletsService } from '../wallets/wallets.service';
import { MaishaPayMobileOperator, MaishaPayService } from './maishapay.service';
import { StripeService } from './stripe.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { shouldConfirmGatewayPayment } from '../../common/security-rules';

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
    private readonly maishapay: MaishaPayService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
    private readonly finance: FinanceService,
    private readonly assistant: AssistantService,
    private readonly notifications: NotificationsGateway,
    private readonly sms: AfricasTalkingSmsService,
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
          data: { status: 'PENDING', providerReference: `COD-${order.orderNumber}` },
        }),
        this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'PROCESSING',
            paymentMethodCode: 'CASH_ON_DELIVERY',
            paymentRef: `COD-${order.orderNumber}`,
            transactionFeePercent: 0,
            chargedTotal: baseTotal,
          },
        }),
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

      const amountLabel = `${baseTotal.toFixed(2)} ${order.currency}`;
      const cashFallback = `Merci pour votre commande ${order.orderNumber} (${amountLabel}) ! Le règlement se fera en espèces à la livraison.`;
      const cashMsg = await this.assistant.composeContextualMessage({
        scenario: 'ORDER_CASH_CONFIRMED',
        channel: 'inapp',
        recipientRole: 'CLIENT',
        facts: {
          orderNumber: order.orderNumber,
          amountLabel,
          paymentMethod: 'Espèces à la livraison',
        },
        requiredTokens: [order.orderNumber, amountLabel],
        fallbackText: cashFallback,
      });
      await this.notifications
        .notifyUser({
          userId: user.id,
          type: 'order.cash_confirmed',
          title: `Commande ${order.orderNumber} enregistrée`,
          body: cashMsg.text,
          data: { orderId: order.id, orderNumber: order.orderNumber },
        })
        .catch(() => {});

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

    // --- Mobile Money RDC (M-Pesa Vodacom, Airtel Money, Orange Money, MTN MoMo) via MaishaPay ---
    if (
      dto.methodCode === 'MOBILE_MONEY_ORANGE' ||
      dto.methodCode === 'MOBILE_MONEY_AIRTEL' ||
      dto.methodCode === 'MOBILE_MONEY_MPESA' ||
      dto.methodCode === 'MOBILE_MONEY_MTN'
    ) {
      if (!dto.phoneNumber) {
        throw new BadRequestException('Le numéro de téléphone Mobile Money est requis');
      }

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

      const isSandboxLocal = !this.maishapay.isProduction && !this.maishapay.isLiveConfigured;
      if (isSandboxLocal) {
        await this.markPaymentSuccess(transaction.id, { sandboxAutoConfirm: true, raw: mpRes.raw });
      }

      return {
        method: dto.methodCode,
        operator: dto.methodCode,
        paymentOperator: dto.methodCode,
        operatorLabel,
        status: isSandboxLocal ? 'SUCCESS' : 'PENDING',
        transactionId: transaction.id,
        paymentRef: mpRes.transactionId,
        paymentStatus: isSandboxLocal ? 'SUCCESS' : mpRes.paymentStatus,
        ussdCode: mpRes.ussdCode,
        expiresAt: mpRes.expiresAt,
        paymentUrl: isSandboxLocal ? undefined : mpRes.paymentPageUrl,
        smsRecipient: dto.phoneNumber,
        baseTotal,
        transactionFeePercent,
        transactionFeeAmount,
        chargedTotal,
      };
    }

    // --- Carte bancaire Visa / Mastercard (Stripe en priorité si configuré, sinon MaishaPay 3DS) ---
    if (dto.methodCode === 'CARD_STRIPE') {
      if (this.stripe.isConfigured()) {
        const intent = await this.stripe.createPaymentIntent({
          amount: chargedTotal,
          currency: (order.currency || 'USD').toLowerCase(),
          orderId: order.id,
          orderNumber: order.orderNumber,
          transactionId: transaction.id,
          customerEmail: user.email || undefined,
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
          paymentRef: intent.id,
          clientSecret: intent.client_secret,
          baseTotal,
          transactionFeePercent,
          transactionFeeAmount,
          chargedTotal,
        };
      }

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

      const isSandboxLocal = !this.maishapay.isProduction && !this.maishapay.isLiveConfigured;
      if (isSandboxLocal) {
        await this.markPaymentSuccess(transaction.id, { sandboxAutoConfirm: true, raw: cardRes.raw });
      }

      return {
        method: 'CARD_STRIPE',
        operator: 'CARD_STRIPE',
        paymentOperator: 'CARD_STRIPE',
        operatorLabel,
        status: isSandboxLocal ? 'SUCCESS' : 'PENDING',
        transactionId: transaction.id,
        paymentRef: cardRes.transactionId,
        paymentStatus: isSandboxLocal ? 'SUCCESS' : cardRes.paymentStatus,
        paymentUrl: isSandboxLocal ? undefined : cardRes.paymentPageUrl,
        smsRecipient: dto.phoneNumber,
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
    const bodyToVerify = rawBody ?? JSON.stringify(payload ?? {});
    const validSig = this.maishapay.verifyWebhookSignature(bodyToVerify, signatureHeader);
    if (!validSig) {
      this.logger.warn('Signature webhook invalide détectée');
      throw new UnauthorizedException('Signature invalide');
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
      // Contre-vérification fail-closed auprès de /transaction/rest/v2/check
      const checkId = providerTxId || transaction.providerReference || transaction.id;
      const check = await this.maishapay.checkTransactionStatus(checkId, !providerTxId);
      const confirmed = shouldConfirmGatewayPayment({
        isProduction: this.maishapay.isProduction,
        hasLiveCredentials: this.maishapay.isLiveConfigured,
        signatureVerified: validSig,
        liveCheckVerified: check.verified,
        livePaymentStatus: check.paymentStatus,
        declaredSuccess: isSuccessEvent,
      });
      if (confirmed) {
        await this.markPaymentSuccess(transaction.id, { webhook: payload, check: check.raw });
      } else {
        this.logger.warn(
          `Confirmation webhook différée (fail-closed) pour transaction=${transaction.id}`,
        );
      }
    } else if (isFailEvent) {
      await this.markPaymentFailed(transaction.id, payload);
    }

    return { received: true };
  }

  /**
   * Callback GET après redirection carte 3DS (?status=200&description=APPROVED&transactionRefId=...&operatorRefId=...)
   * Ne fait jamais confiance aux seuls paramètres d'URL en production ou avec clés live actives.
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
      const confirmed = shouldConfirmGatewayPayment({
        isProduction: this.maishapay.isProduction,
        hasLiveCredentials: this.maishapay.isLiveConfigured,
        signatureVerified: true, // redirection navigateur validée exclusivement par /check côté serveur
        liveCheckVerified: check.verified,
        livePaymentStatus: check.paymentStatus,
        declaredSuccess: true,
      });

      if (confirmed) {
        await this.markPaymentSuccess(transaction.id, { callbackQuery: query, check: check.raw });
        return {
          status: 'SUCCESS',
          paymentStatus: 'SUCCESS',
          orderId: transaction.orderId,
          paymentRef: opId || transaction.providerReference,
          operator: transaction.methodCode,
          operatorLabel: OPERATOR_LABELS[transaction.methodCode] || 'Carte Visa / Mastercard',
        };
      }

      return {
        status: 'PENDING',
        paymentStatus: 'PENDING',
        orderId: transaction.orderId,
        paymentRef: opId || transaction.providerReference,
        operator: transaction.methodCode,
        operatorLabel: OPERATOR_LABELS[transaction.methodCode] || 'Carte Visa / Mastercard',
      };
    }

    if (transaction.status === 'PENDING' || transaction.status === 'INITIATED') {
      const check = await this.maishapay.checkTransactionStatus(opId || transaction.id, !opId);
      if (
        !this.maishapay.isLiveConfigured ||
        (check.verified &&
          (check.paymentStatus === 'FAILED' ||
            check.paymentStatus === 'CANCELLED' ||
            check.paymentStatus === 'EXPIRED'))
      ) {
        await this.markPaymentFailed(transaction.id, { callbackQuery: query, check: check.raw });
      }
    }

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
      if (
        transaction.methodCode === 'CARD_STRIPE' &&
        transaction.providerReference?.startsWith('pi_') &&
        this.stripe.isConfigured()
      ) {
        const intent = await this.stripe.retrievePaymentIntent(transaction.providerReference);
        if (intent?.status === 'succeeded') {
          await this.markPaymentSuccess(transaction.id, intent);
        } else if (intent?.status === 'canceled') {
          await this.markPaymentFailed(transaction.id, intent);
        }
      } else {
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

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const event = this.stripe.constructWebhookEvent(rawBody, signature);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as {
        id: string;
        amount_received?: number;
        currency?: string;
      };
      const transaction = await this.prisma.paymentTransaction.findFirst({
        where: { providerReference: intent.id },
      });
      if (transaction) {
        const expectedMinor = Math.round(Number(transaction.amount) * 100);
        const receivedMinor = Number(intent.amount_received ?? expectedMinor);
        if (receivedMinor < expectedMinor) {
          this.logger.warn(
            `Montant Stripe reçu inférieur au total attendu (${receivedMinor} < ${expectedMinor}) pour ${transaction.id}`,
          );
          return { received: true };
        }
        await this.markPaymentSuccess(transaction.id, event.data.object);
      }
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
    const pricing = await this.finance.getPlatformPricing().catch(() => null);
    const immediatePayout = Boolean(pricing?.allowImmediateVendorWithdrawal);
    const feePercent =
      transaction.methodCode === 'CASH_ON_DELIVERY'
        ? 0
        : Number(pricing?.paymentTransactionFeePercent ?? 3.5);
    const paymentRef =
      transaction.providerReference || `ZG-REF-${transaction.id.slice(-8).toUpperCase()}`;

    const orderWithItems = await this.prisma.order.findUnique({
      where: { id: transaction.orderId },
      include: {
        subOrders: {
          include: {
            items: { include: { variant: { include: { product: { select: { productType: true } } } } } },
          },
        },
      },
    });

    const digitalSubOrderIds: string[] = [];
    const physicalSubOrderIds: string[] = [];
    for (const so of orderWithItems?.subOrders || []) {
      const onlyDigital =
        so.items.length > 0 && so.items.every((it) => it.variant.product.productType === 'DIGITAL');
      if (onlyDigital) digitalSubOrderIds.push(so.id);
      else physicalSubOrderIds.push(so.id);
    }
    const allDigital =
      (orderWithItems?.subOrders.length ?? 0) > 0 && physicalSubOrderIds.length === 0;

    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCESS',
          providerReference: paymentRef,
          confirmedAt,
          rawProviderPayload: rawPayload as any,
        },
      }),
      this.prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          status: allDigital ? 'DELIVERED' : 'PAID',
          paidAt: confirmedAt,
          paymentMethodCode: transaction.methodCode,
          paymentRef,
          transactionFeePercent: feePercent,
          chargedTotal: transaction.amount,
        },
      }),
      ...(physicalSubOrderIds.length > 0
        ? [
            this.prisma.orderSubOrder.updateMany({
              where: { id: { in: physicalSubOrderIds } },
              data: { status: 'PROCESSING' },
            }),
          ]
        : []),
      ...(digitalSubOrderIds.length > 0
        ? [
            this.prisma.orderSubOrder.updateMany({
              where: { id: { in: digitalSubOrderIds } },
              data: { status: 'DELIVERED' },
            }),
          ]
        : []),
      this.prisma.orderStatusHistory.create({
        data: {
          orderId: transaction.orderId,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: allDigital ? 'DELIVERED' : 'PAID',
          note: allDigital
            ? `Paiement confirmé via ${OPERATOR_LABELS[transaction.methodCode] || transaction.methodCode} — accès numérique instantané débloqué`
            : immediatePayout
            ? `Paiement confirmé via ${OPERATOR_LABELS[transaction.methodCode] || transaction.methodCode} — versement direct vendeur (délai 48h désactivé)`
            : `Paiement confirmé via ${OPERATOR_LABELS[transaction.methodCode] || transaction.methodCode} — délai 48h démarré`,
        },
      }),
    ]);

    // Crédit du wallet vendeur (immédiat si le Super Admin a désactivé les 48h, sinon verrouillé 48h)
    await this.wallets.creditOrderFundsOnPayment(transaction.orderId, confirmedAt).catch((err) => {
      this.logger.warn(`Crédit wallet différé (${transaction.orderId}) : ${String(err)}`);
    });

    await this.audit.log({
      action: 'payment.success',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      afterState: { orderId: transaction.orderId, amount: transaction.amount, immediatePayout },
    });

    const paidOrder = await this.prisma.order
      .findUnique({
        where: { id: transaction.orderId },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          subOrders: { include: { store: { select: { storeName: true } } } },
        },
      })
      .catch(() => null);

    if (paidOrder) {
      const operatorLabel = OPERATOR_LABELS[transaction.methodCode] || 'Mobile Money';
      const amountLabel = `${Number(transaction.amount).toFixed(2)} ${transaction.currency}`;
      const paymentRef = transaction.providerReference || transaction.id.slice(-8).toUpperCase();
      const storeNames = paidOrder.subOrders.map((s) => s.store.storeName).join(', ');

      const inAppFallback = immediatePayout
        ? `Merci ${paidOrder.customer?.fullName || 'pour votre achat'} ! Votre paiement de ${amountLabel} via ${operatorLabel} (Réf ${paymentRef}) pour ${paidOrder.orderNumber} est confirmé et transmis directement au vendeur.`
        : `Merci ${paidOrder.customer?.fullName || 'pour votre achat'} ! Votre paiement de ${amountLabel} via ${operatorLabel} (Réf ${paymentRef}) pour ${paidOrder.orderNumber} est confirmé et protégé sous séquestre 48h.`;
      const inAppMsg = await this.assistant.composeContextualMessage({
        scenario: 'ORDER_PAID_PHYSICAL',
        channel: 'inapp',
        recipientRole: 'CLIENT',
        recipientName: paidOrder.customer?.fullName || undefined,
        facts: {
          orderNumber: paidOrder.orderNumber,
          amountLabel,
          operatorLabel,
          paymentRef,
          stores: storeNames,
          settlementMode: immediatePayout
            ? 'Versement direct immédiat au vendeur (délai 48h désactivé)'
            : 'Protection séquestre 48h',
        },
        requiredTokens: [paidOrder.orderNumber, amountLabel, paymentRef],
        fallbackText: inAppFallback,
      });

      await this.notifications
        .notifyUser({
          userId: paidOrder.customerId,
          type: 'order.paid',
          title: `Paiement confirmé · ${paidOrder.orderNumber}`,
          body: inAppMsg.text,
          data: { orderId: paidOrder.id, orderNumber: paidOrder.orderNumber, paymentRef },
        })
        .catch(() => {});

      if (paidOrder.customer?.phone) {
        const smsFallback = `Merci ! Paiement ${amountLabel} via ${operatorLabel} confirmé (Réf ${paymentRef}) pour ${paidOrder.orderNumber}. ZandoGo veille sur votre commande.`;
        const smsMsg = await this.assistant.composeContextualMessage({
          scenario: 'ORDER_PAID_PHYSICAL',
          channel: 'sms',
          recipientRole: 'CLIENT',
          recipientName: paidOrder.customer.fullName || undefined,
          facts: {
            orderNumber: paidOrder.orderNumber,
            amountLabel,
            operatorLabel,
            paymentRef,
          },
          requiredTokens: [paidOrder.orderNumber, amountLabel, paymentRef],
          fallbackText: smsFallback,
        });
        await this.sms.sendSms(paidOrder.customer.phone, smsMsg.text).catch(() => {});
      }
    }
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
