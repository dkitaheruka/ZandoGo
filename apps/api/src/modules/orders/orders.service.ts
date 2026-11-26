import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PaymentMethodCode, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { evaluateCustomerDisputeEligibility } from '../../common/commerce-rules';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { CatalogService } from '../catalog/catalog.service';
import { PaymentsService } from '../payments/payments.service';
import { ChatService } from '../realtime/chat.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateSubOrderStatusDto } from './dto/update-suborder-status.dto';
import { buildOfficialInvoicePayload, OfficialInvoicePayload } from './invoice.helpers';

interface SubOrderDraft {
  storeId: string;
  subtotal: number;
  commissionAmount: number;
  commissionRateApplied: number;
  items: { productVariantId: string; quantity: number; unitPrice: number; totalPrice: number }[];
}

const PUBLIC_STORE_SELECT = { select: { id: true, storeName: true, slug: true, city: true } } as const;

const DELIVERY_FEE_BY_OPTION: Record<string, number> = {
  EXPRESS_MOTO: 3.5,
  PARTNER_LOGISTICS: 8.0,
  CLICK_AND_COLLECT: 0,
};

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
    private readonly payments: PaymentsService,
    private readonly chat: ChatService,
  ) {}

  private isOrderPaid(order: {
    status: string;
    paidAt?: Date | null;
    paymentTransactions?: { status: string }[];
  }): boolean {
    if (order.paidAt) return true;
    if (order.paymentTransactions?.some((t) => t.status === 'SUCCESS')) return true;
    return ['PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) &&
      order.status !== 'PROCESSING'
      ? true
      : Boolean(order.paymentTransactions?.some((t) => t.status === 'SUCCESS'));
  }

  private buildDigitalDownloadsForOrder(order: {
    id: string;
    status: string;
    paidAt?: Date | null;
    paymentTransactions?: { status: string }[];
    subOrders?: {
      items?: {
        variant?: {
          product?: {
            id: string;
            title: string;
            productType?: string;
            digitalFileName?: string | null;
            digitalFileSize?: string | null;
          };
        };
      }[];
    }[];
  }) {
    const paid = this.isOrderPaid(order);
    if (!paid) return [];

    const seen = new Set<string>();
    const downloads: {
      productId: string;
      title: string;
      fileName: string;
      fileSize?: string;
      downloadUrl: string;
    }[] = [];

    for (const so of order.subOrders || []) {
      for (const item of so.items || []) {
        const prod = item.variant?.product;
        if (!prod || prod.productType !== 'DIGITAL' || seen.has(prod.id)) continue;
        seen.add(prod.id);
        const token = this.catalog.signDigitalDownloadToken(prod.id, order.id);
        downloads.push({
          productId: prod.id,
          title: prod.title,
          fileName: prod.digitalFileName || `${prod.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`,
          fileSize: prod.digitalFileSize || undefined,
          downloadUrl: `/api/downloads/${prod.id}/${order.id}?token=${token}`,
        });
      }
    }

    return downloads;
  }

  private formatOrderSummary(order: any) {
    const paid = this.isOrderPaid(order);
    const latestTx = order.paymentTransactions?.[0];
    const allItems = (order.subOrders || []).flatMap((so: any) => so.items || []);
    const noDeliveryNeeded =
      allItems.length > 0 &&
      allItems.every((it: any) => it.variant?.product?.productType === 'DIGITAL');

    return {
      ...order,
      deliveryFee: Number(order.shippingFee ?? 0),
      isPaid: paid,
      paymentStatus: paid ? 'PAID' : latestTx?.status === 'PENDING' ? 'PENDING' : 'UNPAID',
      paymentOperator: order.paymentMethodCode || latestTx?.methodCode || undefined,
      paymentRef: order.paymentRef || latestTx?.providerReference || undefined,
      noDeliveryNeeded,
      digitalDownloads: this.buildDigitalDownloadsForOrder(order),
      subOrders: (order.subOrders || []).map((so: any) => {
        const mappedItems = (so.items || []).map((it: any) => ({
          ...it,
          productTitle: it.variant?.product?.title,
          productType: it.variant?.product?.productType,
          productImage: it.variant?.product?.images?.[0]?.url,
        }));
        return {
          ...so,
          items: mappedItems,
          productTitle: mappedItems[0]?.productTitle,
        };
      }),
    };
  }

  async checkout(user: AuthenticatedUser, dto: CheckoutDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { customerId: user.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { include: { store: true, images: { orderBy: { position: 'asc' }, take: 1 } } },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Le panier est vide');
    }

    const onlyDigital = cart.items.every(
      (item) => item.variant.product.productType === 'DIGITAL',
    );

    let address = null;
    if (!onlyDigital) {
      if (!dto.deliveryAddressId) {
        throw new BadRequestException('Adresse de livraison requise pour une commande physique ou service');
      }
      address = await this.prisma.address.findUnique({ where: { id: dto.deliveryAddressId } });
      if (!address || address.userId !== user.id) {
        throw new BadRequestException('Adresse de livraison invalide');
      }
    } else if (dto.deliveryAddressId) {
      address = await this.prisma.address.findUnique({ where: { id: dto.deliveryAddressId } });
      if (!address || address.userId !== user.id) {
        address = null;
      }
    }

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

    const deliveryOptionCode = onlyDigital ? 'DIGITAL_INSTANT' : dto.deliveryOptionId || 'EXPRESS_MOTO';
    const shippingFee = onlyDigital
      ? 0
      : DELIVERY_FEE_BY_OPTION[deliveryOptionCode] ?? 3.5;
    const total = Number((orderSubtotal + shippingFee).toFixed(2));

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
          deliveryAddressId: address?.id ?? null,
          deliveryOptionCode,
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
        include: { subOrders: { include: { items: true, store: PUBLIC_STORE_SELECT } } },
      });

      for (const item of cart.items) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

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

    let deliveryConversationId: string | undefined;
    let distanceKm: number | undefined;
    if (!onlyDigital) {
      if (address?.latitude && address?.longitude) {
        distanceKm = Number(
          haversineDistanceKm(-1.6741, 29.2285, address.latitude, address.longitude).toFixed(1),
        );
      }
      try {
        const conv = await this.chat.startConversation(user, {
          type: 'CUSTOMER_DELIVERY',
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeName: 'Livreur ZandoGo Express',
          productTitle: `Livraison ${order.orderNumber}`,
          productPriceUsd: shippingFee,
        });
        deliveryConversationId = conv.id;
      } catch {
        // Ne bloque jamais le checkout s'il n'y a pas encore de livreur disponible en base
      }
    }

    return {
      ...order,
      orderId: order.id,
      deliveryFee: shippingFee,
      noDeliveryNeeded: onlyDigital,
      deliveryConversationId,
      distanceKm,
      digitalDownloads: [],
    };
  }

  async getMyOrders(user: AuthenticatedUser) {
    const orders = await this.prisma.order.findMany({
      where: { customerId: user.id },
      include: {
        deliveryAddress: true,
        paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 2 },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        subOrders: {
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        productType: true,
                        digitalFileName: true,
                        digitalFileSize: true,
                        images: { orderBy: { position: 'asc' }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
            delivery: true,
            store: PUBLIC_STORE_SELECT,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => {
      const deliveredAt =
        order.subOrders.find((so) => so.delivery?.deliveredAt)?.delivery?.deliveredAt ??
        order.statusHistory.find((h) => h.toStatus === 'DELIVERED')?.createdAt ??
        order.paymentTransactions.find((t) => t.status === 'SUCCESS')?.confirmedAt ??
        order.createdAt;
      const disputeEligibility = evaluateCustomerDisputeEligibility({
        isCustomer: true,
        customerCity: order.deliveryAddress?.ville ?? order.deliveryAddress?.commune ?? null,
        vendorCities: order.subOrders.map((so) => so.store.city ?? null),
        referenceDate: deliveredAt,
      });

      const formatted = this.formatOrderSummary(order);
      return {
        ...formatted,
        disputeEligibility,
        subOrders: formatted.subOrders.map(withoutCommission),
      };
    });
  }

  async getOrder(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        deliveryAddress: true,
        paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 2 },
        subOrders: {
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        productType: true,
                        digitalFileName: true,
                        digitalFileSize: true,
                        images: { orderBy: { position: 'asc' }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
            delivery: true,
            store: PUBLIC_STORE_SELECT,
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const isCustomer = order.customerId === user.id;
    const isVendorOfSubOrder = order.subOrders.some((so) =>
      user.roles.some(
        (r) =>
          (r.role === RoleName.VENDOR_OWNER || r.role === RoleName.VENDOR_STAFF) &&
          r.scopeId === so.storeId,
      ),
    );
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );

    if (!isCustomer && !isVendorOfSubOrder && !isAdmin) {
      throw new ForbiddenException('Accès non autorisé à cette commande');
    }

    const deliveredAt =
      order.subOrders.find((so) => so.delivery?.deliveredAt)?.delivery?.deliveredAt ??
      order.statusHistory.find((h) => h.toStatus === 'DELIVERED')?.createdAt ??
      order.paymentTransactions.find((t) => t.status === 'SUCCESS')?.confirmedAt ??
      order.createdAt;
    const disputeEligibility = evaluateCustomerDisputeEligibility({
      isCustomer: isCustomer && !isVendorOfSubOrder,
      customerCity: order.deliveryAddress?.ville ?? order.deliveryAddress?.commune ?? null,
      vendorCities: order.subOrders.map((so) => so.store.city ?? null),
      referenceDate: deliveredAt,
    });

    const formatted = this.formatOrderSummary(order);

    if (isAdmin) return { ...formatted, disputeEligibility };

    if (isCustomer) {
      return { ...formatted, disputeEligibility, subOrders: formatted.subOrders.map(withoutCommission) };
    }

    const myStoreIds = new Set(
      user.roles
        .filter((r) => (r.role === RoleName.VENDOR_OWNER || r.role === RoleName.VENDOR_STAFF) && r.scopeId)
        .map((r) => r.scopeId),
    );
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      createdAt: order.createdAt,
      subOrders: formatted.subOrders.filter((so: any) => myStoreIds.has(so.storeId)),
    };
  }

  async payOrder(
    user: AuthenticatedUser,
    orderId: string,
    dto: { methodCode: PaymentMethodCode; phoneNumber?: string },
  ) {
    const result = await this.payments.initiatePayment(user, {
      orderId,
      methodCode: dto.methodCode,
      phoneNumber: dto.phoneNumber,
    });

    const refreshed = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        paymentTransactions: { where: { status: 'SUCCESS' }, orderBy: { createdAt: 'desc' }, take: 1 },
        subOrders: {
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        productType: true,
                        digitalFileName: true,
                        digitalFileSize: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      ...result,
      digitalDownloads: refreshed ? this.buildDigitalDownloadsForOrder(refreshed) : [],
    };
  }

  async releaseEscrow(user: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { subOrders: { include: { store: true } } },
    });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.customerId !== user.id) {
      throw new ForbiddenException("Cette commande ne vous appartient pas");
    }

    const openDispute = await this.prisma.dispute.findFirst({
      where: {
        orderId,
        status: { in: ['OPEN', 'AWAITING_VENDOR_RESPONSE', 'UNDER_ADMIN_REVIEW'] },
      },
    });
    if (openDispute) {
      throw new BadRequestException('Un litige est ouvert sur cette commande : libération impossible.');
    }

    const now = new Date();
    const releasableSubOrderIds = order.subOrders
      .filter((so) => !so.store.payoutBlocked)
      .map((so) => so.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });
      await tx.orderSubOrder.updateMany({ where: { orderId }, data: { status: 'DELIVERED' } });
      if (releasableSubOrderIds.length > 0) {
        await tx.walletTransaction.updateMany({
          where: {
            referenceType: 'ORDER_PAYOUT',
            referenceId: { in: releasableSubOrderIds },
            status: 'LOCKED',
          },
          data: { status: 'AVAILABLE', availableAt: now },
        });
      }
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'DELIVERED',
          changedByUserId: user.id,
          note: 'Réception confirmée par l’acheteur — fonds séquestre libérés au vendeur',
        },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'order.release_escrow',
      entityType: 'Order',
      entityId: orderId,
      afterState: { releasableSubOrderIds },
    });

    return { released: true, orderId };
  }

  async getOrderInvoice(user: AuthenticatedUser, orderId: string): Promise<OfficialInvoicePayload> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        deliveryAddress: true,
        paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 1 },
        subOrders: {
          include: {
            store: PUBLIC_STORE_SELECT,
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        productType: true,
                        digitalFileName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    const isCustomer = order.customerId === user.id;
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    if (!isCustomer && !isAdmin) {
      throw new ForbiddenException('Seul l’acheteur ou un administrateur peut télécharger la facture complète');
    }

    const latestRate = await this.prisma.exchangeRate.findFirst({
      where: { fromCurrency: 'USD', toCurrency: 'CDF' },
      orderBy: { effectiveFrom: 'desc' },
    });
    const pricingSetting =
      (await this.prisma.platformSetting.findUnique({ where: { key: 'vendor_pricing' } })) ??
      (await this.prisma.platformSetting.findUnique({ where: { key: 'platform_pricing' } }));
    const configuredFeePct = Number(
      (pricingSetting?.value as { paymentTransactionFeePercent?: number } | null)
        ?.paymentTransactionFeePercent ?? 3.5,
    );

    const latestPayment = order.paymentTransactions[0];
    const itemsSubtotalUsd = Number(order.subtotal ?? 0);
    const deliveryFeeUsd = Number(order.shippingFee ?? 0);
    const baseTotal = itemsSubtotalUsd + deliveryFeeUsd;
    const txAmount = latestPayment
      ? Number(latestPayment.amount)
      : order.chargedTotal
      ? Number(order.chargedTotal)
      : undefined;
    const txFeeAmount =
      txAmount !== undefined && txAmount > baseTotal ? Number((txAmount - baseTotal).toFixed(2)) : undefined;

    const items = order.subOrders.flatMap((so) =>
      so.items.map((item) => {
        const attrs =
          item.variant.attributes && typeof item.variant.attributes === 'object'
            ? (item.variant.attributes as Record<string, unknown>)
            : null;
        const variantParts = [attrs?.color, attrs?.size, attrs?.capacity]
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
        return {
          title: item.variant.product.title,
          storeName: so.store.storeName,
          variantLabel: variantParts.length > 0 ? variantParts.join(' · ') : item.variant.sku,
          productType: item.variant.product.productType,
          quantity: item.quantity,
          unitPriceUsd: Number(item.unitPrice),
          totalPriceUsd: Number(item.totalPrice),
        };
      }),
    );

    const isPaid = this.isOrderPaid(order);
    const digitalDownloads = this.buildDigitalDownloadsForOrder(order).map((d) => ({
      title: d.title,
      fileName: d.fileName,
    }));

    return buildOfficialInvoicePayload({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      currency: order.currency,
      createdAt: order.createdAt,
      paidAt: order.paidAt ?? latestPayment?.confirmedAt ?? null,
      subtotalUsd: itemsSubtotalUsd,
      deliveryFeeUsd,
      transactionFeePercent:
        (order.paymentMethodCode || latestPayment?.methodCode) === 'CASH_ON_DELIVERY'
          ? 0
          : order.transactionFeePercent !== null && order.transactionFeePercent !== undefined
          ? Number(order.transactionFeePercent)
          : configuredFeePct,
      transactionFeeAmountUsd: txFeeAmount,
      chargedTotalUsd: txAmount,
      exchangeRateUsdToCdf: latestPayment?.exchangeRateApplied
        ? Number(latestPayment.exchangeRateApplied)
        : latestRate
        ? Number(latestRate.rate)
        : 2850,
      isPaid,
      paymentMethodCode: order.paymentMethodCode || latestPayment?.methodCode || null,
      providerReference: order.paymentRef || latestPayment?.providerReference || null,
      buyer: {
        id: order.customer.id,
        fullName: order.customer.fullName,
        phone: order.customer.phone,
        email: order.customer.email,
      },
      deliveryAddress: order.deliveryAddress
        ? {
            commune: order.deliveryAddress.commune,
            quartier: order.deliveryAddress.quartier,
            ville: order.deliveryAddress.ville,
            referencePoint: order.deliveryAddress.referencePoint,
          }
        : null,
      stores: order.subOrders.map((so) => ({
        storeId: so.storeId,
        storeName: so.store.storeName,
        subtotalUsd: Number(so.subtotal),
      })),
      items,
      digitalDownloads: digitalDownloads.length > 0 ? digitalDownloads : undefined,
    });
  }

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
    const isStaff = user.roles.some(
      (r) => r.role === RoleName.VENDOR_STAFF && r.scopeId === subOrder.storeId,
    );
    if (subOrder.store.ownerId !== user.id && !isStaff) {
      throw new ForbiddenException("Vous n'êtes pas membre autorisé de cette boutique");
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
          toStatus: subOrder.order.status,
          changedByUserId: user.id,
          note: `Sous-commande ${subOrder.store.storeName} : ${dto.status}${dto.note ? ' — ' + dto.note : ''}`,
        },
      });

      return so;
    });

    return updated;
  }
}
