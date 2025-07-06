-- DropIndex
DROP INDEX "group_members_userId_groupId_key";

-- AlterTable
ALTER TABLE "group_members" ALTER COLUMN "userId" DROP NOT NULL;
