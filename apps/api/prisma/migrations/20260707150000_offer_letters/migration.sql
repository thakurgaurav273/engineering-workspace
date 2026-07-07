-- Business Operations: Offer Letters (Phase 3, module 9). Additive only.
-- HR document for a candidate; non-financial. Number reserved at SEND via the
-- shared DocumentNumberingService('OFFER_LETTER'). Apply with `prisma migrate deploy`.

-- CreateEnum
CREATE TYPE "OfferLetterStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');

-- CreateTable
CREATE TABLE "OfferLetter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" TEXT,
    "status" "OfferLetterStatus" NOT NULL DEFAULT 'DRAFT',
    "offerDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "candidateAddress" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "reportingManager" TEXT,
    "startDate" TIMESTAMP(3),
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "workLocation" TEXT,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "variablePay" DOUBLE PRECISION,
    "salaryBreakdown" TEXT,
    "benefits" TEXT,
    "noticePeriod" TEXT,
    "probationPeriod" TEXT,
    "termsAndConditions" TEXT,
    "additionalNotes" TEXT,
    "companySnapshot" JSONB,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferLetter_orgId_status_idx" ON "OfferLetter"("orgId", "status");
CREATE INDEX "OfferLetter_orgId_candidateEmail_idx" ON "OfferLetter"("orgId", "candidateEmail");

-- AddForeignKey
ALTER TABLE "OfferLetter" ADD CONSTRAINT "OfferLetter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
