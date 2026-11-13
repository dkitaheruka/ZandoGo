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
import { FinanceService } from '../finance/finance.service';
import { MaishaPayService } from '../payments/maishapay.service';
import { AfricasTalkingSmsService } from '../realtime/africastalking-sms.service';
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
    private readonly finance: FinanceService,
    private readonly maishaPay: MaishaPayService,
    private readonly sms: AfricasTalkingSmsService,
  ) {}

  /**
   * Un vendeur achète une ou plusieurs boutiques en payant les frais configurés
   * par l'administrateur dans la console (jamais codés en dur), via MaishaPay RDC.
   */
  async createStore(user: AuthenticatedUser, dto: CreateStoreDto) {
    const existingSlug = await this.prisma.vendorStore.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException('Ce slug de boutique est déjà utilisé');
    }

    const pricing = await this.finance.getPlatformPricing();
    const creationFeeUsd = pricing.storeCreationFeeUsd;
    let maishaPayRef: string | undefined;

    if (creationFeeUsd > 0) {
      const payment = await this.maishaPay.initiatePayment({
        orderId: `store-${dto.slug}-${Date.now()}`,
        amount: creationFeeUsd,
        currency: 'USD',
        methodCode: dto.paymentMethod ?? 'MOBILE_MONEY_MPESA',
        customerPhone: dto.customerPhone,
        description: `Achat boutique ZandoGo : ${dto.storeName}`,
      });
      maishaPayRef = payment.providerReference;
    }

    const store = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vendorStore.create({
        data: {
          ownerId: user.id,
          storeName: dto.storeName,
          slug: dto.slug,
          description: dto.description,
          fulfillmentMode: dto.fulfillmentMode ?? 'SELF_SHIP',
          commissionRate: pricing.defaultCommissionPercent,
          status: StoreStatus.PENDING,
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, role: RoleName.VENDOR_OWNER, scopeId: created.id },
      });

      return created;
    });

    if (dto.customerPhone) {
      await this.sms
        .sendSms(
          dto.customerPhone,
          `ZandoGo RDC : Boutique "${store.storeName}" achetée (${creationFeeUsd}$ via MaishaPay ${maishaPayRef ?? ''}).`,
        )
        .catch(() => {});
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.create',
      entityType: 'VendorStore',
      entityId: store.id,
      afterState: {
        storeName: store.storeName,
        slug: store.slug,
        status: store.status,
        feePaidUsd: creationFeeUsd,
        maishaPayRef,
      },
    });

    return { ...store, creationFeeUsd, maishaPayRef };
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

    if (!isOwner && !isAdmin) {
      const { commissionRate: _hidden, ...publicStore } = store;
      return publicStore;
    }

    return store;
  }

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

  async subscribeMonthlyAd(user: AuthenticatedUser, storeId: string, plan: string) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');
    if (store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }

    const pricing = await this.finance.getPlatformPricing();
    const normalizedPlan = plan === 'ESSENTIAL_29' ? 'ESSENTIAL_29' : 'PRO_CAROUSEL_59';
    const feeUsd =
      normalizedPlan === 'ESSENTIAL_29'
        ? pricing.adEssentialMonthlyFeeUsd
        : pricing.adProCarouselMonthlyFeeUsd;

    const payment = await this.maishaPay.initiatePayment({
      orderId: `ad-${storeId}-${Date.now()}`,
      amount: feeUsd,
      currency: 'USD',
      methodCode: 'MOBILE_MONEY_MPESA',
      description: `Publicité mensuelle ZandoGo (${normalizedPlan})`,
    });

    const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.vendorStore.update({
      where: { id: storeId },
      data: {
        hasMonthlyAd: true,
        monthlyAdPlan: normalizedPlan,
        monthlyAdUntil: until,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.subscribe_ad',
      entityType: 'VendorStore',
      entityId: storeId,
      afterState: { plan: normalizedPlan, feeUsd, maishaPayRef: payment.providerReference },
    });

    return { store: updated, maishaPayRef: payment.providerReference, feeUsd, plan: normalizedPlan };
  }

  async subscribeCertification(user: AuthenticatedUser, storeId: string, billing: string) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');
    if (store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }

    const pricing = await this.finance.getPlatformPricing();
    const isQuarterly = billing === 'QUARTERLY';
    const feeUsd = isQuarterly
      ? pricing.certificationQuarterlyFeeUsd
      : pricing.certificationMonthlyFeeUsd;
    const days = isQuarterly ? 90 : 30;

    const payment = await this.maishaPay.initiatePayment({
      orderId: `cert-${storeId}-${Date.now()}`,
      amount: feeUsd,
      currency: 'USD',
      methodCode: 'MOBILE_MONEY_MPESA',
      description: `Certification Vendeur ZandoGo (${isQuarterly ? 'Trimestrielle' : 'Mensuelle'})`,
    });

    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.vendorStore.update({
      where: { id: storeId },
      data: {
        isCertified: true,
        certifiedUntil: until,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.subscribe_certification',
      entityType: 'VendorStore',
      entityId: storeId,
      afterState: { billing, feeUsd, maishaPayRef: payment.providerReference },
    });

    return { store: updated, maishaPayRef: payment.providerReference, feeUsd };
  }

  async setPayoutBlock(
    admin: AuthenticatedUser,
    storeId: string,
    blocked: boolean,
    reason?: string,
  ) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');

    const updated = await this.prisma.vendorStore.update({
      where: { id: storeId },
      data: {
        payoutBlocked: blocked,
        payoutBlockReason: blocked
          ? reason || 'Retraits bloqués suite à un litige client pertinent en cours d’examen.'
          : null,
      },
    });

    await this.notifications.notifyUser({
      userId: store.ownerId,
      type: blocked ? 'vendor_store.payout_blocked' : 'vendor_store.payout_unblocked',
      title: blocked
        ? 'Retraits temporairement bloqués sur votre boutique'
        : 'Retraits débloqués sur votre boutique',
      body:
        updated.payoutBlockReason ??
        'Vos demandes de retrait Mobile Money / banque sont de nouveau autorisées.',
      data: { storeId, payoutBlocked: blocked },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: blocked ? 'vendor_store.payout_block' : 'vendor_store.payout_unblock',
      entityType: 'VendorStore',
      entityId: storeId,
      afterState: { payoutBlocked: blocked, payoutBlockReason: updated.payoutBlockReason },
    });

    return updated;
  }

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
