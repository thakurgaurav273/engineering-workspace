-- Per-team workflow states replace the fixed IssueStatus enum. Every existing team gets the
-- six defaults, each issue is pointed at its team's state of the same name, then the old
-- column and enum are dropped.

-- CreateEnum
CREATE TYPE "IssueStateCategory" AS ENUM ('BACKLOG', 'UNSTARTED', 'STARTED', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "IssueState" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" "IssueStateCategory" NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueState_orgId_teamId_idx" ON "IssueState"("orgId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueState_teamId_name_key" ON "IssueState"("teamId", "name");

-- AddForeignKey
ALTER TABLE "IssueState" ADD CONSTRAINT "IssueState_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueState" ADD CONSTRAINT "IssueState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: default workflow for every team (same set TeamsService seeds for new teams).
-- The old enum value is kept in a temp column to map issues across.
ALTER TABLE "IssueState" ADD COLUMN "legacyStatus" TEXT;
INSERT INTO "IssueState" ("id", "orgId", "teamId", "name", "color", "category", "position", "updatedAt", "legacyStatus")
SELECT 'st_' || md5(t."id" || d.legacy), t."orgId", t."id", d.name, d.color, d.category::"IssueStateCategory", d.position, CURRENT_TIMESTAMP, d.legacy
FROM "Team" t
CROSS JOIN (VALUES
  ('BACKLOG',     'Backlog',     '#94a3b8', 'BACKLOG',   0),
  ('TODO',        'Todo',        '#94a3b8', 'UNSTARTED', 0),
  ('IN_PROGRESS', 'In Progress', '#f59e0b', 'STARTED',   0),
  ('IN_REVIEW',   'In Review',   '#10b981', 'STARTED',   1),
  ('DONE',        'Done',        '#6366f1', 'COMPLETED', 0),
  ('CANCELED',    'Canceled',    '#64748b', 'CANCELED',  0)
) AS d(legacy, name, color, category, position);

ALTER TABLE "Issue" ADD COLUMN "stateId" TEXT;
UPDATE "Issue" i SET "stateId" = s."id"
FROM "IssueState" s
WHERE s."teamId" = i."teamId" AND s."legacyStatus" = i."status"::text;
ALTER TABLE "Issue" ALTER COLUMN "stateId" SET NOT NULL;
ALTER TABLE "IssueState" DROP COLUMN "legacyStatus";

-- DropIndex
DROP INDEX "Issue_orgId_assigneeId_status_idx";

-- DropIndex
DROP INDEX "Issue_orgId_teamId_status_deletedAt_idx";

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "status";

-- DropEnum
DROP TYPE "IssueStatus";

-- CreateIndex
CREATE INDEX "Issue_orgId_teamId_stateId_deletedAt_idx" ON "Issue"("orgId", "teamId", "stateId", "deletedAt");

-- CreateIndex
CREATE INDEX "Issue_orgId_assigneeId_idx" ON "Issue"("orgId", "assigneeId");

-- CreateIndex
CREATE INDEX "Issue_stateId_idx" ON "Issue"("stateId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "IssueState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
