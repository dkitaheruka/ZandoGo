import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateNegotiationDto, UpdateNegotiationDto } from './dto/negotiation.dto';

@Injectable()
export class NegotiationsService {
  constructor(private readonly prisma: PrismaService) {}

  private hasVendorStaffRole(user: AuthenticatedUser, storeId: string): boolean {
    return user.roles.some(
      (r) =>
        r.role === RoleName.ADMIN ||
        r.role === RoleName.SUPER_ADMIN ||
        ((r.role === RoleName.VENDOR_OWNER || r.role === RoleName.VENDOR_STAFF) &&
          r.scopeId === storeId),
    );
  }

  private mapNegotiation(row: any) {
    return {
      id: row.id,
      productId: row.productId,
      productTitle: row.product?.title || 'Article',
      productImage: row.product?.images?.[0]?.url || null,
      storeId: row.storeId,
      storeName: row.store?.storeName || 'Boutique',
      buyerId: row.buyerId,
      buyerName: row.buyer?.fullName || row.buyer?.email || 'Client ZandoGo',
      requestedQty: row.requestedQty,
      requestedPriceUsd: Number(row.requestedPriceUsd),
      agreedPriceUsd: row.agreedPriceUsd !== null && row.agreedPriceUsd !== undefined ? Number(row.agreedPriceUsd) : undefined,
      transportMode: row.transportMode || undefined,
      requestedDeliveryFeeUsd:
        row.requestedDeliveryFeeUsd !== null && row.requestedDeliveryFeeUsd !== undefined
          ? Number(row.requestedDeliveryFeeUsd)
          : undefined,
      destinationCity: row.destinationCity || undefined,
      notes: row.notes || undefined,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listMine(user: AuthenticatedUser) {
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    const staffStoreIds = user.roles
      .filter((r) => r.role === RoleName.VENDOR_STAFF && r.scopeId)
      .map((r) => r.scopeId as string);

    const rows = await this.prisma.priceNegotiation.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { buyerId: user.id },
              { store: { ownerId: user.id } },
              ...(staffStoreIds.length > 0 ? [{ storeId: { in: staffStoreIds } }] : []),
            ],
          },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            images: { orderBy: { position: 'asc' }, take: 1 },
          },
        },
        store: { select: { id: true, storeName: true, ownerId: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => this.mapNegotiation(r));
  }

  async create(user: AuthenticatedUser, dto: CreateNegotiationDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { store: true, images: { orderBy: { position: 'asc' }, take: 1 } },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }

    const row = await this.prisma.priceNegotiation.create({
      data: {
        productId: product.id,
        storeId: product.storeId,
        buyerId: user.id,
        requestedQty: dto.requestedQty ?? 1,
        requestedPriceUsd: dto.requestedPriceUsd,
        transportMode: dto.transportMode,
        requestedDeliveryFeeUsd: dto.requestedDeliveryFeeUsd,
        destinationCity: dto.destinationCity,
        notes: dto.notes,
        status: 'PENDING_VENDOR_REVIEW',
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            images: { orderBy: { position: 'asc' }, take: 1 },
          },
        },
        store: { select: { id: true, storeName: true, ownerId: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Créer ou alimenter automatiquement une conversation vendeur-acheteur
    if (product.store.ownerId && product.store.ownerId !== user.id) {
      let conv = await this.prisma.conversation.findFirst({
        where: {
          type: ConversationType.CUSTOMER_VENDOR,
          AND: [
            { participants: { some: { userId: user.id } } },
            { participants: { some: { userId: product.store.ownerId } } },
          ],
        },
      });
      if (!conv) {
        conv = await this.prisma.conversation.create({
          data: {
            type: ConversationType.CUSTOMER_VENDOR,
            metadata: {
              storeId: product.storeId,
              storeName: product.store.storeName,
              productId: product.id,
              productTitle: product.title,
              productImage: product.images[0]?.url || null,
              productPriceUsd: Number(product.basePriceUsd),
            },
            participants: {
              create: [{ userId: user.id }, { userId: product.store.ownerId }],
            },
          },
        });
      }
      await this.prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: user.id,
          content: `Demande de devis : ${row.requestedQty} × ${product.title} à $${Number(row.requestedPriceUsd).toFixed(2)}/u${row.destinationCity ? ` · Livraison : ${row.destinationCity}` : ''}${row.notes ? ` — "${row.notes}"` : ''}`,
          sourceLanguage: 'fr',
        },
      });
    }

    return this.mapNegotiation(row);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateNegotiationDto) {
    const existing = await this.prisma.priceNegotiation.findUnique({
      where: { id },
      include: {
        store: true,
        product: { select: { id: true, title: true, images: { take: 1 } } },
        buyer: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!existing) throw new NotFoundException('Négociation introuvable');

    const isOwnerOrStaff =
      existing.store.ownerId === user.id || this.hasVendorStaffRole(user, existing.storeId);
    if (!isOwnerOrStaff) {
      throw new ForbiddenException('Seul le vendeur concerné peut valider ou ajuster cette offre');
    }

    const updated = await this.prisma.priceNegotiation.update({
      where: { id },
      data: {
        ...(dto.agreedPriceUsd !== undefined ? { agreedPriceUsd: dto.agreedPriceUsd } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        store: true,
        product: { select: { id: true, title: true, images: { take: 1 } } },
        buyer: { select: { id: true, fullName: true, email: true } },
      },
    });

    return this.mapNegotiation(updated);
  }

  async acceptByBuyer(user: AuthenticatedUser, id: string) {
    const neg = await this.prisma.priceNegotiation.findUnique({
      where: { id },
      include: {
        product: { include: { variants: { take: 1 }, images: { take: 1 } } },
        store: true,
        buyer: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!neg) throw new NotFoundException('Négociation introuvable');
    if (neg.buyerId !== user.id) {
      throw new ForbiddenException('Cette négociation ne vous appartient pas');
    }
    if (neg.status !== 'ACCEPTED_BY_VENDOR' && neg.status !== 'CONVERTED_TO_ORDER') {
      throw new BadRequestException("Le vendeur n'a pas encore validé ce tarif");
    }

    const agreedPrice = Number(neg.agreedPriceUsd ?? neg.requestedPriceUsd);
    const defaultVariant = neg.product.variants[0];
    if (defaultVariant) {
      let cart = await this.prisma.cart.findUnique({ where: { customerId: user.id } });
      if (!cart) {
        cart = await this.prisma.cart.create({ data: { customerId: user.id } });
      }
      const existingItem = await this.prisma.cartItem.findFirst({
        where: { cartId: cart.id, productVariantId: defaultVariant.id },
      });
      if (existingItem) {
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: neg.requestedQty,
            unitPriceSnapshot: agreedPrice,
          },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productVariantId: defaultVariant.id,
            quantity: neg.requestedQty,
            unitPriceSnapshot: agreedPrice,
          },
        });
      }
    }

    const updated = await this.prisma.priceNegotiation.update({
      where: { id },
      data: { status: 'CONVERTED_TO_ORDER' },
      include: {
        store: true,
        product: { select: { id: true, title: true, images: { take: 1 } } },
        buyer: { select: { id: true, fullName: true, email: true } },
      },
    });

    return this.mapNegotiation(updated);
  }
}
