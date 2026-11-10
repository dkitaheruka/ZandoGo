import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CinetPayService } from './cinetpay.service';
import { StripeService } from './stripe.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cinetpay: CinetPayService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService,
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

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        methodCode: dto.methodCode,
        amount: order.total,
        currency: order.currency,
        status: 'INITIATED',
      },
    });

    // --- Paiement à la livraison : pas de flux financier immédiat ---
    if (dto.methodCode === 'CASH_ON_DELIVERY') {
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: 'PENDING' }, // sera confirmé par le livreur à la remise
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

      return { method: 'cash_on_delivery', message: 'Commande confirmée, paiement à la livraison' };
    }

    // --- Mobile Money via CinetPay ---
    if (
      dto.methodCode === 'MOBILE_MONEY_ORANGE' ||
      dto.methodCode === 'MOBILE_MONEY_AIRTEL' ||
      dto.methodCode === 'MOBILE_MONEY_MPESA'
    ) {
      if (!dto.phoneNumber) {
        throw new BadRequestException('Le numéro de téléphone Mobile Money est requis');
      }

      const appUrl = this.config.get<string>('APP_URL');
      const result = await this.cinetpay.initiatePayment({
        transactionId: transaction.id,
        amount: Number(order.total),
        currency: order.currency as 'USD' | 'CDF',
        description: `Commande ${order.orderNumber}`,
        customerPhone: dto.phoneNumber,
        returnUrl: `${appUrl}/orders/${order.id}`,
        notifyUrl: `${appUrl}/api/payments/webhooks/cinetpay`,
      });

      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PENDING',
          providerReference: result.data?.payment_token,
          rawProviderPayload: result as any,
        },
      });

      return { method: dto.methodCode, paymentUrl: result.data?.payment_url };
    }

    // --- Carte bancaire via Stripe ---
    if (dto.methodCode === 'CARD_STRIPE') {
      const intent = await this.stripe.createPaymentIntent({
        amount: Number(order.total),
        currency: 'usd', // Stripe ne supporte pas le CDF : forcer USD pour ce moyen
        orderId: order.id,
      });

      await this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'PENDING', providerReference: intent.id },
      });

      return { method: 'card_stripe', clientSecret: intent.client_secret };
    }

    throw new BadRequestException('Moyen de paiement non pris en charge');
  }

  /**
   * Ne fait JAMAIS confiance au contenu du webhook seul : on rappelle
   * systématiquement l'API de vérification CinetPay avec le transaction_id
   * reçu avant de valider quoi que ce soit.
   */
  async handleCinetPayWebhook(payload: { cpm_trans_id?: string; transaction_id?: string }) {
    const transactionId = payload.cpm_trans_id ?? payload.transaction_id;
    if (!transactionId) {
      this.logger.warn('Webhook CinetPay reçu sans transaction_id');
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
    if (!transaction || transaction.status === 'SUCCESS') return; // idempotence

    await this.prisma.$transaction([
      this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'SUCCESS', confirmedAt: new Date(), rawProviderPayload: rawPayload as any },
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
          note: `Paiement confirmé via ${transaction.methodCode}`,
        },
      }),
    ]);

    await this.audit.log({
      action: 'payment.success',
      entityType: 'PaymentTransaction',
      entityId: transaction.id,
      afterState: { orderId: transaction.orderId, amount: transaction.amount },
    });
  }

  /**
   * Un paiement en échec libère automatiquement le stock réservé à la
   * commande (voir le point de vigilance signalé dans le document
   * d'architecture) — sans cela, le stock resterait bloqué indéfiniment.
   */
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
          note: `Échec du paiement via ${transaction.methodCode} — stock restauré`,
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

  /**
   * Appelé par le module `delivery` au moment de la remise en cash.
   * Crée une transaction géolocalisée et horodatée, distincte du flux
   * carte/mobile money, mais suit exactement le même schéma de traçabilité.
   */
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
