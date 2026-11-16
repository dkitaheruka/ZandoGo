import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  async getVendorAnalytics(user: AuthenticatedUser, storeId: string) {
    const store = await this.prisma.vendorStore.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Boutique introuvable');
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    if (!isAdmin && store.ownerId !== user.id) {
      throw new ForbiddenException("Vous n'avez pas accès aux analyses de cette boutique");
    }

    const subOrders = await this.prisma.orderSubOrder.findMany({
      where: { storeId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        order: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalRevenueUsd = subOrders.reduce((s, so) => s + Number(so.subtotal || 0), 0);
    const totalCommissionUsd = subOrders.reduce((s, so) => s + Number(so.commissionAmount || 0), 0);
    const totalOrders = subOrders.length;
    const paidOrders = subOrders.filter((so) =>
      ['PAID', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(so.order.status),
    ).length;

    const statusBuckets: Record<string, number> = {};
    subOrders.forEach((so) => {
      statusBuckets[so.status] = (statusBuckets[so.status] || 0) + 1;
    });

    const dailyMap = new Map<string, { label: string; revenueUsd: number; ordersCount: number }>();
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    days.forEach((d) => dailyMap.set(d, { label: d, revenueUsd: 0, ordersCount: 0 }));

    subOrders.forEach((so) => {
      const idx = (so.createdAt.getDay() + 6) % 7;
      const key = days[idx];
      const bucket = dailyMap.get(key)!;
      bucket.revenueUsd = Number((bucket.revenueUsd + Number(so.subtotal || 0)).toFixed(2));
      bucket.ordersCount += 1;
    });

    const productSales = new Map<string, { title: string; qty: number; revenueUsd: number }>();
    subOrders.forEach((so) => {
      so.items.forEach((it) => {
        const pTitle = it.variant?.product?.title || 'Produit';
        const cur = productSales.get(pTitle) || { title: pTitle, qty: 0, revenueUsd: 0 };
        cur.qty += it.quantity;
        cur.revenueUsd = Number((cur.revenueUsd + Number(it.unitPrice) * it.quantity).toFixed(2));
        productSales.set(pTitle, cur);
      });
    });

    return {
      storeId: store.id,
      storeName: store.storeName,
      kpis: {
        grossRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
        netVendorUsd: Number((totalRevenueUsd - totalCommissionUsd).toFixed(2)),
        platformCommissionUsd: Number(totalCommissionUsd.toFixed(2)),
        totalOrders,
        paidOrders,
        averageBasketUsd: totalOrders > 0 ? Number((totalRevenueUsd / totalOrders).toFixed(2)) : 0,
      },
      revenueSeries: Array.from(dailyMap.values()),
      statusBreakdown: Object.entries(statusBuckets).map(([label, value]) => ({ label, value })),
      topProducts: Array.from(productSales.values())
        .sort((a, b) => b.revenueUsd - a.revenueUsd)
        .slice(0, 5),
    };
  }

  async getAdminAnalytics() {
    const [orders, stores, disputes, pricing, txs] = await Promise.all([
      this.prisma.order.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.vendorStore.findMany(),
      this.prisma.dispute.findMany(),
      this.finance.getPlatformPricing(),
      this.prisma.paymentTransaction.findMany(),
    ]);

    const grossVolumeUsd = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const txFeeRate = Number(pricing.paymentTransactionFeePercent ?? 3.5) / 100;
    const totalTransactionFeesUsd = Number(
      txs
        .filter((t) => t.status === 'SUCCESS' && t.methodCode !== 'CASH_ON_DELIVERY')
        .reduce((s, t) => s + Number(t.amount) * (txFeeRate / (1 + txFeeRate)), 0)
        .toFixed(2),
    );

    const operatorCounts: Record<string, { label: string; count: number; volumeUsd: number }> = {};
    txs.forEach((t) => {
      const key = t.methodCode;
      if (!operatorCounts[key]) {
        operatorCounts[key] = { label: key, count: 0, volumeUsd: 0 };
      }
      operatorCounts[key].count += 1;
      operatorCounts[key].volumeUsd = Number((operatorCounts[key].volumeUsd + Number(t.amount)).toFixed(2));
    });

    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const weekly = days.map((label) => ({ label, revenueUsd: 0, ordersCount: 0 }));
    orders.forEach((o) => {
      const idx = (o.createdAt.getDay() + 6) % 7;
      weekly[idx].revenueUsd = Number((weekly[idx].revenueUsd + Number(o.total || 0)).toFixed(2));
      weekly[idx].ordersCount += 1;
    });

    return {
      kpis: {
        grossVolumeUsd: Number(grossVolumeUsd.toFixed(2)),
        totalOrders: orders.length,
        activeStores: stores.filter((s) => s.status === 'ACTIVE').length,
        totalStores: stores.length,
        openDisputes: disputes.filter((d) => d.status === 'OPEN').length,
        paymentTransactionFeePercent: pricing.paymentTransactionFeePercent,
        totalTransactionFeesUsd,
        allowImmediateVendorWithdrawal: pricing.allowImmediateVendorWithdrawal,
      },
      revenueSeries: weekly,
      paymentMethods: Object.values(operatorCounts),
      topStores: stores
        .slice(0, 6)
        .map((s) => ({
          id: s.id,
          storeName: s.storeName,
          commissionRate: Number(s.commissionRate),
          status: s.status,
          payoutBlocked: s.payoutBlocked,
        })),
    };
  }
}
