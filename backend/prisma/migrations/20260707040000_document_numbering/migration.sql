-- Business Operations: Document Numbering (Phase 3, module 3). Additive only.
-- Apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "BusinessDocumentType" AS ENUM ('INVOICE', 'QUOTATION', 'OFFER_LETTER', 'PROPOSAL', 'PURCHASE_ORDER', 'RECEIPT', 'CREDIT_NOTE', 'DELIVERY_NOTE');

-- CreateEnum
CREATE TYPE "NumberResetMode" AS ENUM ('NEVER', 'YEARLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "DocumentNumberSequence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "documentType" "BusinessDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "suffix" TEXT NOT NULL DEFAULT '',
    "separator" TEXT NOT NULL DEFAULT '-',
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "resetMode" "NumberResetMode" NOT NULL DEFAULT 'NEVER',
    "useFinancialYear" BOOLEAN NOT NULL DEFAULT false,
    "periodKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentNumberSequence_orgId_documentType_key" ON "DocumentNumberSequence"("orgId", "documentType");

-- AddForeignKey
ALTER TABLE "DocumentNumberSequence" ADD CONSTRAINT "DocumentNumberSequence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
