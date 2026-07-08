-- AlterTable
ALTER TABLE "WorkspaceItemComment" ADD COLUMN "isEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkspaceItemComment" ADD COLUMN "editedAt" TIMESTAMP(3);
