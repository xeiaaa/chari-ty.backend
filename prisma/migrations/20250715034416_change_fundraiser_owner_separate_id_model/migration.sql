/*
  Warnings:

  - You are about to drop the column `ownerId` on the `fundraisers` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "fundraisers" DROP CONSTRAINT "fundraisers_group_fkey";

-- DropForeignKey
ALTER TABLE "fundraisers" DROP CONSTRAINT "fundraisers_user_fkey";

-- AlterTable
ALTER TABLE "fundraisers" DROP COLUMN "ownerId",
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
