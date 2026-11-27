import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(customerId: string) {
    return this.prisma.cart.upsert({
      where: { customerId },
      update: {},
      create: { customerId, currency: 'USD' },
    });
  }

  async getCart(user: AuthenticatedUser) {
    const cart = await this.getOrCreateCart(user.id);
    return this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    // Jamais `store: true` : cela exposerait commissionRate au client
                    store: { select: { id: true, storeName: true, slug: true } },
                    images: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async addItem(user: AuthenticatedUser, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.productVariantId },
      include: { product: true },
    });
    if (!variant || variant.product.status !== 'ACTIVE') {
      throw new NotFoundException('Article introuvable ou indisponible');
    }
    const cart = await this.getOrCreateCart(user.id);
    const unitPrice = variant.priceOverride ?? variant.product.basePriceUsd;

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productVariantId: dto.productVariantId },
    });
    const requestedQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (variant.stockQty < requestedQuantity) {
      throw new BadRequestException('Stock insuffisant pour la quantité demandée');
    }

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + dto.quantity },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productVariantId: dto.productVariantId,
        quantity: dto.quantity,
        unitPriceSnapshot: unitPrice,
      },
    });
  }

  async updateItem(user: AuthenticatedUser, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item) throw new NotFoundException('Article introuvable');
    if (item.cart.customerId !== user.id) {
      throw new ForbiddenException("Cet article n'appartient pas à votre panier");
    }
    return this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
  }

  async removeItem(user: AuthenticatedUser, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item) throw new NotFoundException('Article introuvable');
    if (item.cart.customerId !== user.id) {
      throw new ForbiddenException("Cet article n'appartient pas à votre panier");
    }
    return this.prisma.cartItem.delete({ where: { id: itemId } });
  }
}
