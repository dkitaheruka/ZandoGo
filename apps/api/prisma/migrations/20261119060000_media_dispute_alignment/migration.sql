-- Align PostgreSQL schema with current Prisma models (stores, products video, disputes freeze, MTN MoMo)

ALTER TYPE "PaymentMethodCode" ADD VALUE IF NOT EXISTS 'MOBILE_MONEY_MTN';

ALTER TABLE "vendor_stores"
  ADD COLUMN IF NOT EXISTS "payoutBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payoutBlockReason" TEXT,
  ADD COLUMN IF NOT EXISTS "isCertified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "certifiedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hasMonthlyAd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "monthlyAdPlan" TEXT,
  ADD COLUMN IF NOT EXISTS "monthlyAdUntil" TIMESTAMP(3);

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "videoDurationSec" INTEGER;

ALTER TABLE "disputes"
  ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "payoutFrozen" BOOLEAN NOT NULL DEFAULT false;
