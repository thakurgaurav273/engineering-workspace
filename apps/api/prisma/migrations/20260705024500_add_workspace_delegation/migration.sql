-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_ITEM_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "WorkspaceItem" ADD COLUMN     "isClientProject" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "watcherIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

