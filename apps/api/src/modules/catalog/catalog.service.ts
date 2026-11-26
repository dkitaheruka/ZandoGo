import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, ProductStatus, RoleName, StoreStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
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
    private readonly config: ConfigService,
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

  private async assertStoreAccess(user: AuthenticatedUser, storeId: string) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable');
    }
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    const isStaff = user.roles.some(
      (r) =>
        (r.role === RoleName.VENDOR_OWNER || r.role === RoleName.VENDOR_STAFF) &&
        r.scopeId === storeId,
    );
    if (store.ownerId !== user.id && !isStaff && !isAdmin) {
      throw new ForbiddenException("Vous n'avez pas accès à la gestion de cette boutique");
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
    const store = await this.assertStoreAccess(user, storeId);

    if (store.status !== StoreStatus.ACTIVE) {
      throw new BadRequestException(
        'Votre boutique doit être activée par un admin avant de pouvoir publier des produits',
      );
    }

    const requestedType = dto.productType ?? 'PHYSICAL';
    const serviceSetting = await this.prisma.platformSetting.findUnique({
      where: { key: `store_services:${storeId}` },
    });
    const enabledServices = (serviceSetting?.value as { enabledServices?: string[] } | null)?.enabledServices;
    if (Array.isArray(enabledServices) && !enabledServices.includes(requestedType)) {
      throw new ForbiddenException(
        `Le service "${requestedType}" n'est pas encore activé sur cette boutique. Activez-le par Mobile Money ou Carte avant de publier.`,
      );
    }

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

    let digitalFileUrl: string | undefined;
    if (dto.digitalFileKey) {
      this.uploads.assertOwnedKey(user, 'DIGITAL_DOCUMENT', dto.digitalFileKey);
      digitalFileUrl = dto.digitalFileKey;
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
        productType: requestedType,
        pricingUnit: dto.pricingUnit ?? 'UNIT',
        audience: dto.audience ?? 'BOTH',
        minOrderQty: dto.minOrderQty ?? 1,
        lowStockThreshold: dto.lowStockThreshold ?? 5,
        priceTiers: dto.priceTiers ? (dto.priceTiers as any) : undefined,
        digitalFileUrl,
        digitalFileName: dto.digitalFileName,
        digitalFileSize: dto.digitalFileSize,
        serviceDuration: dto.serviceDuration,
        fulfillmentDetails: dto.fulfillmentDetails,
        basePriceUsd: dto.basePriceUsd,
        basePriceCdf,
        videoUrl,
        videoDurationSec: videoUrl ? (dto.videoDurationSec ?? 10) : undefined,
        status: dto.status === 'DRAFT' ? ProductStatus.DRAFT : ProductStatus.ACTIVE,
        variants: {
          create: dto.variants.map((v) => ({
            sku: v.sku,
            attributes: v.attributes,
            priceOverride: v.priceOverride,
            stockQty: v.stockQty,
          })),
        },
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
    await this.assertStoreAccess(user, storeId);
    const rows = await this.prisma.product.findMany({
      where: { storeId },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      ...p,
      stockQty: p.variants.reduce((sum, v) => sum + (v.stockQty ?? 0), 0),
    }));
  }

  async updateProduct(user: AuthenticatedUser, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    await this.assertStoreAccess(user, product.storeId);

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

    const stockQty = Array.isArray(p.variants)
      ? p.variants.reduce((sum: number, v: any) => sum + Number(v.stockQty ?? 0), 0)
      : 0;
    const reviewList = Array.isArray(p.reviews) ? p.reviews : [];
    const reviewCount = reviewList.length;
    const rating =
      reviewCount > 0
        ? Number((reviewList.reduce((acc: number, r: any) => acc + Number(r.rating || 0), 0) / reviewCount).toFixed(1))
        : 4.8;

    const { adCampaigns: _ads, reviews: _reviews, ...rest } = p;
    return {
      ...rest,
      stockQty,
      rating,
      reviewCount,
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
        reviews: { select: { rating: true } },
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
        reviews: { select: { rating: true } },
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
        reviews: { select: { rating: true } },
        adCampaigns: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
        store: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            ownerId: true,
            city: true,
            isCertified: true,
            certifiedUntil: true,
            hasMonthlyAd: true,
            monthlyAdPlan: true,
            monthlyAdUntil: true,
          },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    const isOwner = requester?.id === product.store.ownerId;
    const isStaff = requester?.roles.some(
      (r) => r.role === RoleName.VENDOR_STAFF && r.scopeId === product.storeId,
    );
    const isAdmin = requester?.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );

    if (product.status !== ProductStatus.ACTIVE && !isOwner && !isStaff && !isAdmin) {
      throw new NotFoundException('Produit introuvable');
    }

    return this.serializePublicProduct(product, new Date());
  }

  async listProductReviews(productId: string) {
    const rows = await this.prisma.review.findMany({
      where: { productId },
      include: {
        customer: {
          select: {
            fullName: true,
            addresses: { where: { isDefault: true }, take: 1, select: { ville: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      authorName: r.customer?.fullName || 'Acheteur ZandoGo',
      city: r.customer?.addresses?.[0]?.ville || undefined,
      rating: r.rating,
      comment: r.comment || '',
      verifiedPurchase: Boolean(r.verifiedPurchase || r.orderItemId),
      createdAt: r.createdAt,
    }));
  }

  async addProductReview(
    user: AuthenticatedUser,
    productId: string,
    rating: number,
    comment: string,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produit introuvable');

    const paidItem = await this.prisma.orderItem.findFirst({
      where: {
        variant: { productId },
        review: null,
        subOrder: {
          order: {
            customerId: user.id,
            status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED] },
          },
        },
      },
      select: { id: true },
    });

    const created = await this.prisma.review.create({
      data: {
        productId,
        customerId: user.id,
        orderItemId: paidItem?.id,
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        comment: comment.trim(),
        verifiedPurchase: Boolean(paidItem),
      },
      include: {
        customer: {
          select: {
            fullName: true,
            addresses: { where: { isDefault: true }, take: 1, select: { ville: true } },
          },
        },
      },
    });

    return {
      id: created.id,
      productId: created.productId,
      authorName: created.customer?.fullName || user.fullName || 'Acheteur ZandoGo',
      city: created.customer?.addresses?.[0]?.ville || undefined,
      rating: created.rating,
      comment: created.comment || '',
      verifiedPurchase: created.verifiedPurchase,
      createdAt: created.createdAt,
    };
  }

  signDigitalDownloadToken(productId: string, orderId: string): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') || 'zandogo-download-fallback';
    return createHmac('sha256', secret).update(`${productId}:${orderId}`).digest('hex').slice(0, 32);
  }

  async getDigitalDownloadFile(
    productId: string,
    orderId: string,
    requester?: AuthenticatedUser | null,
    token?: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { fullName: true, email: true } },
        subOrders: {
          include: {
            items: {
              include: {
                variant: { include: { product: { include: { store: true } } } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Commande introuvable');

    const expectedToken = this.signDigitalDownloadToken(productId, orderId);
    const tokenValid = Boolean(
      token &&
        token.length === expectedToken.length &&
        timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken)),
    );
    const isAdmin = requester?.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    const isOwner = requester?.id === order.customerId;

    if (!tokenValid && !isOwner && !isAdmin) {
      throw new UnauthorizedException('Lien de téléchargement non autorisé');
    }

    if (order.status === OrderStatus.PENDING_PAYMENT || order.status === OrderStatus.CANCELLED) {
      throw new ForbiddenException('Le paiement doit être validé avant de télécharger ce document');
    }

    const matchedItem = order.subOrders
      .flatMap((so) => so.items)
      .find((item) => item.variant.productId === productId);

    if (!matchedItem) {
      throw new NotFoundException('Produit numérique non présent dans cette commande');
    }

    const product = matchedItem.variant.product;
    const fileName = product.digitalFileName || `${product.slug}.pdf`;

    if (product.digitalFileUrl && product.digitalFileUrl.startsWith('digital-books/')) {
      const storedBuffer = await this.uploads.readDigitalFileBuffer(product.digitalFileUrl);
      if (storedBuffer) {
        return { buffer: storedBuffer, fileName };
      }
    }

    const lines = [
      'ZANDOGO MARKETPLACE - DOCUMENT NUMERIQUE OFFICIEL',
      `Document : ${product.title}`,
      `Boutique : ${product.store?.storeName || 'Vendeur Certifie ZandoGo'}`,
      `Commande : ${order.orderNumber}`,
      `Licence attribuee a : ${order.customer?.fullName || order.customer?.email || 'Client ZandoGo'}`,
      `Date de delivrance : ${new Date().toISOString().slice(0, 10)}`,
      `Reference fichier : ${fileName}`,
      'Document certifie conforme - Usage personnel et professionnel autorise.',
    ];
    return { buffer: this.buildMinimalPdf(lines), fileName };
  }

  private buildMinimalPdf(lines: string[]): Buffer {
    const clean = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    const textOps = lines
      .map((line, i) => `BT /F1 ${i === 0 ? 14 : 11} Tf 50 ${760 - i * 26} Td (${clean(line)}) Tj ET`)
      .join('\n');

    const stream = `${textOps}\n`;
    const objects: string[] = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
      `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}endstream endobj\n`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    ];

    let body = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(body, 'utf8'));
      body += obj;
    }
    const xrefOffset = Buffer.byteLength(body, 'utf8');
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      body += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
    body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(body, 'utf8');
  }
}
