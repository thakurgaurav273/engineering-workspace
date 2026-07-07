-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultOrganizationId" TEXT,
ADD COLUMN     "lastActiveOrganizationId" TEXT;

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "managerId" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "joinedAt" TIMESTAMP(3),
    "invitedByMembershipId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSwitchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromOrgId" TEXT,
    "toOrgId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationSwitchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "defaultRole" "Role" NOT NULL DEFAULT 'MEMBER',
    "allowGuestAccess" BOOLEAN NOT NULL DEFAULT false,
    "invitationPolicy" TEXT NOT NULL DEFAULT 'admin_only',
    "onboardingDefaults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE INDEX "Membership_managerId_idx" ON "Membership"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "OrganizationSwitchLog_userId_createdAt_idx" ON "OrganizationSwitchLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_orgId_key" ON "OrganizationSettings"("orgId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSwitchLog" ADD CONSTRAINT "OrganizationSwitchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Data backfill: one ACTIVE Membership per existing User, mirroring their current
-- legacy orgId/role/department/jobTitle. managerId is remapped in a second pass since
-- it must point at the manager's *Membership* id, not their User id.
-- ============================================================

INSERT INTO "Membership" ("id", "userId", "orgId", "role", "status", "department", "jobTitle", "joinedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  u."orgId",
  u."role",
  'ACTIVE'::"MembershipStatus",
  u."department",
  u."jobTitle",
  u."createdAt",
  u."createdAt",
  u."updatedAt"
FROM "User" u
ON CONFLICT ("userId", "orgId") DO NOTHING;

-- Remap managerId: User.managerId (-> User.id) becomes Membership.managerId (-> Membership.id),
-- scoped to the same org (today's model already assumes a manager is in the same org).
-- (Postgres UPDATE...FROM can't reference the target table inside an explicit JOIN's ON
-- clause, so this uses a comma-join with everything in WHERE instead.)
UPDATE "Membership" m
SET "managerId" = mgr."id"
FROM "User" u, "Membership" mgr
WHERE m."userId" = u."id"
  AND u."managerId" IS NOT NULL
  AND mgr."userId" = u."managerId"
  AND mgr."orgId" = m."orgId";

-- Every existing user starts with their current org as both their default and
-- last-active org.
UPDATE "User"
SET "lastActiveOrganizationId" = "orgId",
    "defaultOrganizationId" = "orgId"
WHERE "lastActiveOrganizationId" IS NULL;
