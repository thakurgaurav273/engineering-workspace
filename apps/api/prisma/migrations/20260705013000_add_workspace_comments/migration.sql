-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WORKSPACE_ITEM_COMMENT';

-- CreateTable
CREATE TABLE "WorkspaceItemComment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceItemComment_itemId_createdAt_idx" ON "WorkspaceItemComment"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceItemComment" ADD CONSTRAINT "WorkspaceItemComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceItemComment" ADD CONSTRAINT "WorkspaceItemComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

