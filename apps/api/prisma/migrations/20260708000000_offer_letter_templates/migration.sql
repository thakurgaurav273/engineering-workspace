-- Offer letter editable body + per-type clause templates. Additive only.

-- AlterTable
ALTER TABLE "OfferLetter" ADD COLUMN "bodyContent" TEXT;

-- CreateTable
CREATE TABLE "OfferLetterTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferLetterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferLetterTemplate_orgId_employmentType_key" ON "OfferLetterTemplate"("orgId", "employmentType");

-- AddForeignKey
ALTER TABLE "OfferLetterTemplate" ADD CONSTRAINT "OfferLetterTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
