-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "avatarUploadId" TEXT;

-- CreateTable
CREATE TABLE "group_uploads" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_uploads" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_uploads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_avatarUploadId_fkey" FOREIGN KEY ("avatarUploadId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_uploads" ADD CONSTRAINT "group_uploads_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_uploads" ADD CONSTRAINT "group_uploads_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_uploads" ADD CONSTRAINT "milestone_uploads_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_uploads" ADD CONSTRAINT "milestone_uploads_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
