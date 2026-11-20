export type Currency = 'USD' | 'CDF';
export type UserRole = 'CUSTOMER' | 'VENDOR_OWNER' | 'VENDOR_STAFF' | 'DELIVERY_AGENT' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  preferredCurrency?: Currency;
  preferredLanguage?: string;
  roles: { role: UserRole; scopeId?: string | null }[];
}

export interface Address {
  id: string;
  email?: string;
  commune?: string | null;
  quartier: string;
  ville?: string | null;
  referencePoint?: string | null;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  altText?: string | null;
}

export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

export type PricingUnit = 'UNIT' | 'KM' | 'HOUR' | 'FLAT';
export type AudienceSegment = 'WOMEN' | 'MEN' | 'UNISEX' | 'PRO';

export interface ProductVariant {
  id: string;
  sku?: string | null;
  name?: string;
  attributes?: {
    size?: string;
    color?: string;
    colorHex?: string;
    capacity?: string;
    [key: string]: unknown;
  } | null;
  priceOverride?: string | number | null;
  stockQty: number;
}

export interface PriceTier {
  minQty: number;
  maxQty?: number | null;
  unitPriceUsd: number;
  unitPriceCdf: number;
}

export interface NegotiationOffer {
  id: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  storeId: string;
  storeName: string;
  buyerId: string;
  buyerName: string;
  requestedQty: number;
  requestedPriceUsd: number;
  agreedPriceUsd?: number | null;
  transportMode?: string;
  requestedDeliveryFeeUsd?: number;
  agreedDeliveryFeeUsd?: number | null;
  destinationCity?: string;
  currency: Currency;
  status: 'PENDING_VENDOR_REVIEW' | 'ACCEPTED_BY_VENDOR' | 'REJECTED' | 'CONVERTED_TO_ORDER';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string | null;
  productType: ProductType;
  pricingUnit?: PricingUnit;
  audience?: AudienceSegment;
  isSponsored?: boolean;
  monthlyAdPlan?: 'NONE' | 'ESSENTIAL_29' | 'PRO_CAROUSEL_59';
  adExpiresAt?: string | null;
  basePriceUsd: string | number;
  basePriceCdf?: string | number;
  status?: string;
  minOrderQty?: number;
  priceTiers?: PriceTier[];
  stockQty?: number;
  lowStockThreshold?: number;
  digitalFileUrl?: string | null;
  digitalFileName?: string | null;
  digitalFileSize?: string | null;
  serviceDuration?: string | null;
  fulfillmentDetails?: string | null;
  images: ProductImage[];
  videoUrl?: string | null;
  videoDurationSec?: number | null;
  variants: ProductVariant[];
  store: {
    id?: string;
    storeName: string;
    slug: string;
    ownerId?: string;
    rating?: number;
    city?: string;
    verifiedSupplier?: boolean;
    isCertified?: boolean;
    hasMonthlyAd?: boolean;
    isTransportAgency?: boolean;
    transportDestinations?: TransportDestination[];
  };
  category?: { id: string; name: string };
  rating?: number;
  reviewCount?: number;
}

export interface TransportDestination {
  id: string;
  originCity: string;
  destinationCity: string;
  basePriceUsd: number;
  pricePerKmUsd?: number;
  estimatedDelay: string;
  vehicleMode: string;
}

export interface DeliveryOption {
  id: string;
  providerName: string;
  code: 'EXPRESS_MOTO' | 'PARTNER_LOGISTICS' | 'CLICK_AND_COLLECT';
  name: string;
  estimatedTime: string;
  feeUsd: number;
  feeCdf: number;
  description: string;
  badgeText?: string;
}

export type StoreServiceModule = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

export interface PlatformPricing {
  storeCreationFeeUsd: number;
  servicePhysicalFeeUsd: number;
  serviceDigitalFeeUsd: number;
  servicePrestationFeeUsd: number;
  certificationMonthlyFeeUsd: number;
  certificationQuarterlyFeeUsd: number;
  adEssentialMonthlyFeeUsd: number;
  adProCarouselMonthlyFeeUsd: number;
  defaultCommissionPercent: number;
  paymentTransactionFeePercent: number;
  allowImmediateVendorWithdrawal: boolean;
  updatedAt?: string;
}

