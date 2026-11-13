export type Currency = 'USD' | 'CDF';
export type UserRole = 'CUSTOMER' | 'VENDOR_OWNER' | 'VENDOR_STAFF' | 'DELIVERY_AGENT' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  preferredCurrency?: Currency;
  roles: { role: UserRole; scopeId?: string | null }[];
}

export interface Address {
  id: string;
  commune?: string | null;
  quartier: string;
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
  };
  category?: { id: string; name: string };
  rating?: number;
  reviewCount?: number;
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

export interface PlatformPricing {
  storeCreationFeeUsd: number;
  certificationMonthlyFeeUsd: number;
  certificationQuarterlyFeeUsd: number;
  adEssentialMonthlyFeeUsd: number;
  adProCarouselMonthlyFeeUsd: number;
  defaultCommissionPercent: number;
  updatedAt?: string;
}

export interface VendorStore {
  id: string;
  storeName: string;
  slug: string;
  description?: string | null;
  storeType?: 'RETAIL' | 'DIGITAL' | 'SERVICES' | 'LOGISTICS';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  fulfillmentMode?: string;
  commissionRate?: number;
  balanceUsd?: number;
  totalOrders?: number;
  payoutBlocked?: boolean;
  payoutBlockReason?: string | null;
  creationFeePaidUsd?: number;
  maishaPayRef?: string;
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

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  isPaid?: boolean;
  paymentStatus?: 'PAID' | 'UNPAID';
  paymentGateway?: 'MAISHAPAY' | 'CASH_ON_DELIVERY';
  maishaPayRef?: string;
  escrowStatus?: 'HELD' | 'RELEASED_TO_VENDOR' | 'REFUNDED_TO_BUYER';
  createdAt: string;
  total: string | number;
  deliveryFee?: number;
  noDeliveryNeeded?: boolean;
  deliveryNegotiationStatus?: 'NONE' | 'PENDING_DRIVER' | 'COUNTERED' | 'AGREED';
  deliveryAddress?: Address;
  currency: Currency;
  deliveryOption?: DeliveryOption;
  hasDigitalItems?: boolean;
  digitalDownloads?: {
    productId: string;
    title: string;
    downloadUrl: string;
    fileName: string;
  }[];
  smsDispatches?: SmsDispatchRecord[];
  subOrders: {
    id: string;
    store: { storeName: string };
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


