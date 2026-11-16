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

  private getServiceFee(
    pricing: { servicePhysicalFeeUsd: number; serviceDigitalFeeUsd: number; servicePrestationFeeUsd: number },
    service: 'PHYSICAL' | 'DIGITAL' | 'SERVICE',
  ): number {
    if (service === 'DIGITAL') return Number(pricing.serviceDigitalFeeUsd ?? 0);
    if (service === 'SERVICE') return Number(pricing.servicePrestationFeeUsd ?? 0);
    return Number(pricing.servicePhysicalFeeUsd ?? 0);
  }

  private async getStoreServiceConfig(storeId: string): Promise<{
    enabledServices: ('PHYSICAL' | 'DIGITAL' | 'SERVICE')[];
    serviceFeesPaidUsd: Record<string, number>;
    isTransportAgency: boolean;
    transportDestinations: any[];
    immediateWithdrawalEnabled: boolean;
  }> {
    const [svcSetting, transportSetting, immediateSetting] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: `store_services:${storeId}` } }),
      this.prisma.platformSetting.findUnique({ where: { key: `store_transport:${storeId}` } }),
      this.prisma.platformSetting.findUnique({ where: { key: `store_immediate_withdrawal:${storeId}` } }),
    ]);
    const raw = (svcSetting?.value as any) ?? null;
    const tRaw = (transportSetting?.value as any) ?? null;
    const iRaw = (immediateSetting?.value as any) ?? null;
    return {
      enabledServices:
        raw && Array.isArray(raw.enabledServices) ? raw.enabledServices : ['PHYSICAL'],
      serviceFeesPaidUsd: raw?.serviceFeesPaidUsd ?? {},
      isTransportAgency: Boolean(tRaw?.isTransportAgency),
      transportDestinations: Array.isArray(tRaw?.transportDestinations)
        ? tRaw.transportDestinations
        : [],
      immediateWithdrawalEnabled: Boolean(iRaw?.enabled),
    };
  }

  /**
   * Un vendeur achète une ou plusieurs boutiques en choisissant un ou plusieurs
   * services payants (Bien physique, Livre/Document, Service) configurés par l'admin.
   */
  async createStore(user: AuthenticatedUser, dto: CreateStoreDto) {
    const existingSlug = await this.prisma.vendorStore.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException('Ce slug de boutique est déjà utilisé');
    }

    const enabledServices: ('PHYSICAL' | 'DIGITAL' | 'SERVICE')[] =
      dto.enabledServices && dto.enabledServices.length > 0
        ? Array.from(new Set(dto.enabledServices))
        : ['PHYSICAL'];

    const pricing = await this.finance.getPlatformPricing();
    const serviceFeesPaidUsd: Record<string, number> = {};
    let modulesFeeUsd = 0;
    for (const svc of enabledServices) {
      const fee = this.getServiceFee(pricing, svc);
      serviceFeesPaidUsd[svc] = fee;
      modulesFeeUsd += fee;
    }

    const creationFeeUsd = Number((pricing.storeCreationFeeUsd + modulesFeeUsd).toFixed(2));
    let paymentRef: string | undefined;

    if (creationFeeUsd > 0) {
      const payment = await this.maishaPay.initiatePayment({
        orderId: `store-${dto.slug}-${Date.now()}`,
        amount: creationFeeUsd,
        currency: 'USD',
        methodCode: dto.paymentMethod ?? 'MOBILE_MONEY_MPESA',
        customerPhone: dto.customerPhone,
        description: `Achat boutique ZandoGo : ${dto.storeName} (${enabledServices.join(', ')})`,
      });
      paymentRef = payment.providerReference;
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

      await tx.platformSetting.upsert({
        where: { key: `store_services:${created.id}` },
        update: { value: { enabledServices, serviceFeesPaidUsd } as any, updatedBy: user.id },
        create: {
          key: `store_services:${created.id}`,
          value: { enabledServices, serviceFeesPaidUsd } as any,
          updatedBy: user.id,
        },
      });

      if (dto.isTransportAgency || (dto.transportDestinations && dto.transportDestinations.length > 0)) {
        await tx.platformSetting.upsert({
          where: { key: `store_transport:${created.id}` },
          update: {
            value: {
              isTransportAgency: Boolean(dto.isTransportAgency),
              transportDestinations: dto.transportDestinations ?? [],
            } as any,
            updatedBy: user.id,
          },
          create: {
            key: `store_transport:${created.id}`,
            value: {
              isTransportAgency: Boolean(dto.isTransportAgency),
              transportDestinations: dto.transportDestinations ?? [],
            } as any,
            updatedBy: user.id,
          },
        });
      }

      return created;
    });

    if (dto.customerPhone) {
      await this.sms
        .sendSms(
          dto.customerPhone,
          `ZandoGo Goma : Boutique "${store.storeName}" achetée (${creationFeeUsd}$ · Réf ${paymentRef ?? ''}). Modules activés : ${enabledServices.join(', ')}.`,
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
        enabledServices,
        isTransportAgency: Boolean(dto.isTransportAgency),
        transportDestinations: dto.transportDestinations ?? [],
        feePaidUsd: creationFeeUsd,
        paymentRef,
      },
    });

    return {
      ...store,
      enabledServices,
      serviceFeesPaidUsd,
      isTransportAgency: Boolean(dto.isTransportAgency),
      transportDestinations: dto.transportDestinations ?? [],
      immediateWithdrawalEnabled: false,
      creationFeeUsd,
      paymentRef,
    };
  }

  async getMyStores(user: AuthenticatedUser) {
    const stores = await this.prisma.vendorStore.findMany({ where: { ownerId: user.id } });
    return Promise.all(
      stores.map(async (s) => {
        const svc = await this.getStoreServiceConfig(s.id);
        return { ...s, ...svc };
      }),
    );
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

    const svc = await this.getStoreServiceConfig(storeId);
    if (!isOwner && !isAdmin) {
      const { commissionRate: _hidden, ...publicStore } = store;
      return { ...publicStore, ...svc };
    }

    return { ...store, ...svc };
  }

  async activateStoreService(
    user: AuthenticatedUser,
    storeId: string,
    payload: {
      service: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
      paymentMethod?: string;
      customerPhone?: string;
    },
  ) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');
    if (store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }

    const validServices = ['PHYSICAL', 'DIGITAL', 'SERVICE'];
    if (!validServices.includes(payload.service)) {
      throw new BadRequestException('Module de service invalide');
    }

    const current = await this.getStoreServiceConfig(storeId);
    if (current.enabledServices.includes(payload.service)) {
      return {
        store: { ...store, ...current },
        activatedService: payload.service,
        feeUsd: 0,
      };
    }

    const pricing = await this.finance.getPlatformPricing();
    const feeUsd = this.getServiceFee(pricing, payload.service);
    const payment = await this.maishaPay.initiatePayment({
      orderId: `svc-${storeId}-${payload.service}-${Date.now()}`,
      amount: feeUsd,
      currency: 'USD',
      methodCode: payload.paymentMethod ?? 'MOBILE_MONEY_MPESA',
      customerPhone: payload.customerPhone,
      description: `Activation module ${payload.service} sur ${store.storeName}`,
    });

    const nextEnabled = [...current.enabledServices, payload.service];
    const nextFees = { ...current.serviceFeesPaidUsd, [payload.service]: feeUsd };

    await this.prisma.platformSetting.upsert({
      where: { key: `store_services:${storeId}` },
      update: { value: { enabledServices: nextEnabled, serviceFeesPaidUsd: nextFees } as any, updatedBy: user.id },
      create: {
        key: `store_services:${storeId}`,
        value: { enabledServices: nextEnabled, serviceFeesPaidUsd: nextFees } as any,
        updatedBy: user.id,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.activate_service',
      entityType: 'VendorStore',
      entityId: storeId,
      afterState: { service: payload.service, feeUsd, paymentRef: payment.providerReference },
    });

    return {
      store: { ...store, enabledServices: nextEnabled, serviceFeesPaidUsd: nextFees },
      activatedService: payload.service,
      feeUsd,
      paymentRef: payment.providerReference,
    };
  }

  async updateStore(user: AuthenticatedUser, storeId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable');
    }
    if (store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }

    const { isTransportAgency, transportDestinations, ...storeColumns } = dto;
    const updated = await this.prisma.vendorStore.update({
      where: { id: storeId },
      data: storeColumns,
    });

    if (isTransportAgency !== undefined || transportDestinations !== undefined) {
      const currentCfg = await this.getStoreServiceConfig(storeId);
      await this.prisma.platformSetting.upsert({
        where: { key: `store_transport:${storeId}` },
        update: {
          value: {
            isTransportAgency: isTransportAgency ?? currentCfg.isTransportAgency,
            transportDestinations: transportDestinations ?? currentCfg.transportDestinations,
          } as any,
          updatedBy: user.id,
        },
        create: {
          key: `store_transport:${storeId}`,
          value: {
            isTransportAgency: Boolean(isTransportAgency),
            transportDestinations: transportDestinations ?? [],
          } as any,
          updatedBy: user.id,
        },
      });
    }

    await this.audit.log({
      actorUserId: user.id,
      action: 'vendor_store.update',
      entityType: 'VendorStore',
      entityId: storeId,
      beforeState: store,
      afterState: updated,
    });

    const finalCfg = await this.getStoreServiceConfig(storeId);
    return { ...updated, ...finalCfg };
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
      afterState: { plan: normalizedPlan, feeUsd, paymentRef: payment.providerReference },
    });

    return { store: updated, paymentRef: payment.providerReference, feeUsd, plan: normalizedPlan };
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
      afterState: { billing, feeUsd, paymentRef: payment.providerReference },
    });

    return { store: updated, paymentRef: payment.providerReference, feeUsd };
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

  async setImmediateWithdrawal(admin: AuthenticatedUser, storeId: string, enabled: boolean) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');

    await this.prisma.platformSetting.upsert({
      where: { key: `store_immediate_withdrawal:${storeId}` },
      update: { value: { enabled } as any, updatedBy: admin.id },
      create: {
        key: `store_immediate_withdrawal:${storeId}`,
        value: { enabled } as any,
        updatedBy: admin.id,
      },
    });

    await this.notifications.notifyUser({
      userId: store.ownerId,
      type: 'vendor_store.immediate_withdrawal',
      title: enabled
        ? 'Retrait immédiat activé par le Super Admin'
        : 'Rétention standard 48h rétablie',
      body: enabled
        ? `Le Super Admin autorise désormais les retraits immédiats sur votre boutique « ${store.storeName} ».`
        : `Le délai standard de 48h à compter du paiement s’applique à « ${store.storeName} ».`,
      data: { storeId, immediateWithdrawalEnabled: enabled },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'vendor_store.immediate_withdrawal',
      entityType: 'VendorStore',
      entityId: storeId,
      afterState: { immediateWithdrawalEnabled: enabled },
    });

    const cfg = await this.getStoreServiceConfig(storeId);
    return { ...store, ...cfg };
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
