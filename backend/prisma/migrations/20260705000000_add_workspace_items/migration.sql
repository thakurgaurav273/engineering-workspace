-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "WorkspacePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "WorkspaceSource" AS ENUM ('MANUAL', 'LINEAR', 'SLACK', 'WHATSAPP', 'EMAIL', 'MEETING', 'PHONE_CALL', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkspaceReminderStage" AS ENUM ('NONE', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_ITEM_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_ITEM_REMINDER';

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "workspace" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WorkspaceItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "assignedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "WorkspacePriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "source" "WorkspaceSource" NOT NULL DEFAULT 'MANUAL',
    "reminderStage" "WorkspaceReminderStage" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkspaceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceItem_orgId_ownerId_status_deletedAt_idx" ON "WorkspaceItem"("orgId", "ownerId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "WorkspaceItem_orgId_dueDate_idx" ON "WorkspaceItem"("orgId", "dueDate");

-- CreateIndex
CREATE INDEX "WorkspaceItem_assignedById_idx" ON "WorkspaceItem"("assignedById");

-- AddForeignKey
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

