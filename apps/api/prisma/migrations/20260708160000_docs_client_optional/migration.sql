-- Make client optional + add a free-text fallback client name on the three client-facing documents.

-- Invoice
ALTER TABLE "Invoice" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "clientName" TEXT;

-- Quotation
ALTER TABLE "Quotation" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Quotation" ADD COLUMN "clientName" TEXT;

-- Proposal
ALTER TABLE "Proposal" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Proposal" ADD COLUMN "clientName" TEXT;
