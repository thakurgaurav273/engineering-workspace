-- Business Operations: Tax configuration (Phase 3, module 4). Additive only.
-- Apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "TaxPriceMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');

-- CreateEnum
CREATE TYPE "TaxRoundingMode" AS ENUM ('NONE', 'NEAREST', 'UP', 'DOWN');

-- CreateTable
CREATE TABLE "TaxConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'IN_GST',
    "homeCountry" TEXT NOT NULL DEFAULT 'India',
    "defaultGstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "defaultVatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceMode" "TaxPriceMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "roundingMode" "TaxRoundingMode" NOT NULL DEFAULT 'NEAREST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxConfig_orgId_key" ON "TaxConfig"("orgId");

-- AddForeignKey
ALTER TABLE "TaxConfig" ADD CONSTRAINT "TaxConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
