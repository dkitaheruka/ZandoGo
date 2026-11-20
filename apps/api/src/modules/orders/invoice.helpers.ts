import { createHash } from 'crypto';
import { computePaymentTotals } from '../../common/commerce-rules';

export interface OfficialInvoiceItem {
  title: string;
  storeName: string;
  variantLabel?: string | null;
  productType?: string;
  quantity: number;
  unitPriceUsd: number;
  totalPriceUsd: number;
}

export interface OfficialInvoicePayload {
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  issuedAt: string;
  paidAt?: string | null;
  issuer: {
    name: string;
    city: string;
    country: string;
    supportEmail: string;
    legalNotice: string;
  };
  buyer: {
    id: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
  };
  deliveryAddress: {
    commune?: string | null;
    quartier?: string | null;
    ville?: string | null;
    referencePoint?: string | null;
    formatted: string;
  };
  payment: {
    status: string;
    methodCode: string;
    operatorLabel: string;
    providerReference: string;
    escrowStatus: string;
    paidAt?: string | null;
  };
  stores: { storeId: string; storeName: string; subtotalUsd: number }[];
  items: OfficialInvoiceItem[];
  totals: {
    currency: 'USD' | 'CDF';
    itemsSubtotalUsd: number;
    deliveryFeeUsd: number;
    transactionFeePercent: number;
    transactionFeeAmountUsd: number;
    chargedTotalUsd: number;
    exchangeRateUsdToCdf: number;
    chargedTotalCdf: number;
  };
  digitalDownloads?: { title: string; fileName: string }[];
  verification: {
    proofCode: string;
    algorithm: 'SHA-256';
    verifiedPurchase: boolean;
  };
}

export function formatInvoiceOperatorLabel(methodCode?: string | null): string {
  switch (methodCode) {
    case 'MOBILE_MONEY_MPESA':
      return 'Vodacom M-Pesa RDC';
    case 'MOBILE_MONEY_AIRTEL':
      return 'Airtel Money RDC';
    case 'MOBILE_MONEY_ORANGE':
      return 'Orange Money RDC';
    case 'MOBILE_MONEY_MTN':
      return 'MTN Mobile Money';
    case 'CARD_STRIPE':
      return 'Carte Bancaire (Visa / Mastercard)';
    case 'CASH_ON_DELIVERY':
      return 'Paiement Cash à la Livraison';
    default:
      return methodCode || 'ZandoGo Pay';
  }
}

export function computeInvoiceProofCode(params: {
  orderId: string;
  orderNumber: string;
  buyerId: string;
  chargedTotalUsd: number;
  providerReference: string;
  issuedAt: string;
}): string {
  const canonical = [
    params.orderId,
    params.orderNumber,
    params.buyerId,
    Number(params.chargedTotalUsd || 0).toFixed(2),
    params.providerReference || 'PENDING',
    params.issuedAt,
  ].join('|');
  const digest = createHash('sha256').update(canonical).digest('hex').slice(0, 16).toUpperCase();
  return `ZG-PROOF-${digest}`;
}

