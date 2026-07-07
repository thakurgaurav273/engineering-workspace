-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CHECK_IN_BLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'WEEKLY_REVIEW_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'WEEKLY_DIGEST';

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "checkInBlockers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weeklyDigest" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Recognition" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: UserPreference.weeklyDigest / notifyCheckInBlockers are moving to the
-- equivalent (now functional) NotificationPreference columns added above - carry each
-- user's existing toggle state forward instead of silently resetting everyone to the
-- column default before the old columns are dropped below. notifyNewRecognition /
-- notifyReviewRequests / showMenteeSuggestions have no counterpart to backfill into:
-- like autoShareRecognition below, they were settings-page fields that were never read
-- anywhere, so there's nothing behavioral to preserve for them.
INSERT INTO "NotificationPreference" ("id", "userId", "weeklyDigest", "checkInBlockers", "updatedAt")
SELECT gen_random_uuid()::text, up."userId", up."weeklyDigest", up."notifyCheckInBlockers", CURRENT_TIMESTAMP
FROM "UserPreference" up
ON CONFLICT ("userId") DO UPDATE SET
  "weeklyDigest" = EXCLUDED."weeklyDigest",
  "checkInBlockers" = EXCLUDED."checkInBlockers";

-- AlterTable
ALTER TABLE "UserPreference" DROP COLUMN "notifyCheckInBlockers",
DROP COLUMN "notifyNewRecognition",
DROP COLUMN "notifyReviewRequests",
DROP COLUMN "showMenteeSuggestions",
DROP COLUMN "weeklyDigest",
ADD COLUMN     "reminderTime" TEXT NOT NULL DEFAULT '16:30',
ADD COLUMN     "weeklyReviewReminderDay" INTEGER NOT NULL DEFAULT 5,
ALTER COLUMN "autoShareRecognition" SET DEFAULT true;


-- Backfill: autoShareRecognition was previously a non-functional toggle (never read
-- anywhere), so any existing value is meaningless. Force everyone to true so newly-wired
-- recognition privacy doesn't silently make anyone's future recognitions private.
UPDATE "UserPreference" SET "autoShareRecognition" = true;
