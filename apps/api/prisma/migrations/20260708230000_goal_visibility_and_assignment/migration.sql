-- CreateEnum
CREATE TYPE "GoalVisibility" AS ENUM ('personal', 'team');

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "visibility" "GoalVisibility" NOT NULL DEFAULT 'personal';
ALTER TABLE "Goal" ADD COLUMN "assignedById" TEXT;

-- CreateIndex
CREATE INDEX "Goal_orgId_visibility_idx" ON "Goal"("orgId", "visibility");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