export function buildOfficialInvoicePayload(input: {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  currency: 'USD' | 'CDF';
  createdAt: string | Date;
  paidAt?: string | Date | null;
  subtotalUsd: number;
  deliveryFeeUsd: number;
  transactionFeePercent?: number;
  transactionFeeAmountUsd?: number;
  chargedTotalUsd?: number;
  exchangeRateUsdToCdf: number;
  isPaid: boolean;
  paymentMethodCode?: string | null;
  providerReference?: string | null;
  escrowStatus?: string | null;
  buyer: { id: string; fullName: string; phone?: string | null; email?: string | null };
  deliveryAddress?: {
    commune?: string | null;
    quartier?: string | null;
    ville?: string | null;
    referencePoint?: string | null;
  } | null;
  stores: { storeId: string; storeName: string; subtotalUsd: number }[];
  items: OfficialInvoiceItem[];
  digitalDownloads?: { title: string; fileName: string }[];
}): OfficialInvoicePayload {
  const issuedAt = new Date(input.paidAt ?? input.createdAt).toISOString();
  const paidAtIso = input.paidAt ? new Date(input.paidAt).toISOString() : null;
  const methodCode = input.paymentMethodCode || 'MOBILE_MONEY_MPESA';
  const isCod = methodCode === 'CASH_ON_DELIVERY';
  const baseTotal = Number((input.subtotalUsd + input.deliveryFeeUsd).toFixed(2));
  const computedCharges = computePaymentTotals(
    baseTotal,
    input.transactionFeePercent ?? (isCod ? 0 : 3.5),
    isCod,
  );
  const feePct =
    input.transactionFeePercent !== undefined
      ? Number(input.transactionFeePercent)
      : computedCharges.transactionFeePercent;
  const feeAmount =
    input.transactionFeeAmountUsd !== undefined
      ? Number(input.transactionFeeAmountUsd)
      : computedCharges.transactionFeeAmount;
  const chargedTotalUsd =
    input.chargedTotalUsd !== undefined
      ? Number(input.chargedTotalUsd)
      : computedCharges.chargedTotal;

  const rate = Math.max(1, Number(input.exchangeRateUsdToCdf || 2850));
  const chargedTotalCdf = Math.round(chargedTotalUsd * rate);
  const providerRef =
    input.providerReference || `ZG-REF-${input.orderNumber.replace(/[^A-Z0-9]/gi, '')}`;

  const addrParts = [
    input.deliveryAddress?.commune,
    input.deliveryAddress?.quartier,
    input.deliveryAddress?.ville || 'Goma, Nord-Kivu',
    input.deliveryAddress?.referencePoint,
  ]
    .map((p) => (p ? p.trim() : ''))
    .filter(Boolean);

  const defaultEscrow = input.isPaid
    ? input.orderStatus === 'DELIVERED' || input.orderStatus === 'COMPLETED'
      ? 'RELEASED_TO_VENDOR'
      : 'HELD'
    : 'PENDING_PAYMENT';

  return {
    invoiceNumber: `FAC-${input.orderNumber}`,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    orderStatus: input.orderStatus,
    issuedAt,
    paidAt: paidAtIso,
    issuer: {
      name: 'ZandoGo Marketplace RDC',
      city: 'Goma, Nord-Kivu',
      country: 'République Démocratique du Congo',
      supportEmail: 'support@zandogo.cd',
      legalNotice:
        'Document commercial officiel généré par ZandoGo RDC — Preuve d’achat, de paiement et de protection séquestre 48h.',
    },
    buyer: {
      id: input.buyer.id,
      fullName: input.buyer.fullName || 'Client ZandoGo',
      phone: input.buyer.phone || null,
      email: input.buyer.email || null,
    },
    deliveryAddress: {
      commune: input.deliveryAddress?.commune || null,
      quartier: input.deliveryAddress?.quartier || null,
      ville: input.deliveryAddress?.ville || 'Goma',
      referencePoint: input.deliveryAddress?.referencePoint || null,
      formatted: addrParts.length > 0 ? addrParts.join(' · ') : 'Retrait / Livraison numérique ZandoGo',
    },
    payment: {
      status: input.isPaid ? 'PAID' : 'UNPAID',
      methodCode,
      operatorLabel: formatInvoiceOperatorLabel(methodCode),
      providerReference: providerRef,
      escrowStatus: input.escrowStatus || defaultEscrow,
      paidAt: paidAtIso,
    },
    stores: input.stores,
    items: input.items,
    totals: {
      currency: input.currency,
      itemsSubtotalUsd: Number(input.subtotalUsd.toFixed(2)),
      deliveryFeeUsd: Number(input.deliveryFeeUsd.toFixed(2)),
      transactionFeePercent: feePct,
      transactionFeeAmountUsd: Number(feeAmount.toFixed(2)),
      chargedTotalUsd: Number(chargedTotalUsd.toFixed(2)),
      exchangeRateUsdToCdf: rate,
      chargedTotalCdf,
    },
    digitalDownloads: input.digitalDownloads,
    verification: {
      proofCode: computeInvoiceProofCode({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        buyerId: input.buyer.id,
        chargedTotalUsd,
        providerReference: providerRef,
        issuedAt,
      }),
      algorithm: 'SHA-256',
      verifiedPurchase: input.isPaid,
    },
  };
}
