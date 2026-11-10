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

export interface ProductVariant {
  id: string;
  sku?: string | null;
  attributes?: Record<string, unknown> | null;
  priceOverride?: string | number | null;
  stockQty: number;
}

export interface Product {
  id: string;
  title: string;
  description?: string | null;
  basePriceUsd: string | number;
  basePriceCdf?: string | number;
  status?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  store: { id?: string; storeName: string; slug: string; ownerId?: string };
  category?: { id: string; name: string };
}

export interface VendorStore {
  id: string;
  storeName: string;
  slug: string;
  description?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  fulfillmentMode?: string;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface DeliveryJob {
  id: string;
  status: 'AWAITING_ASSIGNMENT' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';
  estimatedFee: string | number;
  distanceKm?: number;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  subOrder: {
    store: { storeName: string };
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
  | 'PROCESSING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: string | number;
  currency: Currency;
  subOrders: {
    id: string;
    store: { storeName: string };
    items: { id: string }[];
  }[];
}

export interface Cart {
  id: string;
  items: {
    id: string;
    quantity: number;
    unitPriceSnapshot: string | number;
    variant: {
      product: {
        title: string;
        images: ProductImage[];
      };
    };
  }[];
}

export type ConversationType = 'CUSTOMER_VENDOR' | 'CUSTOMER_DELIVERY' | 'SUPPORT';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  messages: ChatMessage[];
}

export interface AgentProfile {
  id: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  vehicleType?: string;
}
