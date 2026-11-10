import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleName, StoreStatus, Currency } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsGateway } from '../realtime/notifications.gateway';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { ReviewStoreDto } from './dto/review-store.dto';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class VendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsGateway,
  ) {}

  /**
   * Un CUSTOMER (ou tout utilisateur) peut demander l'ouverture d'une boutique.
   * La boutique naît en PENDING : elle n'apparaît jamais dans le catalogue
   * public tant qu'un ADMIN ne l'a pas explicitement approuvée (voir reviewStore).
   * Le rôle VENDOR_OWNER est attribué immédiatement, mais scope au store créé,
   * ce qui permet au vendeur de compléter son profil/KYC avant validation.
   */
  async createStore(user: AuthenticatedUser, dto: CreateStoreDto) {
    const existingSlug = await this.prisma.vendorStore.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException('Ce slug de boutique est déjà utilisé');
    }

    const store = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vendorStore.create({
        data: {
          ownerId: user.id,
          storeName: dto.storeName,
          slug: dto.slug,
          description: dto.description,
          fulfillmentMode: dto.fulfillmentMode ?? 'SELF_SHIP',
          status: StoreStatus.PENDING,
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, role: RoleName.VENDOR_OWNER, scopeId: created.id },
      });

      return created;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.create',
      entityType: 'VendorStore',
      entityId: store.id,
      afterState: { storeName: store.storeName, slug: store.slug, status: store.status },
    });

    return store;
  }

  async getMyStores(user: AuthenticatedUser) {
    return this.prisma.vendorStore.findMany({ where: { ownerId: user.id } });
  }

  /** File d'attente admin : boutiques à valider, les plus anciennes d'abord */
  async listPendingStores() {
    return this.prisma.vendorStore.findMany({
      where: { status: StoreStatus.PENDING },
      include: { owner: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Consultation publique : seules les boutiques ACTIVE sont visibles par
   * un tiers. Le propriétaire ou un admin voient toujours leur propre boutique
   * quel que soit son statut (utile pour suivre une demande en attente).
   */
  async getStoreById(storeId: string, requester?: AuthenticatedUser) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable');
    }

    const isOwner = requester?.id === store.ownerId;
    const isAdmin = requester?.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );

    if (store.status !== StoreStatus.ACTIVE && !isOwner && !isAdmin) {
      throw new NotFoundException('Boutique introuvable');
    }

    // La commission négociée est confidentielle : réservée au propriétaire et aux admins.
    if (!isOwner && !isAdmin) {
      const { commissionRate: _hidden, ...publicStore } = store;
      return publicStore;
    }

    return store;
  }

  /**
   * Mise à jour par le propriétaire uniquement — vérification de scope
   * explicite en plus du RolesGuard (défense en profondeur : un VENDOR_OWNER
   * ne doit jamais pouvoir modifier la boutique d'un autre vendeur, même
   * en forgeant l'ID dans l'URL).
   */
  async updateStore(user: AuthenticatedUser, storeId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable');
    }
    if (store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }

    const updated = await this.prisma.vendorStore.update({
      where: { id: storeId },
      data: dto,
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.update',
      entityType: 'VendorStore',
      entityId: storeId,
      beforeState: store,
      afterState: updated,
    });

    return updated;
  }

  /**
   * Décision admin : approbation, suspension, ou ajustement de commission
   * négociée. L'activation crée automatiquement les wallets USD et CDF du
   * vendeur (idempotent) — un vendeur ne peut recevoir aucun paiement tant
   * que ces wallets n'existent pas.
   */
  async reviewStore(admin: AuthenticatedUser, storeId: string, dto: ReviewStoreDto) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable');
    }

    if (dto.status === StoreStatus.ACTIVE) {
      const kycApproved = await this.prisma.kycDocument.findFirst({
        where: { userId: store.ownerId, type: 'VENDOR_LICENSE', status: 'APPROVED' },
      });
      if (!kycApproved) {
        throw new BadRequestException(
          "Impossible d'activer la boutique : le KYC vendeur n'est pas encore approuvé",
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const store2 = await tx.vendorStore.update({
        where: { id: storeId },
        data: {
          status: dto.status,
          commissionRate: dto.commissionRate ?? undefined,
        },
      });

      if (dto.status === StoreStatus.ACTIVE) {
        for (const currency of [Currency.USD, Currency.CDF]) {
          await tx.wallet.upsert({
            where: {
              ownerType_ownerId_currency: {
                ownerType: 'VENDOR',
                ownerId: storeId,
                currency,
              },
            },
            update: {},
            create: { ownerType: 'VENDOR', ownerId: storeId, currency, balance: 0 },
          });
        }
      }

      return store2;
    });

    await this.notifications.notifyUser({
      userId: store.ownerId,
      type: 'vendor_store.status_change',
      title:
        dto.status === StoreStatus.ACTIVE
          ? 'Votre boutique a été approuvée !'
          : 'Le statut de votre boutique a changé',
      body: dto.note ?? `Nouveau statut : ${dto.status}`,
      data: { storeId, status: dto.status },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'vendor_store.review',
      entityType: 'VendorStore',
      entityId: storeId,
      beforeState: { status: store.status, commissionRate: store.commissionRate },
      afterState: { status: updated.status, commissionRate: updated.commissionRate, note: dto.note },
    });

    return updated;
  }
}
