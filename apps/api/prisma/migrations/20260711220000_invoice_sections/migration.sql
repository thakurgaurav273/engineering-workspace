-- Rich, ordered content sections for invoices (mirrors QuotationSection).
CREATE TABLE IF NOT EXISTS "InvoiceSection" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceSection_invoiceId_idx" ON "InvoiceSection"("invoiceId");

DO $$ BEGIN
    ALTER TABLE "InvoiceSection" ADD CONSTRAINT "InvoiceSection_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
