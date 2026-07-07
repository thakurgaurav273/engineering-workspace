-- CreateEnum
CREATE TYPE "LinearWorkflowType" AS ENUM ('backlog', 'unstarted', 'started', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "TaskUpdateStatus" AS ENUM ('on_track', 'at_risk', 'blocked', 'in_review', 'done');

-- CreateEnum
CREATE TYPE "TaskUpdateAttachmentKind" AS ENUM ('file', 'image', 'voice_note');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TASK_UPDATE_POSTED';

-- CreateTable
CREATE TABLE "LinearIssue" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "linearId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateType" "LinearWorkflowType" NOT NULL,
    "priority" INTEGER,
    "estimate" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinearIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUpdate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "progress" INTEGER,
    "status" "TaskUpdateStatus" NOT NULL,
    "timeSpentMinutes" INTEGER,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUpdateAttachment" (
    "id" TEXT NOT NULL,
    "taskUpdateId" TEXT NOT NULL,
    "kind" "TaskUpdateAttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUpdateAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinearIssue_orgId_assigneeId_idx" ON "LinearIssue"("orgId", "assigneeId");

-- CreateIndex
CREATE INDEX "LinearIssue_orgId_stateType_idx" ON "LinearIssue"("orgId", "stateType");

-- CreateIndex
CREATE UNIQUE INDEX "LinearIssue_orgId_linearId_key" ON "LinearIssue"("orgId", "linearId");

-- CreateIndex
CREATE INDEX "TaskUpdate_orgId_issueId_createdAt_idx" ON "TaskUpdate"("orgId", "issueId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskUpdate_orgId_authorId_createdAt_idx" ON "TaskUpdate"("orgId", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskUpdateAttachment_taskUpdateId_idx" ON "TaskUpdateAttachment"("taskUpdateId");

-- AddForeignKey
ALTER TABLE "LinearIssue" ADD CONSTRAINT "LinearIssue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinearIssue" ADD CONSTRAINT "LinearIssue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "LinearIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdateAttachment" ADD CONSTRAINT "TaskUpdateAttachment_taskUpdateId_fkey" FOREIGN KEY ("taskUpdateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

