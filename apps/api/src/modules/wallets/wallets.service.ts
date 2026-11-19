import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { resolveVendorSettlementEligibility } from '../../common/commerce-rules';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FinanceService } from '../finance/finance.service';
import { MaishaPayService } from '../payments/maishapay.service';
import { RequestPayoutDto } from './dto/request-payout.dto';

const RETENTION_HOURS = 48; // règle de gestion par défaut : 48h à compter du paiement (désactivable par Super Admin)

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly finance: FinanceService,
    @Inject(forwardRef(() => MaishaPayService))
    private readonly maishaPay: MaishaPayService,
  ) {}

  private async writeLedgerEntry(
    tx: any,
    walletId: string,
    type: 'CREDIT' | 'DEBIT',
    amount: number,
    referenceType: string,
    referenceId: string,
    status: 'LOCKED' | 'AVAILABLE' | 'HELD_FOR_DISPUTE',
    availableAt: Date | null,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');

    const delta = type === 'CREDIT' ? amount : -amount;
    const balanceAfter = Number(wallet.balance) + delta;
    if (type === 'DEBIT' && referenceType === 'WITHDRAWAL' && balanceAfter < 0) {
      throw new BadRequestException('Solde insuffisant pour effectuer ce retrait');
    }

    await tx.wallet.update({ where: { id: walletId }, data: { balance: balanceAfter } });

    return tx.walletTransaction.create({
      data: {
        walletId,
        type,
        amount,
        currency: wallet.currency,
        referenceType,
        referenceId,
        status,
        availableAt,
        balanceAfter,
      },
    });
  }

  /**
   * Appelé immédiatement à la confirmation du paiement client (Mobile Money / Carte) :
   * le délai de rétention de 48 heures commence dès `paidAt`, sauf si le Super Admin
   * autorise un retrait immédiat.
   */
  async creditOrderFundsOnPayment(orderId: string, paidAt: Date) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subOrders: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    for (const subOrder of order.subOrders) {
      await this.creditSubOrderIdempotent(subOrder.id, paidAt);
    }
  }

  /**
   * Idempotent : appelé soit à la confirmation du paiement (`paidAt`), soit à la
   * livraison (`deliveredAt` pour les commandes cash à la livraison).
   * Évite tout double crédit si les fonds ont déjà été comptabilisés au paiement.
   */
  async creditOrderFundsOnDelivery(subOrderId: string, deliveredAt: Date) {
    return this.creditSubOrderIdempotent(subOrderId, deliveredAt);
  }

  private async creditSubOrderIdempotent(subOrderId: string, anchorDate: Date) {
    const existing = await this.prisma.walletTransaction.findFirst({
      where: { referenceType: 'ORDER_PAYOUT', referenceId: subOrderId },
    });
    if (existing) {
      return existing;
    }

    const subOrder = await this.prisma.orderSubOrder.findUnique({
      where: { id: subOrderId },
      include: { order: true, store: true },
    });
    if (!subOrder) throw new NotFoundException('Sous-commande introuvable');

    const [pricing, storeImmediateSetting, openDispute] = await Promise.all([
      this.finance.getPlatformPricing(),
      this.prisma.platformSetting.findUnique({
        where: { key: `store_immediate_withdrawal:${subOrder.storeId}` },
      }),
      this.prisma.dispute.findFirst({
        where: {
          orderId: subOrder.orderId,
          status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
        },
      }),
    ]);

    const settlement = resolveVendorSettlementEligibility({
      storePayoutBlocked: Boolean(subOrder.store.payoutBlocked),
      hasOpenDispute: Boolean(openDispute),
      globalImmediateWithdrawal: Boolean(pricing.allowImmediateVendorWithdrawal),
      storeImmediateWithdrawal: Boolean((storeImmediateSetting?.value as { enabled?: boolean } | null)?.enabled),
    });

    const vendorAmount = Math.max(0, Number(subOrder.subtotal) - Number(subOrder.commissionAmount));
    const availableAt = settlement.canReleaseImmediately
      ? anchorDate
      : new Date(anchorDate.getTime() + RETENTION_HOURS * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const again = await tx.walletTransaction.findFirst({
        where: { referenceType: 'ORDER_PAYOUT', referenceId: subOrderId },
      });
      if (again) return again;

      const vendorWallet = await tx.wallet.upsert({
        where: {
          ownerType_ownerId_currency: {
            ownerType: 'VENDOR',
            ownerId: subOrder.storeId,
            currency: subOrder.order.currency,
          },
        },
        update: {},
        create: {
          ownerType: 'VENDOR',
          ownerId: subOrder.storeId,
          currency: subOrder.order.currency,
          balance: 0,
        },
      });

      const platformWallet = await tx.wallet.upsert({
        where: {
          ownerType_ownerId_currency: {
            ownerType: 'PLATFORM',
            ownerId: 'platform',
            currency: subOrder.order.currency,
          },
        },
        update: {},
        create: {
          ownerType: 'PLATFORM',
          ownerId: 'platform',
          currency: subOrder.order.currency,
          balance: 0,
        },
      });

      await this.writeLedgerEntry(
        tx,
        vendorWallet.id,
        'CREDIT',
        vendorAmount,
        'ORDER_PAYOUT',
        subOrderId,
        settlement.initialTxStatus,
        availableAt,
      );

      await this.writeLedgerEntry(
        tx,
        platformWallet.id,
        'CREDIT',
        Number(subOrder.commissionAmount),
        'COMMISSION',
        subOrderId,
        'AVAILABLE',
        null,
      );
    });
  }

  /**
   * À invoquer par un job planifié (cron/BullMQ) toutes les heures : libère
   * automatiquement les fonds dont le délai de rétention est écoulé, sauf
   * si un litige est ouvert sur la commande correspondante.
   */
  async releaseMaturedFunds() {
    const now = new Date();
    const candidates = await this.prisma.walletTransaction.findMany({
      where: { status: 'LOCKED', availableAt: { lte: now } },
    });

    let released = 0;
    for (const tx of candidates) {
      if (tx.referenceType !== 'ORDER_PAYOUT' || !tx.referenceId) continue;

      const openDispute = await this.prisma.dispute.findFirst({
        where: {
          orderId: (
            await this.prisma.orderSubOrder.findUnique({ where: { id: tx.referenceId } })
          )?.orderId,
          status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
        },
      });

      if (openDispute) {
        await this.prisma.walletTransaction.update({
          where: { id: tx.id },
          data: { status: 'HELD_FOR_DISPUTE' },
        });
        continue;
      }

      await this.prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { status: 'AVAILABLE' },
      });
      released += 1;
    }

    return { released };
  }

  /**
   * Appelé à l'ouverture d'un litige : gèle immédiatement les fonds encore
   * LOCKED liés à cette commande, sans attendre le prochain passage du job
   * de libération automatique (défense en profondeur contre une fenêtre de
   * course entre l'ouverture du litige et le cron de rétention).
   */
  async holdFundsForDispute(orderId: string) {
    const subOrders = await this.prisma.orderSubOrder.findMany({ where: { orderId } });
    const subOrderIds = subOrders.map((s) => s.id);

    await this.prisma.walletTransaction.updateMany({
      where: { referenceType: 'ORDER_PAYOUT', referenceId: { in: subOrderIds }, status: 'LOCKED' },
      data: { status: 'HELD_FOR_DISPUTE' },
    });
  }

  /** Litige tranché en faveur du vendeur : les fonds gelés sont libérés immédiatement */
  async releaseHeldFunds(orderId: string) {
    const subOrders = await this.prisma.orderSubOrder.findMany({ where: { orderId } });
    const subOrderIds = subOrders.map((s) => s.id);

    await this.prisma.walletTransaction.updateMany({
      where: { referenceType: 'ORDER_PAYOUT', referenceId: { in: subOrderIds }, status: 'HELD_FOR_DISPUTE' },
      data: { status: 'AVAILABLE' },
    });
  }

  /**
   * Litige tranché en faveur du client (remboursement total ou partiel) :
   * on n'efface JAMAIS l'écriture de crédit d'origine (append-only) — on
   * enregistre une écriture de débit compensatoire, ce qui garde une trace
   * complète et auditable des deux mouvements.
   */
  async reverseOrderFunds(subOrderId: string, vendorAmountToReverse: number, commissionToReverse: number) {
    const subOrder = await this.prisma.orderSubOrder.findUnique({
      where: { id: subOrderId },
      include: { order: true },
    });
    if (!subOrder) throw new NotFoundException('Sous-commande introuvable');

    return this.prisma.$transaction(async (tx) => {
      if (vendorAmountToReverse > 0) {
        const vendorWallet = await tx.wallet.findUnique({
          where: {
            ownerType_ownerId_currency: {
              ownerType: 'VENDOR',
              ownerId: subOrder.storeId,
              currency: subOrder.order.currency,
            },
          },
        });
        if (vendorWallet) {
          await this.writeLedgerEntry(
            tx,
            vendorWallet.id,
            'DEBIT',
            vendorAmountToReverse,
            'REFUND',
            subOrderId,
            'AVAILABLE',
            null,
          );
        }
      }

      if (commissionToReverse > 0) {
        const platformWallet = await tx.wallet.findUnique({
          where: {
            ownerType_ownerId_currency: {
              ownerType: 'PLATFORM',
              ownerId: 'platform',
              currency: subOrder.order.currency,
            },
          },
        });
        if (platformWallet) {
          await this.writeLedgerEntry(
            tx,
            platformWallet.id,
            'DEBIT',
            commissionToReverse,
            'REFUND',
            subOrderId,
            'AVAILABLE',
            null,
          );
        }
      }

      // Les écritures HELD_FOR_DISPUTE liées ne représentent plus une somme
      // à libérer puisqu'elle vient d'être annulée par le débit ci-dessus.
      await tx.walletTransaction.updateMany({
        where: { referenceType: 'ORDER_PAYOUT', referenceId: subOrderId, status: 'HELD_FOR_DISPUTE' },
        data: { status: 'AVAILABLE' }, // soldée par l'écriture de débit compensatoire
      });
    });
  }

  async getMyWallets(user: AuthenticatedUser) {
    const stores = await this.prisma.vendorStore.findMany({ where: { ownerId: user.id } });
    const storeIds = stores.map((s) => s.id);
    return this.prisma.wallet.findMany({
      where: { ownerType: 'VENDOR', ownerId: { in: storeIds } },
    });
  }

  async getWalletLedger(user: AuthenticatedUser, walletId: string) {
    const wallet = await this.assertOwnership(user, walletId);
    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async assertOwnership(user: AuthenticatedUser, walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet introuvable');
    if (wallet.ownerType === 'VENDOR') {
      const store = await this.prisma.vendorStore.findUnique({ where: { id: wallet.ownerId } });
      if (!store || store.ownerId !== user.id) {
        throw new ForbiddenException("Ce wallet ne vous appartient pas");
      }
    }
    return wallet;
  }

  /**
   * Action manuelle Super Admin : libère immédiatement tous les fonds LOCKED d'une boutique
   * (hors commandes ayant un litige ouvert) afin que le vendeur puisse retirer sur-le-champ.
   */
  async unlockStoreFundsImmediately(admin: AuthenticatedUser, storeId: string) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');
    if (store.payoutBlocked) {
      throw new ForbiddenException('Impossible de libérer les fonds : la boutique est bloquée pour litige.');
    }

    const wallets = await this.prisma.wallet.findMany({
      where: { ownerType: 'VENDOR', ownerId: storeId },
    });
    const walletIds = wallets.map((w) => w.id);
    if (walletIds.length === 0) return { storeId, unlockedCount: 0, unlockedAmountUsd: 0 };

    const lockedTxs = await this.prisma.walletTransaction.findMany({
      where: { walletId: { in: walletIds }, status: 'LOCKED', type: 'CREDIT' },
    });

    let unlockedCount = 0;
    let unlockedAmount = 0;
    for (const tx of lockedTxs) {
      if (tx.referenceType === 'ORDER_PAYOUT' && tx.referenceId) {
        const sub = await this.prisma.orderSubOrder.findUnique({ where: { id: tx.referenceId } });
        if (sub) {
          const openDispute = await this.prisma.dispute.findFirst({
            where: {
              orderId: sub.orderId,
              status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
            },
          });
          if (openDispute) continue;
        }
      }
      await this.prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { status: 'AVAILABLE', availableAt: new Date() },
      });
      unlockedCount += 1;
      unlockedAmount += Number(tx.amount);
    }

    await this.audit.log({
      actorUserId: admin.id,
      action: 'wallet.admin_unlock_funds',
      entityType: 'VendorStore',
      entityId: storeId,
      afterState: { unlockedCount, unlockedAmount },
    });

    return { storeId, unlockedCount, unlockedAmount: Number(unlockedAmount.toFixed(2)) };
  }

  /**
   * Le retrait porte sur le solde AVAILABLE (ou sur les fonds LOCKED si le Super Admin a
   * activé le retrait immédiat globalement ou pour cette boutique, sans litige ouvert).
   */
  async requestPayout(user: AuthenticatedUser, dto: RequestPayoutDto) {
    const wallet = await this.assertOwnership(user, dto.walletId);
    const pricing = await this.finance.getPlatformPricing();
    let immediateAuthorized = Boolean(pricing.allowImmediateVendorWithdrawal);

    if (wallet.ownerType === 'VENDOR') {
      const store = await this.prisma.vendorStore.findUnique({ where: { id: wallet.ownerId } });
      if (store?.payoutBlocked) {
        throw new ForbiddenException(
          store.payoutBlockReason ||
            'Retraits bloqués par l’administration suite à un litige pertinent en cours.',
        );
      }

      const blockingDispute = await this.prisma.dispute.findFirst({
        where: {
          payoutFrozen: true,
          status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
          order: { subOrders: { some: { storeId: wallet.ownerId } } },
        },
        include: { order: { select: { orderNumber: true } } },
      });

      if (blockingDispute) {
        throw new ForbiddenException(
          `Retraits bloqués en raison du litige pertinent sur la commande ${blockingDispute.order.orderNumber}.`,
        );
      }

      const storeImmediateSetting = await this.prisma.platformSetting.findUnique({
        where: { key: `store_immediate_withdrawal:${wallet.ownerId}` },
      });
      if ((storeImmediateSetting?.value as { enabled?: boolean } | null)?.enabled) {
        immediateAuthorized = true;
      }
    }

    const payout = await this.prisma.$transaction(async (tx) => {
      // Si le retrait immédiat est activé par le Super Admin, on libère les crédits en attente (hors litige)
      if (immediateAuthorized && wallet.ownerType === 'VENDOR') {
        await tx.walletTransaction.updateMany({
          where: { walletId: wallet.id, status: 'LOCKED', type: 'CREDIT' },
          data: { status: 'AVAILABLE', availableAt: new Date() },
        });
      } else {
        // Libérer les fonds dont le délai de 48h (calculé depuis le paiement) est écoulé
        await tx.walletTransaction.updateMany({
          where: {
            walletId: wallet.id,
            status: 'LOCKED',
            type: 'CREDIT',
            availableAt: { lte: new Date() },
          },
          data: { status: 'AVAILABLE' },
        });
      }

      const [creditsAgg, debitsAgg] = await Promise.all([
        tx.walletTransaction.aggregate({
          where: { walletId: wallet.id, status: 'AVAILABLE', type: 'CREDIT' },
          _sum: { amount: true },
        }),
        tx.walletTransaction.aggregate({
          where: { walletId: wallet.id, status: 'AVAILABLE', type: 'DEBIT' },
          _sum: { amount: true },
        }),
      ]);

      const balance = Number(creditsAgg._sum.amount ?? 0) - Number(debitsAgg._sum.amount ?? 0);
      if (dto.amount > balance) {
        throw new BadRequestException(
          `Solde disponible insuffisant (disponible : ${balance.toFixed(2)} ${wallet.currency})`,
        );
      }

      const createdPayout = await tx.payoutRequest.create({
        data: {
          walletId: wallet.id,
          amount: dto.amount,
          method: dto.method,
          status: immediateAuthorized ? 'APPROVED' : 'REQUESTED',
        },
      });

      await this.writeLedgerEntry(
        tx,
        wallet.id,
        'DEBIT',
        dto.amount,
        'WITHDRAWAL',
        createdPayout.id,
        'AVAILABLE',
        null,
      );

      return createdPayout;
    });

    const appUrl = this.config.get<string>('APP_URL') ?? '';
    const b2cPhone = dto.phoneNumber || dto.method.match(/\+?\d{9,15}/)?.[0];
    let paymentRef: string | undefined;

    if (b2cPhone) {
      try {
        const b2c = await this.maishaPay.initiateB2cTransfer({
          amount: dto.amount,
          currency: wallet.currency as 'USD' | 'CDF',
          recipientPhone: b2cPhone,
          operator: dto.operator || dto.method,
          reference: payout.id,
          description: `Retrait marchand ZandoGo (${wallet.currency})`,
          callbackUrl: `${appUrl}/api/payments/callbacks/gateway`,
        });
        paymentRef = b2c.transactionId;
        if (immediateAuthorized || b2c.status === 'SUCCESS') {
          await this.prisma.payoutRequest.update({
            where: { id: payout.id },
            data: { status: b2c.status === 'SUCCESS' ? 'PAID' : 'APPROVED', processedAt: new Date() },
          });
        }
      } catch (err) {
        // Remboursement compensatoire atomique si l'appel de décaissement échoue
        await this.prisma.$transaction(async (tx) => {
          await tx.payoutRequest.update({
            where: { id: payout.id },
            data: { status: 'REJECTED', processedAt: new Date() },
          });
          await this.writeLedgerEntry(
            tx,
            wallet.id,
            'CREDIT',
            dto.amount,
            'REFUND',
            payout.id,
            'AVAILABLE',
            null,
          );
        });
        throw err;
      }
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'payout_request.create',
      entityType: 'PayoutRequest',
      entityId: payout.id,
      afterState: { amount: dto.amount, method: dto.method, paymentRef, immediateAuthorized },
    });

    return { ...payout, paymentRef, immediateAuthorized };
  }
}
