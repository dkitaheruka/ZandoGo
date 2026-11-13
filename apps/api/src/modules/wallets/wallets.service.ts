import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { RequestPayoutDto } from './dto/request-payout.dto';

const RETENTION_HOURS = 48; // règle de gestion validée

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
   * Appelé par le module `delivery` au moment où une sous-commande passe en
   * DELIVERED (jamais avant : voir la règle de gestion sur la rétention).
   * Crédite le vendeur en LOCKED (déblocage automatique 48h plus tard) et
   * la plateforme immédiatement (sa commission ne subit pas de rétention).
   */
  async creditOrderFundsOnDelivery(subOrderId: string, deliveredAt: Date) {
    const subOrder = await this.prisma.orderSubOrder.findUnique({
      where: { id: subOrderId },
      include: { order: true },
    });
    if (!subOrder) throw new NotFoundException('Sous-commande introuvable');

    const vendorAmount = Number(subOrder.subtotal) - Number(subOrder.commissionAmount);
    const availableAt = new Date(deliveredAt.getTime() + RETENTION_HOURS * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const vendorWallet = await tx.wallet.findUnique({
        where: {
          ownerType_ownerId_currency: {
            ownerType: 'VENDOR',
            ownerId: subOrder.storeId,
            currency: subOrder.order.currency,
          },
        },
      });
      if (!vendorWallet) {
        throw new BadRequestException('Le vendeur ne possède pas de wallet dans cette devise');
      }

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
        'LOCKED',
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
   * Le retrait ne peut porter que sur le solde AVAILABLE (fonds dont le
   * délai de rétention de 48h est écoulé et sans litige ouvert) — jamais
   * sur le solde total du wallet, qui peut inclure des fonds encore LOCKED.
   */
  async requestPayout(user: AuthenticatedUser, dto: RequestPayoutDto) {
    const wallet = await this.assertOwnership(user, dto.walletId);

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
    }

    const availableBalance = await this.prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, status: 'AVAILABLE' },
      _sum: { amount: true },
    });

    const balance = Number(availableBalance._sum.amount ?? 0);
    if (dto.amount > balance) {
      throw new BadRequestException(
        `Solde disponible insuffisant (disponible : ${balance} ${wallet.currency})`,
      );
    }

    const payout = await this.prisma.payoutRequest.create({
      data: {
        walletId: wallet.id,
        amount: dto.amount,
        method: dto.method,
        status: 'REQUESTED',
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'payout_request.create',
      entityType: 'PayoutRequest',
      entityId: payout.id,
      afterState: { amount: dto.amount, method: dto.method },
    });

    return payout;
  }
}
