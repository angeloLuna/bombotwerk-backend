/*
  PRODUCTION-SAFE MIGRATION
  ==========================
  Manually edited from Prisma auto-generated migration.
  
  Changes from original:
  - Columns are NOT dropped until data is migrated
  - NOT NULL columns are added as nullable first, then backfilled
  - Data is copied from old columns to new columns before DROP
  - Duplicate check before unique index on Payment.providerPaymentId
  
  Backend availabilityMode values: stock_only | stock_and_made_to_order | made_to_order_only | discontinued
*/

-- ============================================================
-- PHASE 1: CREATE NEW ENUMS (safe, additive)
-- ============================================================

-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('catalog', 'editorial', 'detail', 'technical', 'styling', 'community');

-- CreateEnum
CREATE TYPE "ProductImageView" AS ENUM ('front', 'back', 'side', 'detail', 'not_applicable');


-- ============================================================
-- PHASE 2: DROP OLD FOREIGN KEYS (must happen before column type changes)
-- ============================================================

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";


-- ============================================================
-- PHASE 3: CREATE NEW TABLES (safe, additive)
-- ============================================================

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable: VariantImage
CREATE TABLE "VariantImage" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VariantImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariantImage_variantId_idx" ON "VariantImage"("variantId");

-- CreateTable: ProductImage
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "alt" TEXT,
    "type" "ProductImageType" NOT NULL DEFAULT 'catalog',
    "view" "ProductImageView" NOT NULL DEFAULT 'not_applicable',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");


-- ============================================================
-- PHASE 4: ADD NEW COLUMNS (safe, additive — all nullable or with defaults)
-- ============================================================

-- Collection: simple additions (nullable)
ALTER TABLE "Collection" ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "heroImageUrl" TEXT;

-- Customer: add userId FK column (nullable)
ALTER TABLE "Customer" ADD COLUMN "userId" TEXT;

-- Product: simple additions (with defaults)
ALTER TABLE "Product" ADD COLUMN "compareAtPrice" DECIMAL(65,30),
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- ProductVariant: add new columns BEFORE dropping old ones
ALTER TABLE "ProductVariant"
ADD COLUMN "availabilityMode" TEXT NOT NULL DEFAULT 'stock_only',
ADD COLUMN "colorHex" TEXT,
ADD COLUMN "madeToOrderMinDays" INTEGER DEFAULT 7,
ADD COLUMN "madeToOrderMaxDays" INTEGER DEFAULT 9;

-- Order: add ALL new columns first
-- NOTE: customerEmail is added as NULLABLE here, will be set NOT NULL after backfill
ALTER TABLE "Order"
ADD COLUMN "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "shippingTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN',
ADD COLUMN "customerEmail" TEXT,
ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "guestEmail" TEXT,
ADD COLUMN "userId" TEXT,
ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3),
ADD COLUMN "confirmationEmailStatus" TEXT,
ADD COLUMN "confirmationEmailError" TEXT,
ADD COLUMN "shippingLabel" TEXT DEFAULT 'Envío estándar',
ADD COLUMN "shippingNotes" TEXT,
ADD COLUMN "fulfillmentNotes" TEXT,
ADD COLUMN "isFreeShipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "freeShippingThreshold" DECIMAL(65,30) NOT NULL DEFAULT 1000,
ADD COLUMN "amountRemainingForFreeShipping" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "hasInStockItems" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasMadeToOrderItems" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isMixedFulfillmentCart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "splitShippingSelected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "splitShippingCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "estimatedDeliveryMinBusinessDays" INTEGER,
ADD COLUMN "estimatedDeliveryMaxBusinessDays" INTEGER,
ADD COLUMN "firstPackageEstimatedMinBusinessDays" INTEGER,
ADD COLUMN "firstPackageEstimatedMaxBusinessDays" INTEGER,
ADD COLUMN "secondPackageEstimatedMinBusinessDays" INTEGER,
ADD COLUMN "secondPackageEstimatedMaxBusinessDays" INTEGER;

-- Order: make customerId nullable (relax constraint)
ALTER TABLE "Order" ALTER COLUMN "customerId" DROP NOT NULL;

-- OrderItem: add new columns BEFORE dropping old ones
ALTER TABLE "OrderItem"
ADD COLUMN "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "productName" TEXT,
ADD COLUMN "variantName" TEXT,
ADD COLUMN "fulfillmentType" TEXT NOT NULL DEFAULT 'stock',
ADD COLUMN "madeToOrderMinDays" INTEGER,
ADD COLUMN "madeToOrderMaxDays" INTEGER;

