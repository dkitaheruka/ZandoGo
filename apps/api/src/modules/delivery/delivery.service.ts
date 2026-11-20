import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycStatus, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { isSafeMediaReference } from '../../common/security-rules';
import { AssistantService } from '../assistant/assistant.service';
import { WalletsService } from '../wallets/wallets.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { UploadsService } from '../uploads/uploads.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { assertCanViewDelivery } from '../../common/access/delivery-access';
import { ApplyAgentDto } from './dto/apply-agent.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { PingDto } from './dto/ping.dto';

// Barème simple, à externaliser en configuration plus tard
const BASE_FEE_USD = 1;
const PER_KM_FEE_USD = 0.4;

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallets: WalletsService,
    private readonly payments: PaymentsService,
    private readonly tracking: TrackingGateway,
    private readonly notifications: NotificationsGateway,
    private readonly assistant: AssistantService,
    private readonly uploads: UploadsService,
  ) {}

  // -------------------------------------------------------------------
  // Candidature et gestion du profil livreur
  // -------------------------------------------------------------------

  async applyAsAgent(user: AuthenticatedUser, dto: ApplyAgentDto) {
    const existing = await this.prisma.deliveryAgent.findUnique({ where: { userId: user.id } });
    if (existing) {
      throw new BadRequestException('Une candidature livreur existe déjà pour ce compte');
    }

    const agent = await this.prisma.deliveryAgent.create({
      data: {
        userId: user.id,
        affiliation: 'PLATFORM_POOL',
        vehicleType: dto.vehicleType,
        status: 'OFFLINE', // reste hors-ligne tant que non approuvé
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'delivery_agent.apply',
      entityType: 'DeliveryAgent',
      entityId: agent.id,
    });

    return agent;
  }

  /**
   * Un livreur ne peut être approuvé (et donc recevoir le rôle DELIVERY_AGENT)
   * qu'après validation de son KYC (permis de conduire / pièce d'identité).
   * Il manipule du cash pour le compte de tiers : ce contrôle n'est pas
   * négociable, contrairement à la boutique vendeur où le KYC peut arriver
   * après une inscription initiale.
   */
  async approveAgent(admin: AuthenticatedUser, agentId: string) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Livreur introuvable');

    const kycApproved = await this.prisma.kycDocument.findFirst({
      where: { userId: agent.userId, type: 'DRIVER_LICENSE', status: KycStatus.APPROVED },
    });
    if (!kycApproved) {
      throw new BadRequestException("Le KYC (permis/pièce d'identité) n'est pas encore approuvé");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const a = await tx.deliveryAgent.update({ where: { id: agentId }, data: { status: 'AVAILABLE' } });
      await tx.userRole.create({ data: { userId: agent.userId, role: RoleName.DELIVERY_AGENT } });
      return a;
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'delivery_agent.approve',
      entityType: 'DeliveryAgent',
      entityId: agentId,
    });

    return updated;
  }

  async setAvailability(user: AuthenticatedUser, status: 'AVAILABLE' | 'OFFLINE') {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId: user.id } });
    if (!agent) throw new NotFoundException('Profil livreur introuvable');
    return this.prisma.deliveryAgent.update({ where: { id: agent.id }, data: { status } });
  }

  /** Profil du livreur connecté (utilisé par l'app pour savoir s'il a candidaté) */
  async getMyProfile(user: AuthenticatedUser) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId: user.id } });
    if (!agent) throw new NotFoundException('Aucune candidature livreur pour ce compte');
    return agent;
  }

  /**
   * Position d'un livreur disponible, hors de toute course. Indispensable :
   * l'assignation automatique ne retient que les livreurs dont la position
   * est connue, or le ping rattaché à une course ne peut être envoyé qu'une
   * fois la course assignée. Sans cette route, un livreur disponible ne
   * serait jamais localisé, donc jamais choisi.
   */
  async updateMyLocation(user: AuthenticatedUser, dto: PingDto) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId: user.id } });
    if (!agent) throw new NotFoundException('Profil livreur introuvable');
    return this.prisma.deliveryAgent.update({
      where: { id: agent.id },
      data: { currentLat: dto.lat, currentLng: dto.lng, lastPingAt: new Date() },
    });
  }

  /** Courses du livreur connecté, avec ce qu'il faut pour les exécuter (adresse, cash à encaisser) */
  async listMyDeliveries(user: AuthenticatedUser) {
    const agent = await this.prisma.deliveryAgent.findUnique({ where: { userId: user.id } });
    if (!agent) throw new NotFoundException('Profil livreur introuvable');

    const rows = await this.prisma.delivery.findMany({
      where: { agentId: agent.id },
      include: {
        proof: true,
        subOrder: {
          include: {
            store: { select: { storeName: true } },
            order: {
              include: {
                deliveryAddress: true,
                paymentTransactions: { select: { methodCode: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return Promise.all(
      rows.map(async (row) => {
        if (row.proof?.fileUrl && row.proof.fileUrl.startsWith('delivery-proofs/')) {
          try {
            const signed = await this.uploads.signedReadUrl(row.proof.fileUrl);
            return { ...row, proof: { ...row.proof, fileUrl: signed } };
          } catch {
            return row;
          }
        }
        return row;
      }),
    );
  }

  /** File d'attente admin : livreurs sans le rôle DELIVERY_AGENT, donc jamais encore approuvés */
  async listPendingAgents() {
    return this.prisma.deliveryAgent.findMany({
      where: { user: { roles: { none: { role: RoleName.DELIVERY_AGENT } } } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            // id (pas la clé de stockage) : l'admin ouvre le document via GET /kyc/documents/:id/file-url
            kycDocuments: { where: { type: 'DRIVER_LICENSE' }, select: { id: true, status: true } },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------------
  // Création et assignation d'une course
  // -------------------------------------------------------------------

  async createDelivery(user: AuthenticatedUser, dto: CreateDeliveryDto) {
    const subOrder = await this.prisma.orderSubOrder.findUnique({
      where: { id: dto.subOrderId },
      include: { store: true, order: { include: { deliveryAddress: true } } },
    });
    if (!subOrder) throw new NotFoundException('Sous-commande introuvable');
    if (subOrder.store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }
    if (!subOrder.order.deliveryAddress?.latitude || !subOrder.order.deliveryAddress?.longitude) {
      throw new BadRequestException("L'adresse de livraison du client n'a pas de coordonnées GPS");
    }

    const distanceKm = haversineDistanceKm(
      dto.pickupLat,
      dto.pickupLng,
      subOrder.order.deliveryAddress.latitude,
      subOrder.order.deliveryAddress.longitude,
    );
    const estimatedFee = BASE_FEE_USD + distanceKm * PER_KM_FEE_USD;

    const delivery = await this.prisma.delivery.create({
      data: {
        subOrderId: dto.subOrderId,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffLat: subOrder.order.deliveryAddress.latitude,
        dropoffLng: subOrder.order.deliveryAddress.longitude,
        distanceKm,
        estimatedFee,
        status: 'AWAITING_ASSIGNMENT',
      },
    });

    if (dto.mode === 'vendor_dedicated') {
      if (!dto.dedicatedAgentId) {
        throw new BadRequestException('dedicatedAgentId est requis pour le mode vendor_dedicated');
      }
      return this.assignAgent(delivery.id, dto.dedicatedAgentId);
    }

    return this.autoAssignFromPool(delivery.id);
  }

  /**
   * Algorithme d'assignation : parmi les livreurs du pool disponibles,
   * on choisit le plus proche du point de retrait. En production, prévoir
   * une fenêtre d'acceptation (ex: 60s) avec relance au suivant en cas de
   * non-réponse — simplifié ici en assignation directe pour ce squelette.
   */
  private async autoAssignFromPool(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Course introuvable');

    const availableAgents = await this.prisma.deliveryAgent.findMany({
      where: { affiliation: 'PLATFORM_POOL', status: 'AVAILABLE', currentLat: { not: null } },
    });

    if (availableAgents.length === 0) {
      return delivery; // reste AWAITING_ASSIGNMENT ; à relancer périodiquement
    }

    const closest = availableAgents.reduce((best, agent) => {
      const d = haversineDistanceKm(delivery.pickupLat, delivery.pickupLng, agent.currentLat!, agent.currentLng!);
      return !best || d < best.distance ? { agent, distance: d } : best;
    }, null as null | { agent: (typeof availableAgents)[number]; distance: number });

    if (!closest) return delivery;

    return this.assignAgent(deliveryId, closest.agent.id);
  }

  private async assignAgent(deliveryId: string, agentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: { agentId, status: 'ASSIGNED', assignedAt: new Date() },
      });
      await tx.deliveryAgent.update({ where: { id: agentId }, data: { status: 'BUSY' } });
      return delivery;
    });
  }

  // -------------------------------------------------------------------
  // Actions du livreur
  // -------------------------------------------------------------------

  private async assertAssignedAgent(user: AuthenticatedUser, deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { agent: true, subOrder: { include: { order: true } } },
    });
    if (!delivery) throw new NotFoundException('Course introuvable');
    if (!delivery.agent || delivery.agent.userId !== user.id) {
      throw new ForbiddenException("Cette course ne vous est pas assignée");
    }
    return delivery;
  }

  async updateStatus(user: AuthenticatedUser, deliveryId: string, dto: UpdateDeliveryStatusDto) {
    const delivery = await this.assertAssignedAgent(user, deliveryId);

    const data: any = { status: dto.status };
    if (dto.status === 'PICKED_UP') data.pickedUpAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const d = await tx.delivery.update({ where: { id: deliveryId }, data });

      if (dto.status === 'PICKED_UP') {
        await tx.order.update({
          where: { id: delivery.subOrder.orderId },
          data: { status: 'OUT_FOR_DELIVERY' },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: delivery.subOrder.orderId,
            fromStatus: 'PROCESSING',
            toStatus: 'OUT_FOR_DELIVERY',
            changedByUserId: user.id,
            note: 'Colis récupéré par le livreur',
          },
        });
      }

      if (dto.status === 'FAILED') {
        await tx.deliveryAgent.update({ where: { id: delivery.agentId! }, data: { status: 'AVAILABLE' } });
      }

      return d;
    });

    this.tracking.emitStatusChange(deliveryId, updated.status);

    return updated;
  }

  /** Ping périodique (toutes les 10-15s côté app livreur) — alimente le tracking live */
  async recordPing(user: AuthenticatedUser, deliveryId: string, dto: PingDto) {
    const delivery = await this.assertAssignedAgent(user, deliveryId);

    await this.prisma.$transaction([
      this.prisma.deliveryTrackingPing.create({
        data: { deliveryId, agentId: delivery.agentId!, lat: dto.lat, lng: dto.lng },
      }),
      this.prisma.deliveryAgent.update({
        where: { id: delivery.agentId! },
        data: { currentLat: dto.lat, currentLng: dto.lng, lastPingAt: new Date() },
      }),
    ]);

    const recordedAt = new Date();
    this.tracking.emitLocationUpdate(deliveryId, dto.lat, dto.lng, recordedAt);

    return { recorded: true };
  }

  /**
   * Permet au client (ou au vendeur/admin) de retrouver la course associée
   * à sa commande sans connaître l'id de la Delivery — seul l'id de commande
   * lui est connu depuis "Mes commandes".
   */
  async getDeliveryForOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subOrders: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const isCustomer = order.customerId === user.id;
    const isVendor = order.subOrders.some((so) =>
      user.roles.some((r) => r.role === RoleName.VENDOR_OWNER && r.scopeId === so.storeId),
    );
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    if (!isCustomer && !isVendor && !isAdmin) {
      throw new ForbiddenException('Accès non autorisé à cette commande');
    }

    // Priorité admin > client > vendeur (comme OrdersService.getOrder). Un vendeur
    // seul ne voit que les livraisons de SES sous-commandes : les autres contiennent
    // le livreur, le trajet et le domicile du client d'autres boutiques.
    const seesEverything = isAdmin || isCustomer;
    const myStoreIds = new Set(
      user.roles.filter((r) => r.role === RoleName.VENDOR_OWNER && r.scopeId).map((r) => r.scopeId),
    );
    const visibleSubOrders = seesEverything
      ? order.subOrders
      : order.subOrders.filter((so) => myStoreIds.has(so.storeId));

    const subOrderIds = visibleSubOrders.map((so) => so.id);
    return this.prisma.delivery.findMany({
      where: { subOrderId: { in: subOrderIds } },
      include: { agent: { include: { user: { select: { fullName: true } } } } },
    });
  }

  async getTracking(user: AuthenticatedUser, deliveryId: string) {
    await assertCanViewDelivery(this.prisma, user, deliveryId);
    return this.prisma.deliveryTrackingPing.findMany({
      where: { deliveryId },
      orderBy: { recordedAt: 'asc' },
      take: 500,
    });
  }

  /**
   * Étape de clôture : preuve de livraison obligatoire, puis c'est ICI
   * (et seulement ici) que le crédit vendeur est déclenché — jamais au
   * moment du paiement. Boucle enfin le cycle commande → paiement →
   * livraison → argent décrit dans le document d'architecture.
   */
  async completeDelivery(user: AuthenticatedUser, deliveryId: string, dto: CompleteDeliveryDto) {
    const delivery = await this.assertAssignedAgent(user, deliveryId);

    if (dto.proofType !== 'OTP_CODE' && !dto.fileUrl) {
      throw new BadRequestException('Un fichier de preuve (signature/photo) est requis');
    }
    if (dto.proofType === 'OTP_CODE' && !dto.otpValue) {
      throw new BadRequestException('Le code OTP est requis');
    }
    let cleanProofUrl: string | undefined;
    if (dto.proofType !== 'OTP_CODE' && dto.fileUrl) {
      const trimmed = dto.fileUrl.trim();
      if (!isSafeMediaReference(trimmed, ['delivery-proofs', 'chat'])) {
        throw new BadRequestException('Fichier preuve invalide ou format non autorisé');
      }
      if (trimmed.startsWith('delivery-proofs/')) {
        this.uploads.assertOwnedKey(user, 'DELIVERY_PROOF', trimmed);
      } else if (trimmed.startsWith('chat/')) {
        this.uploads.assertOwnedKey(user, 'CHAT_IMAGE', trimmed);
      }
      cleanProofUrl = trimmed;
    }

    const deliveredAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.deliveryProof.create({
        data: {
          deliveryId,
          type: dto.proofType,
          fileUrl: cleanProofUrl,
          otpValue: dto.otpValue,
          verifiedAt: deliveredAt,
        },
      });

      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: { status: 'DELIVERED', deliveredAt, finalFee: delivery.estimatedFee },
      });

      await tx.orderSubOrder.update({
        where: { id: delivery.subOrderId },
        data: { status: 'DELIVERED' },
      });

      await tx.order.update({
        where: { id: delivery.subOrder.orderId },
        data: { status: 'DELIVERED' },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: delivery.subOrder.orderId,
          fromStatus: 'OUT_FOR_DELIVERY',
          toStatus: 'DELIVERED',
          changedByUserId: user.id,
          note: `Livraison confirmée (preuve : ${dto.proofType})`,
        },
      });

      await tx.deliveryAgent.update({ where: { id: delivery.agentId! }, data: { status: 'AVAILABLE' } });

      return updatedDelivery;
    });

    // Si la commande est payée en cash, c'est maintenant que l'encaissement
    // est officiellement enregistré (géolocalisé et horodaté).
    if (delivery.subOrder.order.status !== 'PAID') {
      const pendingCash = await this.prisma.paymentTransaction.findFirst({
        where: { orderId: delivery.subOrder.orderId, methodCode: 'CASH_ON_DELIVERY', status: 'PENDING' },
      });
      if (pendingCash) {
        await this.payments.confirmCashOnDelivery(delivery.subOrder.orderId, dto.lat, dto.lng);
      }
    }

    // Déblocage du cycle financier : crédit vendeur (LOCKED, 48h) + commission plateforme (AVAILABLE)
    await this.wallets.creditOrderFundsOnDelivery(delivery.subOrderId, deliveredAt);

    this.tracking.emitStatusChange(deliveryId, 'DELIVERED');

    const deliveredFallback = `Bonne nouvelle ! Votre commande ${delivery.subOrder.order.orderNumber} vient d’être remise. Merci pour votre confiance sur ZandoGo !`;
    const deliveredMsg = await this.assistant.composeContextualMessage({
      scenario: 'DELIVERY_COMPLETED',
      channel: 'inapp',
      recipientRole: 'CLIENT',
      facts: {
        orderNumber: delivery.subOrder.order.orderNumber,
        proofType: dto.proofType,
      },
      requiredTokens: [delivery.subOrder.order.orderNumber],
      fallbackText: deliveredFallback,
    });

    await this.notifications
      .notifyUser({
        userId: delivery.subOrder.order.customerId,
        type: 'delivery.completed',
        title: `Colis remis · ${delivery.subOrder.order.orderNumber}`,
        body: deliveredMsg.text,
        data: { deliveryId, orderId: delivery.subOrder.orderId },
      })
      .catch(() => {});

    await this.audit.log({
      actorUserId: user.id,
      action: 'delivery.complete',
      entityType: 'Delivery',
      entityId: deliveryId,
      afterState: { deliveredAt, proofType: dto.proofType },
    });

    return result;
  }
}
