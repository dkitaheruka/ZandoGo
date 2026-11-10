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

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          orderId: dto.orderId,
          orderItemId: dto.orderItemId,
          raisedByUserId: user.id,
          reasonCategory: dto.reasonCategory,
          description: dto.description,
          evidenceUrls: dto.evidenceUrls,
          status: DisputeStatus.OPEN,
          openedAt,
          slaDeadline,
        },
      });

      await tx.order.update({ where: { id: dto.orderId }, data: { status: 'DISPUTED' } });

      return created;
    });

    await this.wallets.holdFundsForDispute(dto.orderId);

    await this.audit.log({
      actorUserId: user.id,
      action: 'dispute.open',
      entityType: 'Dispute',
      entityId: dispute.id,
      afterState: { orderId: dto.orderId, reasonCategory: dto.reasonCategory, slaDeadline },
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
    const dispute = await this.getDisputeForUser(user, disputeId);
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
      include: { order: { select: { orderNumber: true, total: true, currency: true } } },
    });
  }

  /**
   * Seul un SUPER_ADMIN peut trancher un litige — jamais un ADMIN simple,
   * jamais le vendeur, jamais automatiquement. C'est la règle de gestion
   * la plus stricte du système car elle touche directement à l'argent.
   */
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

    // Si le litige vise un article précis, on remonte à sa sous-commande
    // (donc à SON vendeur). Sans article ciblé, on retombe sur la première
    // sous-commande : simplification MVP, à raffiner pour une commande
    // multi-vendeur où le litige concerne toute la commande.
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
          resolutionNote: dto.resolutionNote,
          resolvedByAdminId: admin.id,
          resolvedAt: new Date(),
        },
      });

      const newOrderStatus =
        dto.status === DisputeStatus.RESOLVED_RELEASE ? 'DELIVERED' : 'REFUNDED';
      await tx.order.update({ where: { id: dispute.orderId }, data: { status: newOrderStatus } });
    });

    if (dto.status === DisputeStatus.RESOLVED_RELEASE) {
      await this.wallets.releaseHeldFunds(dispute.orderId);
    }

    if (dto.status === DisputeStatus.RESOLVED_REFUND) {
      const vendorAmount = Number(subOrder.subtotal) - Number(subOrder.commissionAmount);
      await this.wallets.reverseOrderFunds(subOrder.id, vendorAmount, Number(subOrder.commissionAmount));
    }

    if (dto.status === DisputeStatus.RESOLVED_PARTIAL && dto.amountRefunded !== undefined) {
      // Remboursement partiel : on annule la part vendeur proportionnelle,
      // la commission plateforme n'est pas touchée sur un litige partiel
      // (règle simple par défaut, ajustable si vous préférez un autre partage).
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
