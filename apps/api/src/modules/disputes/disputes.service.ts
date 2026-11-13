import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DisputeStatus, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

const SLA_HOURS = 48; // règle de gestion validée

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallets: WalletsService,
    private readonly notifications: NotificationsGateway,
  ) {}

  /**
   * Le client OU le vendeur peuvent ouvrir un litige. Dès l'ouverture, les
   * fonds encore verrouillés (LOCKED) de cette commande sont gelés
   * immédiatement (HELD_FOR_DISPUTE) — voir WalletsService.holdFundsForDispute.
   */
  async openDispute(user: AuthenticatedUser, dto: OpenDisputeDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { subOrders: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const isCustomer = order.customerId === user.id;
    const isVendor = order.subOrders.some((so) =>
      user.roles.some((r) => r.role === RoleName.VENDOR_OWNER && r.scopeId === so.storeId),
    );
    if (!isCustomer && !isVendor) {
      throw new ForbiddenException("Vous n'êtes pas partie prenante de cette commande");
    }

    if (!['DELIVERED', 'OUT_FOR_DELIVERY', 'SHIPPED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException(
        'Un litige ne peut être ouvert que sur une commande en cours ou livrée',
      );
    }

    const existingOpen = await this.prisma.dispute.findFirst({
      where: {
        orderId: dto.orderId,
        status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
      },
    });
    if (existingOpen) {
      throw new ConflictException('Un litige est déjà en cours sur cette commande');
    }

    const openedAt = new Date();
    const slaDeadline = new Date(openedAt.getTime() + SLA_HOURS * 60 * 60 * 1000);
    const isCritical = dto.severity === 'HIGH';

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          orderId: dto.orderId,
          orderItemId: dto.orderItemId,
          raisedByUserId: user.id,
          reasonCategory: dto.reasonCategory,
          severity: dto.severity ?? 'MEDIUM',
          payoutFrozen: isCritical,
          description: dto.description,
          evidenceUrls: dto.evidenceUrls,
          status: DisputeStatus.OPEN,
          openedAt,
          slaDeadline,
        },
      });

      await tx.order.update({ where: { id: dto.orderId }, data: { status: 'DISPUTED' } });

      if (isCritical && order.subOrders.length > 0) {
        const storeIds = order.subOrders.map((s) => s.storeId);
        await tx.vendorStore.updateMany({
          where: { id: { in: storeIds } },
          data: {
            payoutBlocked: true,
            payoutBlockReason: `Retraits bloqués automatiquement : litige pertinent sur la commande ${order.orderNumber}.`,
          },
        });
      }

      return created;
    });

    await this.wallets.holdFundsForDispute(dto.orderId);

    await this.audit.log({
      actorUserId: user.id,
      action: 'dispute.open',
      entityType: 'Dispute',
      entityId: dispute.id,
      afterState: {
        orderId: dto.orderId,
        reasonCategory: dto.reasonCategory,
        severity: dispute.severity,
        payoutFrozen: dispute.payoutFrozen,
        slaDeadline,
      },
    });

    return dispute;
  }

  async addMessage(user: AuthenticatedUser, disputeId: string, dto: AddDisputeMessageDto) {
    const dispute = await this.getDisputeForUser(user, disputeId);

    if (dispute.status.startsWith('RESOLVED')) {
      throw new BadRequestException('Ce litige est déjà résolu, la discussion est clôturée');
    }

    return this.prisma.disputeMessage.create({
      data: { disputeId, senderId: user.id, content: dto.content, attachmentUrl: dto.attachmentUrl },
    });
  }

  private async getDisputeForUser(user: AuthenticatedUser, disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { subOrders: true } } },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable');

    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    const isCustomer = dispute.order.customerId === user.id;
    const isVendor = dispute.order.subOrders.some((so) =>
      user.roles.some((r) => r.role === RoleName.VENDOR_OWNER && r.scopeId === so.storeId),
    );

    if (!isAdmin && !isCustomer && !isVendor) {
      throw new ForbiddenException('Accès non autorisé à ce litige');
    }

    return dispute;
  }

  async getDispute(user: AuthenticatedUser, disputeId: string) {
    await this.getDisputeForUser(user, disputeId);
    return this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { messages: { orderBy: { sentAt: 'asc' } }, order: true },
    });
  }

  /** File d'attente admin, triée par échéance — pour ne jamais dépasser le SLA de 48h */
  async listOpenDisputes() {
    return this.prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] } },
      orderBy: { slaDeadline: 'asc' },
      include: {
        order: {
          select: {
            orderNumber: true,
            total: true,
            currency: true,
            subOrders: {
              include: { store: { select: { id: true, storeName: true, payoutBlocked: true } } },
            },
          },
        },
      },
    });
  }

  async setStorePayoutFreeze(
    admin: AuthenticatedUser,
    disputeId: string,
    blocked: boolean,
    reason?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { subOrders: true } } },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable');

    const storeIds = Array.from(new Set(dispute.order.subOrders.map((s) => s.storeId)));
    const blockReason =
      reason ||
      `Retraits vendeur bloqués suite au litige pertinent sur la commande ${dispute.order.orderNumber}.`;

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: { payoutFrozen: blocked },
      });

      if (storeIds.length > 0) {
        await tx.vendorStore.updateMany({
          where: { id: { in: storeIds } },
          data: {
            payoutBlocked: blocked,
            payoutBlockReason: blocked ? blockReason : null,
          },
        });
      }
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: blocked ? 'dispute.payout_freeze' : 'dispute.payout_unfreeze',
      entityType: 'Dispute',
      entityId: disputeId,
      afterState: { storeIds, payoutFrozen: blocked, reason: blockReason },
    });

    return { disputeId, storeIds, payoutBlocked: blocked, reason: blocked ? blockReason : null };
  }

  async resolveDispute(admin: AuthenticatedUser, disputeId: string, dto: ResolveDisputeDto) {
    const isSuperAdmin = admin.roles.some((r) => r.role === RoleName.SUPER_ADMIN);
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'Seul un SUPER_ADMIN peut trancher un litige, après consultation du vendeur',
      );
    }

    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { subOrders: true } } },
    });
    if (!dispute) throw new NotFoundException('Litige introuvable');
    if (dispute.status.startsWith('RESOLVED')) {
      throw new BadRequestException('Ce litige a déjà été résolu');
    }

    if (dto.status === DisputeStatus.RESOLVED_PARTIAL && dto.amountRefunded === undefined) {
      throw new BadRequestException('amountRefunded est requis pour une résolution partielle');
    }

    let subOrder = dispute.order.subOrders[0];
    if (dispute.orderItemId) {
      const item = await this.prisma.orderItem.findUnique({ where: { id: dispute.orderItemId } });
      const targeted = item && dispute.order.subOrders.find((so) => so.id === item.subOrderId);
      if (targeted) subOrder = targeted;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: dto.status,
          payoutFrozen: false,
          resolutionNote: dto.resolutionNote,
          resolvedByAdminId: admin.id,
          resolvedAt: new Date(),
        },
      });

      const newOrderStatus =
        dto.status === DisputeStatus.RESOLVED_RELEASE ? 'DELIVERED' : 'REFUNDED';
      await tx.order.update({ where: { id: dispute.orderId }, data: { status: newOrderStatus } });

      if (subOrder) {
        const remainingFrozen = await tx.dispute.count({
          where: {
            id: { not: disputeId },
            payoutFrozen: true,
            status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
            order: { subOrders: { some: { storeId: subOrder.storeId } } },
          },
        });
        if (remainingFrozen === 0) {
          await tx.vendorStore.update({
            where: { id: subOrder.storeId },
            data: { payoutBlocked: false, payoutBlockReason: null },
          });
        }
      }
    });

    if (dto.status === DisputeStatus.RESOLVED_RELEASE) {
      await this.wallets.releaseHeldFunds(dispute.orderId);
    }

    if (dto.status === DisputeStatus.RESOLVED_REFUND) {
      const vendorAmount = Number(subOrder.subtotal) - Number(subOrder.commissionAmount);
      await this.wallets.reverseOrderFunds(subOrder.id, vendorAmount, Number(subOrder.commissionAmount));
    }

    if (dto.status === DisputeStatus.RESOLVED_PARTIAL && dto.amountRefunded !== undefined) {
      await this.wallets.reverseOrderFunds(subOrder.id, dto.amountRefunded, 0);
    }

    await this.audit.log({
      actorUserId: admin.id,
      action: 'dispute.resolve',
      entityType: 'Dispute',
      entityId: disputeId,
      afterState: { status: dto.status, resolutionNote: dto.resolutionNote, amountRefunded: dto.amountRefunded },
    });

    await this.notifications.notifyUser({
      userId: dispute.raisedByUserId,
      type: 'dispute.resolved',
      title: 'Votre litige a été tranché',
      body: dto.resolutionNote,
      data: { disputeId, status: dto.status },
    });

    return this.prisma.dispute.findUnique({ where: { id: disputeId } });
  }
}