export interface VendorStore {
  id: string;
  storeName: string;
  slug: string;
  city?: string;
  description?: string | null;
  storeType?: 'RETAIL' | 'DIGITAL' | 'SERVICES' | 'LOGISTICS';
  enabledServices?: StoreServiceModule[];
  serviceFeesPaidUsd?: Record<string, number>;
  isTransportAgency?: boolean;
  transportDestinations?: TransportDestination[];
  immediateWithdrawalEnabled?: boolean;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  fulfillmentMode?: string;
  commissionRate?: number;
  balanceUsd?: number;
  totalOrders?: number;
  payoutBlocked?: boolean;
  payoutBlockReason?: string | null;
  creationFeePaidUsd?: number;
  paymentRef?: string;
  paymentOperator?: string;
  isCertified?: boolean;
  certificationStatus?: 'NONE' | 'ACTIVE' | 'EXPIRED';
  certificationFeeUsd?: number;
  certifiedUntil?: string | null;
  hasMonthlyAd?: boolean;
  monthlyAdPlan?: 'NONE' | 'ESSENTIAL_29' | 'PRO_CAROUSEL_59';
  monthlyAdFeeUsd?: number;
  monthlyAdUntil?: string | null;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  channel?: 'IN_APP' | 'SMS_AFRICASTALKING';
  smsRecipient?: string;
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
}

