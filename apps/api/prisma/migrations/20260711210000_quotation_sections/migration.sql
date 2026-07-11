-- Rich, ordered content sections for quotations (mirrors ProposalSection).
CREATE TABLE IF NOT EXISTS "QuotationSection" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuotationSection_quotationId_idx" ON "QuotationSection"("quotationId");

DO $$ BEGIN
    ALTER TABLE "QuotationSection" ADD CONSTRAINT "QuotationSection_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
