-- Users can store a signature image, reused as the authorized-signatory signature on offers.
ALTER TABLE "User" ADD COLUMN "signatureUrl" TEXT;

-- Offer letters snapshot their authorized signatory so the sent document stays self-contained.
ALTER TABLE "OfferLetter" ADD COLUMN "signatoryUserId" TEXT;
ALTER TABLE "OfferLetter" ADD COLUMN "signatoryName" TEXT;
ALTER TABLE "OfferLetter" ADD COLUMN "signatoryDesignation" TEXT;
ALTER TABLE "OfferLetter" ADD COLUMN "signatureUrl" TEXT;
