-- Business Operations: Invoice sub-types. Additive only.
-- Apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'PROFORMA', 'TAX', 'CREDIT_NOTE', 'DEBIT_NOTE', 'RECURRING', 'ADVANCE', 'FINAL_SETTLEMENT');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "invoiceType" "InvoiceType" NOT NULL DEFAULT 'STANDARD';