export interface DeliveryJob {
  id: string;
  status: 'AWAITING_ASSIGNMENT' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  estimatedFee: string | number;
  negotiatedFeeUsd?: number;
  feeNegotiationStatus?: 'NONE' | 'PENDING_DRIVER' | 'COUNTERED' | 'AGREED';
  distanceKm?: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  clientGoogleMapsUrl?: string;
  otpCode?: string;
  deliveryProof?: { proofType: 'PHOTO' | 'SIGNATURE' | 'OTP_CODE'; fileUrl?: string; recordedAt: string };
  agent?: { id?: string; vehicleType?: string; user: { fullName: string; phone?: string } } | null;
  trackingPings?: { lat: number; lng: number; recordedAt: string }[];
  subOrder: {
    store: { storeName: string; city?: string };
    order: {
      id: string;
      orderNumber: string;
      total: string | number;
      currency: Currency;
      deliveryAddress?: Address;
      paymentTransactions: { methodCode: string; status: string }[];
    };
  };
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'ESCROW_HELD'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface SmsDispatchRecord {
  id: string;
  provider: 'AFRICASTALKING';
  to: string;
  message: string;
  sentAt: string;
}

export interface DisputeEligibility {
  canOpenDispute: boolean;
  sameCity: boolean;
  customerCity?: string | null;
  vendorCity?: string | null;
  windowHours: number;
  deadlineAt?: string | null;
  hoursRemaining: number;
  reasonIfBlocked?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  isPaid?: boolean;
  paymentStatus?: 'PAID' | 'UNPAID';
  paymentGateway?: 'MOBILE_MONEY' | 'CARD' | 'CASH_ON_DELIVERY';
  paymentOperator?: string;
  paymentRef?: string;
  escrowStatus?: 'HELD' | 'RELEASED_TO_VENDOR' | 'REFUNDED_TO_BUYER';
  paidAt?: string;
  deliveredAt?: string;
  escrowReleaseAt?: string;
  disputeEligibility?: DisputeEligibility;
  createdAt: string;
  total: string | number;
  transactionFeePercent?: number;
  transactionFeeAmount?: number;
  chargedTotal?: number;
  deliveryFee?: number;
  noDeliveryNeeded?: boolean;
  deliveryNegotiationStatus?: 'NONE' | 'PENDING_DRIVER' | 'COUNTERED' | 'AGREED';
  deliveryAddress?: Address;
  currency: Currency;
  deliveryOption?: DeliveryOption;
  deliveryProof?: { proofType: 'PHOTO' | 'SIGNATURE' | 'OTP_CODE'; fileUrl?: string; recordedAt: string };
  hasDigitalItems?: boolean;
  digitalDownloads?: {
    productId: string;
    title: string;
    downloadUrl: string;
    fileName: string;
    token?: string;
    autoDispatched?: boolean;
    autoDispatchedAt?: string;
    fileUrl?: string;
  }[];
  smsDispatches?: SmsDispatchRecord[];
  subOrders: {
    id: string;
    storeId?: string;
    status?: string;
    autoFulfilled?: boolean;
    store: { id?: string; storeName: string; city?: string };
    items: {
      id: string;
      quantity?: number;
      productTitle?: string;
      unitPrice?: number;
      productType?: ProductType;
      pricingUnit?: PricingUnit;
      variantName?: string;
    }[];
  }[];
}

export interface Cart {
  id: string;
  items: {
    id: string;
    quantity: number;
    unitPriceSnapshot: string | number;
    variant: {
      id?: string;
      name?: string;
      attributes?: { size?: string; color?: string; colorHex?: string; [key: string]: unknown } | null;
      product: {
        id?: string;
        title: string;
        productType?: ProductType;
        pricingUnit?: PricingUnit;
        images: ProductImage[];
      };
    };
  }[];
}

export type ConversationType = 'CUSTOMER_VENDOR' | 'CUSTOMER_DELIVERY' | 'SUPPORT';

export interface SharedLocation {
  lat: number;
  lng: number;
  label?: string;
  googleMapsUrl: string;
  distanceKm?: number;
}

export interface DeliveryFeeProposal {
  feeUsd: number;
  originalFeeUsd?: number;
  distanceKm?: number;
  status: 'PROPOSED' | 'COUNTERED' | 'ACCEPTED';
  proposedBy: 'CUSTOMER' | 'DRIVER';
  orderId?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string | null;
  sourceLanguage?: string;
  translations?: Record<string, string>;
  translationEngine?: string;
  translationModel?: string;
  location?: SharedLocation;
  deliveryProposal?: DeliveryFeeProposal;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  orderId?: string;
  orderNumber?: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  productPriceUsd?: number;
  storeName?: string;
  distanceKm?: number;
  clientLocation?: SharedLocation;
  deliveryNegotiation?: {
    orderId?: string;
    originalFeeUsd: number;
    proposedFeeUsd: number;
    agreedFeeUsd?: number | null;
    status: 'NONE' | 'PENDING_DRIVER' | 'COUNTERED' | 'AGREED';
    proposedBy?: 'CUSTOMER' | 'DRIVER';
    distanceKm?: number;
  };
  negotiationOffer?: NegotiationOffer;
  messages: ChatMessage[];
}

export interface AgentProfile {
  id: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  vehicleType?: string;
  currentLat?: number;
  currentLng?: number;
}

export interface ProductReview {
  id: string;
  productId: string;
  authorName: string;
  city?: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface PayoutRequestRecord {
  id: string;
  amountUsd: number;
  method: string;
  destination: string;
  status: 'REQUESTED' | 'PAID' | 'REJECTED';
  createdAt: string;
}

export interface WalletSummary {
  storeId?: string;
  storeName?: string;
  availableBalanceUsd: number;
  lockedEscrowUsd: number;
  totalEarnedUsd: number;
  currency: Currency;
  immediateWithdrawalAuthorized?: boolean;
  payoutBlocked?: boolean;
  payoutBlockReason?: string | null;
  blockingDisputes?: { id: string; orderNumber: string; reason: string }[];
  payouts: PayoutRequestRecord[];
}

export interface ExchangeRateHistoryItem {
  id: string;
  rate: number;
  effectiveFrom: string;
}

export interface ExchangeRatePayload {
  rate: number;
  currencyPair: string;
  updatedAt: string;
  history?: ExchangeRateHistoryItem[];
}

export interface AnalyticsRevenuePoint {
  label: string;
  revenueUsd: number;
  ordersCount: number;
}

export interface AnalyticsSegmentItem {
  label: string;
  value: number;
  color?: string;
}

export interface VendorAnalyticsPayload {
  storeId: string;
  storeName: string;
  kpis: {
    grossRevenueUsd: number;
    netVendorUsd: number;
    platformCommissionUsd: number;
    totalOrders: number;
    paidOrders: number;
    averageBasketUsd: number;
  };
  revenueSeries: AnalyticsRevenuePoint[];
  productTypeBreakdown: AnalyticsSegmentItem[];
  statusBreakdown: AnalyticsSegmentItem[];
  topProducts: { title: string; qty: number; revenueUsd: number }[];
}

export interface AdminAnalyticsPayload {
  kpis: {
    grossVolumeUsd: number;
    totalOrders: number;
    activeStores: number;
    totalStores: number;
    openDisputes: number;
    paymentTransactionFeePercent: number;
    totalTransactionFeesUsd: number;
    platformCommissionEarnedUsd: number;
    allowImmediateVendorWithdrawal: boolean;
  };
  revenueSeries: AnalyticsRevenuePoint[];
  paymentMethods: { label: string; count: number; volumeUsd: number; color?: string }[];
  storeRevenueSeries: { label: string; revenueUsd: number; ordersCount: number }[];
  regionalBreakdown: AnalyticsSegmentItem[];
}

export interface OfficialInvoice {
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
  items: {
    title: string;
    storeName: string;
    variantLabel?: string | null;
    productType?: string;
    quantity: number;
    unitPriceUsd: number;
    totalPriceUsd: number;
  }[];
  totals: {
    currency: Currency;
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


