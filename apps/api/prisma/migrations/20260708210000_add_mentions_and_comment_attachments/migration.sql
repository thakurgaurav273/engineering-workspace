-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MENTIONED';

-- CreateTable
CREATE TABLE "WorkspaceItemCommentAttachment" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "kind" "TaskUpdateAttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceItemCommentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceItemCommentAttachment_commentId_idx" ON "WorkspaceItemCommentAttachment"("commentId");

-- AddForeignKey
ALTER TABLE "WorkspaceItemCommentAttachment" ADD CONSTRAINT "WorkspaceItemCommentAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "WorkspaceItemComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
