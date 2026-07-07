-- Offer letter templates gain a job-role dimension. Existing rows become the base
-- template for their employment type (jobRole = '').
ALTER TABLE "OfferLetterTemplate" ADD COLUMN "jobRole" TEXT NOT NULL DEFAULT '';

DROP INDEX "OfferLetterTemplate_orgId_employmentType_key";

CREATE UNIQUE INDEX "OfferLetterTemplate_orgId_employmentType_jobRole_key" ON "OfferLetterTemplate"("orgId", "employmentType", "jobRole");
