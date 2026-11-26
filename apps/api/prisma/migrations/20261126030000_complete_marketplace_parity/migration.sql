-- Complete Marketplace Parity Migration for ZandoGo (PostgreSQL 16)

-- 1. Auth verification codes (account OTP & password reset)
CREATE TABLE "auth_verification_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_verification_codes_userId_purpose_createdAt_idx"
  ON "auth_verification_codes"("userId", "purpose", "createdAt");

ALTER TABLE "auth_verification_codes"
  ADD CONSTRAINT "auth_verification_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Rich product metadata (type, pricing unit, B2B/B2C audience, volume tiers, digital & service fields)
ALTER TABLE "products"
  ADD COLUMN "productType" TEXT NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "pricingUnit" TEXT NOT NULL DEFAULT 'UNIT',
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'BOTH',
  ADD COLUMN "minOrderQty" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "priceTiers" JSONB,
  ADD COLUMN "digitalFileUrl" TEXT,
  ADD COLUMN "digitalFileName" TEXT,
  ADD COLUMN "digitalFileSize" TEXT,
  ADD COLUMN "serviceDuration" TEXT,
  ADD COLUMN "fulfillmentDetails" TEXT;

-- 3. Reviews: allow optional orderItemId and track verifiedPurchase
ALTER TABLE "reviews"
  ALTER COLUMN "orderItemId" DROP NOT NULL,
  ADD COLUMN "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false;

-- 4. B2B & Transport Price Negotiations
CREATE TABLE "price_negotiations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL DEFAULT 1,
    "requestedPriceUsd" DECIMAL(12,2) NOT NULL,
    "agreedPriceUsd" DECIMAL(12,2),
    "transportMode" TEXT,
    "requestedDeliveryFeeUsd" DECIMAL(10,2),
    "destinationCity" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VENDOR_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_negotiations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_negotiations_storeId_status_idx" ON "price_negotiations"("storeId", "status");
CREATE INDEX "price_negotiations_buyerId_status_idx" ON "price_negotiations"("buyerId", "status");

ALTER TABLE "price_negotiations"
  ADD CONSTRAINT "price_negotiations_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_negotiations"
  ADD CONSTRAINT "price_negotiations_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "vendor_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_negotiations"
  ADD CONSTRAINT "price_negotiations_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Orders payment & delivery option metadata
ALTER TABLE "orders"
  ADD COLUMN "deliveryOptionCode" TEXT,
  ADD COLUMN "paymentMethodCode" "PaymentMethodCode",
  ADD COLUMN "paymentRef" TEXT,
  ADD COLUMN "transactionFeePercent" DECIMAL(5,2),
  ADD COLUMN "chargedTotal" DECIMAL(14,2),
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- 6. Payout destination (Mobile Money / Bank reference)
ALTER TABLE "payout_requests"
  ADD COLUMN "destination" TEXT;

-- 7. Delivery fee negotiation & Google Maps coordinates
ALTER TABLE "deliveries"
  ADD COLUMN "negotiatedFeeUsd" DECIMAL(10,2),
  ADD COLUMN "feeNegotiationStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "clientGoogleMapsUrl" TEXT,
  ADD COLUMN "deliveryOptionCode" TEXT;

-- 8. Chat conversation & message structured metadata (location / delivery offers)
ALTER TABLE "conversations"
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "messages"
  ADD COLUMN "metadata" JSONB;
