import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateSubOrderStatusDto } from './dto/update-suborder-status.dto';

// Sous-commande calculée avant écriture en base : un tableau non typé laissait TypeScript
// deviner la forme, et plus rien ne garantissait que les montants calculés soient complets.
interface SubOrderDraft {
  storeId: string;
  subtotal: number;
  commissionAmount: number;
  commissionRateApplied: number;
  items: { productVariantId: string; quantity: number; unitPrice: number; totalPrice: number }[];
}

// Champs de boutique visibles par un client : jamais commissionRate (négociée, confidentielle).
const PUBLIC_STORE_SELECT = { select: { id: true, storeName: true, slug: true } } as const;

/**
 * La commission prélevée par la plateforme n'est destinée ni au client ni à
 * l'acheteur d'un autre vendeur : seuls le vendeur concerné et les admins
 * la voient.
 */
function withoutCommission<T extends object>(subOrder: T) {
  const { commissionAmount: _a, commissionRateApplied: _r, ...rest } = subOrder as T & {
    commissionAmount?: unknown;
    commissionRateApplied?: unknown;
  };
  return rest;
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(2).toString('hex').toUpperCase();
  return `CMD-${stamp}-${random}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
  ) {}

  /**
   * Transforme le panier en commande. Une commande peut regrouper des
   * produits de plusieurs vendeurs : on crée une sous-commande (`OrderSubOrder`)
   * par vendeur, avec son propre taux de commission FIGÉ au moment T
   * (jamais recalculé rétroactivement, même si le taux de la catégorie
   * change ensuite — c'est le principe de traçabilité comptable).
   */
  async checkout(user: AuthenticatedUser, dto: CheckoutDto) {
    const address = await this.prisma.address.findUnique({ where: { id: dto.deliveryAddressId } });
    if (!address || address.userId !== user.id) {
      throw new BadRequestException('Adresse de livraison invalide');
    }

    const cart = await this.prisma.cart.findUnique({
      where: { customerId: user.id },
      include: {
        items: { include: { variant: { include: { product: { include: { store: true } } } } } },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Le panier est vide');
    }

    // Vérification du stock avant toute écriture
    for (const item of cart.items) {
      if (item.variant.stockQty < item.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour "${item.variant.product.title}" (${item.variant.stockQty} restant(s))`,
        );
      }
      if (item.variant.product.status !== 'ACTIVE' || item.variant.product.store.status !== 'ACTIVE') {
        throw new BadRequestException(`"${item.variant.product.title}" n'est plus disponible`);
      }
    }

    // Regroupement par boutique
    const itemsByStore = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const storeId = item.variant.product.storeId;
      const list = itemsByStore.get(storeId) ?? [];
      list.push(item);
      itemsByStore.set(storeId, list);
    }

    const orderNumber = generateOrderNumber();
    let orderSubtotal = 0;

    const subOrdersData: SubOrderDraft[] = [];
    for (const [storeId, items] of itemsByStore) {
      const store = items[0].variant.product.store;
      let subTotal = 0;
      let commissionAmount = 0;
      const orderItemsData = [];

      for (const item of items) {
        const unitPrice = Number(item.unitPriceSnapshot);
        const totalPrice = unitPrice * item.quantity;
        subTotal += totalPrice;

        const categoryId = item.variant.product.categoryId;
        const rate =
          store.commissionRate !== null
            ? Number(store.commissionRate)
            : await this.catalog.getActiveCommissionRate(categoryId);

        commissionAmount += totalPrice * (rate / 100);

        orderItemsData.push({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
      }

      const commissionRateApplied = subTotal > 0 ? (commissionAmount / subTotal) * 100 : 0;
      orderSubtotal += subTotal;

      subOrdersData.push({
        storeId,
        subtotal: subTotal,
        commissionAmount,
        commissionRateApplied,
        items: orderItemsData,
      });
    }

    const shippingFee = 0; // calculé par le module delivery lors de l'assignation
    const total = orderSubtotal + shippingFee;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId: user.id,
          status: 'PENDING_PAYMENT',
          currency: dto.currency,
          subtotal: orderSubtotal,
          shippingFee,
          platformFee: 0,
          total,
          deliveryAddressId: dto.deliveryAddressId,
          subOrders: {
            create: subOrdersData.map((so) => ({
              storeId: so.storeId,
              status: 'PENDING',
              subtotal: so.subtotal,
              commissionAmount: so.commissionAmount,
              commissionRateApplied: so.commissionRateApplied,
              items: { create: so.items },
            })),
          },
          statusHistory: {
            create: { toStatus: 'PENDING_PAYMENT', changedByUserId: user.id, note: 'Commande créée' },
          },
        },
        include: { subOrders: { include: { items: true } } },
      });

      // Décrémente le stock de chaque variante
      for (const item of cart.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      // Vide le panier
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'order.create',
      entityType: 'Order',
      entityId: order.id,
      afterState: { orderNumber, total, subOrdersCount: order.subOrders.length },
    });

    return order;
  }

  async getMyOrders(user: AuthenticatedUser) {
    const orders = await this.prisma.order.findMany({
      where: { customerId: user.id },
      include: { subOrders: { include: { items: true, store: PUBLIC_STORE_SELECT } } },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => ({
      ...order,
      subOrders: order.subOrders.map(withoutCommission),
    }));
  }

  async getOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        subOrders: { include: { items: true, store: PUBLIC_STORE_SELECT } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const isCustomer = order.customerId === user.id;
    const isVendorOfSubOrder = order.subOrders.some((so) =>
      user.roles.some((r) => r.role === RoleName.VENDOR_OWNER && r.scopeId === so.storeId),
    );
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );

    if (!isCustomer && !isVendorOfSubOrder && !isAdmin) {
      throw new ForbiddenException('Accès non autorisé à cette commande');
    }

    // Ordre de priorité volontaire : admin > client > vendeur. Quelqu'un qui est à la
    // fois client et vendeur de la même commande reçoit la vue la plus restrictive
    // sur les commissions (celle du client).
    if (isAdmin) return order;

    if (isCustomer) {
      return { ...order, subOrders: order.subOrders.map(withoutCommission) };
    }

    // Vendeur : uniquement SES sous-commandes. Il ne voit ni les articles et montants
    // des autres vendeurs d'une commande multi-vendeur, ni le total global, ni
    // l'historique (dont les notes citent les autres boutiques).
    const myStoreIds = new Set(
      user.roles.filter((r) => r.role === RoleName.VENDOR_OWNER && r.scopeId).map((r) => r.scopeId),
    );
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      createdAt: order.createdAt,
      subOrders: order.subOrders.filter((so) => myStoreIds.has(so.storeId)),
    };
  }

  /**
   * Le vendeur ne peut faire progresser que PENDING → PROCESSING → SHIPPED.
   * Le passage à DELIVERED est réservé au module delivery (preuve de
   * livraison obligatoire), jamais déclaré manuellement par le vendeur.
   */
  async updateSubOrderStatus(
    user: AuthenticatedUser,
    subOrderId: string,
    dto: UpdateSubOrderStatusDto,
  ) {
    if (dto.status === 'DELIVERED') {
      throw new BadRequestException(
        'Le statut "DELIVERED" ne peut être déclenché que par une preuve de livraison confirmée (module livraison)',
      );
    }

    const subOrder = await this.prisma.orderSubOrder.findUnique({
      where: { id: subOrderId },
      include: { store: true, order: true },
    });
    if (!subOrder) throw new NotFoundException('Sous-commande introuvable');
    if (subOrder.store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'êtes pas propriétaire de cette boutique");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const so = await tx.orderSubOrder.update({
        where: { id: subOrderId },
        data: { status: dto.status },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: subOrder.orderId,
          fromStatus: subOrder.order.status,
          toStatus: subOrder.order.status, // le statut global de la commande est recalculé séparément
          changedByUserId: user.id,
          note: `Sous-commande ${subOrder.store.storeName} : ${dto.status}${dto.note ? ' — ' + dto.note : ''}`,
        },
      });

      return so;
    });

    return updated;
  }
}