-- OrderItem: make productId and variantId nullable
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "variantId" DROP NOT NULL;

-- Payment: add new columns
-- NOTE: updatedAt is added with a DEFAULT first, will remove default after backfill
ALTER TABLE "Payment"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'mercadopago',
ADD COLUMN "providerPaymentId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN',
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "rawResponse" JSONB,
ADD COLUMN "statusDetail" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Payment: relax method NOT NULL
ALTER TABLE "Payment" ALTER COLUMN "method" DROP NOT NULL;

-- Payment: update default status
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'pending';


-- ============================================================
-- PHASE 5: DATA MIGRATION (copy old → new before any DROP)
-- ============================================================

-- 5a. ProductVariant: map madeToOrderEnabled → availabilityMode
-- Values: stock_only | stock_and_made_to_order | made_to_order_only | discontinued
UPDATE "ProductVariant"
SET "availabilityMode" = CASE
    WHEN "madeToOrderEnabled" = true THEN 'made_to_order_only'
    ELSE 'stock_only'
END;

-- 5b. Order: copy totalAmount → total and subtotal (historical fallback)
UPDATE "Order"
SET "total" = COALESCE("totalAmount", 0),
    "subtotal" = COALESCE("totalAmount", 0),
    "shippingTotal" = COALESCE("shippingCost", 0);

-- 5c. Order: populate customerEmail from Customer.email where relationship exists
UPDATE "Order" o
SET "customerEmail" = c."email",
    "customerName" = c."name",
    "customerPhone" = c."phone"
FROM "Customer" c
WHERE o."customerId" = c."id"
  AND o."customerEmail" IS NULL;

-- 5d. Order: fallback for orphaned orders without a Customer link
UPDATE "Order"
SET "customerEmail" = 'sin-email@legacy.local'
WHERE "customerEmail" IS NULL;

-- 5e. OrderItem: copy price → unitPrice and compute total
UPDATE "OrderItem"
SET "unitPrice" = COALESCE("price", 0),
    "total" = COALESCE("price", 0) * "quantity";

-- 5f. Payment: backfill updatedAt from createdAt
UPDATE "Payment"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;


-- ============================================================
-- PHASE 6: ENFORCE NOT NULL (after data is populated)
-- ============================================================

-- Order.customerEmail: now safe to enforce NOT NULL
ALTER TABLE "Order" ALTER COLUMN "customerEmail" SET NOT NULL;

-- Payment.updatedAt: now safe to enforce NOT NULL
ALTER TABLE "Payment" ALTER COLUMN "updatedAt" SET NOT NULL;


-- ============================================================
-- PHASE 7: DROP OLD COLUMNS (data already copied)
-- ============================================================

-- Order: drop totalAmount (data now in "total" and "subtotal")
ALTER TABLE "Order" DROP COLUMN "totalAmount";

-- OrderItem: drop price (data now in "unitPrice" and "total")
ALTER TABLE "OrderItem" DROP COLUMN "price";

-- ProductVariant: drop madeToOrderEnabled (data now in "availabilityMode")
ALTER TABLE "ProductVariant" DROP COLUMN "madeToOrderEnabled";


-- ============================================================
-- PHASE 8: UNIQUE INDEX (with safety check)
-- ============================================================

-- Payment.providerPaymentId: deduplicate before unique index
-- This nullifies duplicates so the unique index can be created safely.
-- In practice, providerPaymentId is a new column so it should be all NULL,
-- but this guards against any edge case.
UPDATE "Payment" p1
SET "providerPaymentId" = NULL
FROM (
    SELECT "providerPaymentId"
    FROM "Payment"
    WHERE "providerPaymentId" IS NOT NULL
    GROUP BY "providerPaymentId"
    HAVING COUNT(*) > 1
) dupes
WHERE p1."providerPaymentId" = dupes."providerPaymentId";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");


-- ============================================================
-- PHASE 9: RE-CREATE FOREIGN KEYS (new behavior)
-- ============================================================

-- VariantImage → ProductVariant (CASCADE)
ALTER TABLE "VariantImage" ADD CONSTRAINT "VariantImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer → User (SET NULL)
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Order → Customer (SET NULL, was RESTRICT)
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Order → User (SET NULL)
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderItem → Order (CASCADE, was RESTRICT)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderItem → Product (SET NULL, was RESTRICT)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderItem → ProductVariant (SET NULL, was RESTRICT)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment → Order (CASCADE, was RESTRICT)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProductImage → Product (CASCADE)
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
