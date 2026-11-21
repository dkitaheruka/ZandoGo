import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, RoleName, StoreStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { SetCommissionRuleDto } from './dto/set-commission-rule.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  // -------------------------------------------------------------------
  // Catégories & commission (ADMIN)
  // -------------------------------------------------------------------

  async createCategory(admin: AuthenticatedUser, dto: CreateCategoryDto) {
    const baseSlug =
      dto.slug?.trim() ||
      dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      `cat-${Date.now()}`;

    const existing = await this.prisma.category.findUnique({ where: { slug: baseSlug } });
    if (existing) {
      throw new ConflictException('Ce slug de catégorie est déjà utilisé');
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        slug: baseSlug,
        parentId: dto.parentId,
        icon: dto.icon,
      },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'category.create',
      entityType: 'Category',
      entityId: category.id,
      afterState: category,
    });

    return category;
  }

  async listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Définit le taux de commission d'une catégorie. Append-only : on ferme
   * la règle précédente (effectiveTo = maintenant) et on en crée une nouvelle,
   * pour ne jamais perdre l'historique des taux appliqués dans le temps
   * (indispensable puisque order_sub_orders.commissionRateApplied fige le
   * taux au moment de chaque commande passée).
   */
  async setCommissionRule(admin: AuthenticatedUser, dto: SetCommissionRuleDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new NotFoundException('Catégorie introuvable');
    }

    const rule = await this.prisma.$transaction(async (tx) => {
      await tx.commissionRule.updateMany({
        where: { categoryId: dto.categoryId, effectiveTo: null },
        data: { effectiveTo: new Date() },
      });

      return tx.commissionRule.create({
        data: {
          categoryId: dto.categoryId,
          commissionRate: dto.commissionRate,
          createdByAdminId: admin.id,
        },
      });
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'commission_rule.set',
      entityType: 'Category',
      entityId: dto.categoryId,
      afterState: { commissionRate: dto.commissionRate },
    });

    return rule;
  }

  /** Utilisé par le module orders pour figer le taux au moment de la commande */
  async getActiveCommissionRate(categoryId: string): Promise<number> {
    const rule = await this.prisma.commissionRule.findFirst({
      where: { categoryId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rule ? Number(rule.commissionRate) : 10; // 10% de secours si aucune règle définie
  }

  // -------------------------------------------------------------------
  // Produits & variantes (VENDOR_OWNER / VENDOR_STAFF)
  // -------------------------------------------------------------------

  private async assertStoreOwnership(userId: string, storeId: string) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable');
    }
    if (store.ownerId !== userId) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }
    return store;
  }

  private async resolveCdfPrice(basePriceUsd: number, basePriceCdf?: number): Promise<number> {
    if (basePriceCdf !== undefined) return basePriceCdf;

    const latestRate = await this.prisma.exchangeRate.findFirst({
      where: { fromCurrency: 'USD', toCurrency: 'CDF' },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!latestRate) {
      throw new BadRequestException(
        "Aucun taux de change USD→CDF n'a encore été saisi par un admin : impossible de calculer le prix en CDF",
      );
    }

    return basePriceUsd * Number(latestRate.rate);
  }

  async createProduct(user: AuthenticatedUser, storeId: string, dto: CreateProductDto) {
    const store = await this.assertStoreOwnership(user.id, storeId);

    if (store.status !== StoreStatus.ACTIVE) {
      throw new BadRequestException(
        'Votre boutique doit être activée par un admin avant de pouvoir publier des produits',
      );
    }

    const requestedType = (dto as { productType?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE' }).productType ?? 'PHYSICAL';
    const serviceSetting = await this.prisma.platformSetting.findUnique({
      where: { key: `store_services:${storeId}` },
    });
    const enabledServices = (serviceSetting?.value as { enabledServices?: string[] } | null)?.enabledServices;
    if (Array.isArray(enabledServices) && !enabledServices.includes(requestedType)) {
      throw new ForbiddenException(
        `Le service "${requestedType}" n'est pas encore activé sur cette boutique. Activez-le par Mobile Money ou Carte avant de publier.`,
      );
    }

    // Chaque image doit avoir été envoyée par CE compte (clé préfixée par son identifiant) :
    // sinon on pourrait rattacher à son produit l'image d'un autre vendeur. Vérifié avant
    // toute écriture en base.
    const imageKeys = dto.imageKeys ?? [];
    if (imageKeys.length > 3) {
      throw new BadRequestException(
        'Vous pouvez ajouter jusqu’à 3 photos maximum par produit.',
      );
    }
    for (const key of imageKeys) {
      this.uploads.assertOwnedKey(user, 'PRODUCT_IMAGE', key);
    }

    let videoUrl: string | undefined;
    if (dto.videoKey) {
      this.uploads.assertOwnedKey(user, 'PRODUCT_VIDEO', dto.videoKey);
      videoUrl = this.uploads.publicUrlFor(dto.videoKey);
    }

    const existingSlug = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException('Ce slug de produit est déjà utilisé');
    }

    const basePriceCdf = await this.resolveCdfPrice(dto.basePriceUsd, dto.basePriceCdf);

    const product = await this.prisma.product.create({
      data: {
        storeId,
        categoryId: dto.categoryId,
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        basePriceUsd: dto.basePriceUsd,
        basePriceCdf,
        videoUrl,
        videoDurationSec: videoUrl ? (dto.videoDurationSec ?? 10) : undefined,
        status: ProductStatus.DRAFT, // le vendeur doit explicitement passer en ACTIVE
        variants: {
          create: dto.variants.map((v) => ({
            sku: v.sku,
            attributes: v.attributes,
            priceOverride: v.priceOverride,
            stockQty: v.stockQty,
          })),
        },
        // L'ordre du tableau fixe l'ordre d'affichage : la première image sert de vignette
        images: {
          create: imageKeys.map((key, position) => ({
            url: this.uploads.publicUrlFor(key),
            position,
            altText: dto.imageAltTexts?.[position]?.trim() || undefined,
          })),
        },
      },
      include: { variants: true, images: { orderBy: { position: 'asc' } } },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'product.create',
      entityType: 'Product',
      entityId: product.id,
      afterState: { title: product.title, storeId, status: product.status },
    });

    return product;
  }

  async listStoreProducts(user: AuthenticatedUser, storeId: string) {
    await this.assertStoreOwnership(user.id, storeId);
    return this.prisma.product.findMany({
      where: { storeId },
      include: { images: { orderBy: { position: 'asc' } }, variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProduct(user: AuthenticatedUser, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    if (product.store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de ce produit");
    }

    const { imageKeys, imageAltTexts, videoKey, videoDurationSec, removeVideo, ...scalarPatch } = dto;

    if (imageKeys !== undefined) {
      if (imageKeys.length < 1 || imageKeys.length > 3) {
        throw new BadRequestException('Un produit doit contenir entre 1 et 3 photos.');
      }
      for (const key of imageKeys) {
        this.uploads.assertOwnedKey(user, 'PRODUCT_IMAGE', key);
      }
    }

    let nextVideoUrl: string | null | undefined;
    let nextVideoDurationSec: number | null | undefined;
    if (removeVideo) {
      nextVideoUrl = null;
      nextVideoDurationSec = null;
    } else if (videoKey) {
      this.uploads.assertOwnedKey(user, 'PRODUCT_VIDEO', videoKey);
      nextVideoUrl = this.uploads.publicUrlFor(videoKey);
      nextVideoDurationSec = videoDurationSec ?? 10;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (imageKeys !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
      }
      return tx.product.update({
        where: { id: productId },
        data: {
          ...scalarPatch,
          ...(nextVideoUrl !== undefined ? { videoUrl: nextVideoUrl, videoDurationSec: nextVideoDurationSec } : {}),
          ...(imageKeys !== undefined
            ? {
                images: {
                  create: imageKeys.map((key, position) => ({
                    url: this.uploads.publicUrlFor(key),
                    position,
                    altText: imageAltTexts?.[position]?.trim() || undefined,
                  })),
                },
              }
            : {}),
        },
        include: { images: { orderBy: { position: 'asc' } }, variants: true },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'product.update',
      entityType: 'Product',
      entityId: productId,
      beforeState: { basePriceUsd: product.basePriceUsd, status: product.status },
      afterState: { basePriceUsd: updated.basePriceUsd, status: updated.status },
    });

    return updated;
  }

  // -------------------------------------------------------------------
  // Consultation publique
  // -------------------------------------------------------------------

  private serializePublicProduct(p: any, now: Date) {
    const hasActiveAd =
      Boolean(p.store?.hasMonthlyAd) &&
      (!p.store?.monthlyAdUntil || new Date(p.store.monthlyAdUntil).getTime() > now.getTime());
    const hasActiveBoost = Boolean(p.boostedUntil && new Date(p.boostedUntil).getTime() > now.getTime());
    const hasActiveCampaign = Array.isArray(p.adCampaigns) && p.adCampaigns.length > 0;
    const isSponsored = hasActiveAd || hasActiveBoost || hasActiveCampaign || Boolean(p.isFeatured);
    const isCertified =
      Boolean(p.store?.isCertified) &&
      (!p.store?.certifiedUntil || new Date(p.store.certifiedUntil).getTime() > now.getTime());

    const { adCampaigns: _ads, ...rest } = p;
    return {
      ...rest,
      isSponsored,
      monthlyAdPlan: p.store?.monthlyAdPlan ?? 'NONE',
      adExpiresAt: p.store?.monthlyAdUntil ?? null,
      store: {
        ...p.store,
        isCertified,
        verifiedSupplier: isCertified,
        hasMonthlyAd: hasActiveAd,
      },
    };
  }

  async listSponsoredProducts() {
    const now = new Date();
    const rows = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        store: { status: StoreStatus.ACTIVE },
        OR: [
          {
            store: {
              hasMonthlyAd: true,
              OR: [{ monthlyAdUntil: null }, { monthlyAdUntil: { gt: now } }],
            },
          },
          { boostedUntil: { gt: now } },
          { isFeatured: true },
          {
            adCampaigns: {
              some: {
                status: 'ACTIVE',
                startAt: { lte: now },
                endAt: { gte: now },
              },
            },
          },
        ],
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: true,
        category: true,
        adCampaigns: {
          where: { status: 'ACTIVE', startAt: { lte: now }, endAt: { gte: now } },
          select: { id: true },
        },
        store: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            city: true,
            isCertified: true,
            certifiedUntil: true,
            hasMonthlyAd: true,
            monthlyAdPlan: true,
            monthlyAdUntil: true,
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 16,
    });

    const mapped = rows.map((p) => this.serializePublicProduct(p, now));
    mapped.sort((a, b) => {
      const adDiff = (b.store?.hasMonthlyAd ? 1 : 0) - (a.store?.hasMonthlyAd ? 1 : 0);
      if (adDiff !== 0) return adDiff;
      return (b.store?.isCertified ? 1 : 0) - (a.store?.isCertified ? 1 : 0);
    });
    return mapped;
  }

  async listProducts(params: { categoryId?: string; storeId?: string; search?: string }) {
    const now = new Date();
    const rows = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        store: { status: StoreStatus.ACTIVE },
        categoryId: params.categoryId,
        storeId: params.storeId,
        title: params.search ? { contains: params.search, mode: 'insensitive' } : undefined,
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: true,
        category: true,
        adCampaigns: {
          where: { status: 'ACTIVE', startAt: { lte: now }, endAt: { gte: now } },
          select: { id: true },
        },
        store: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            city: true,
            isCertified: true,
            certifiedUntil: true,
            hasMonthlyAd: true,
            monthlyAdPlan: true,
            monthlyAdUntil: true,
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 40,
    });

    const mapped = rows.map((p) => this.serializePublicProduct(p, now));
    mapped.sort((a, b) => {
      const adDiff = (b.isSponsored ? 1 : 0) - (a.isSponsored ? 1 : 0);
      if (adDiff !== 0) return adDiff;
      return (b.store?.isCertified ? 1 : 0) - (a.store?.isCertified ? 1 : 0);
    });
    return mapped;
  }

  async getProduct(productId: string, requester?: AuthenticatedUser) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: true,
        category: true,
        // Sélection explicite : cette route est publique, donc jamais de
        // `store: true` (cela exposerait commissionRate, négociée et confidentielle).
        // ownerId sert à contacter le vendeur via la messagerie.
        store: { select: { id: true, storeName: true, slug: true, ownerId: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    const isOwner = requester?.id === product.store.ownerId;
    const isAdmin = requester?.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );

    if (product.status !== ProductStatus.ACTIVE && !isOwner && !isAdmin) {
      throw new NotFoundException('Produit introuvable');
    }

    return product;
  }
}
