-- Per-user application access (deny-by-default). Managed by platform SUPER_ADMIN.

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserApplicationAccess" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationKey" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserApplicationAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserApplicationAccess_orgId_userId_applicationKey_key" ON "UserApplicationAccess"("orgId", "userId", "applicationKey");
CREATE INDEX IF NOT EXISTS "UserApplicationAccess_orgId_idx" ON "UserApplicationAccess"("orgId");
CREATE INDEX IF NOT EXISTS "UserApplicationAccess_userId_idx" ON "UserApplicationAccess"("userId");
CREATE INDEX IF NOT EXISTS "UserApplicationAccess_applicationKey_idx" ON "UserApplicationAccess"("applicationKey");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "UserApplicationAccess" ADD CONSTRAINT "UserApplicationAccess_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "UserApplicationAccess" ADD CONSTRAINT "UserApplicationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: preserve access to the stable Engineering app for every existing active member so
-- nobody is locked out on deploy. Business Operations (and any other installable app) is left
-- deny-by-default, so it is immediately hidden from members until a SUPER_ADMIN grants it.
INSERT INTO "UserApplicationAccess" ("id", "orgId", "userId", "applicationKey", "granted", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    m."orgId",
    m."userId",
    'engineering',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Membership" m
WHERE m."status" = 'ACTIVE'
ON CONFLICT ("orgId", "userId", "applicationKey") DO NOTHING;
