/*
  Warnings:

  - You are about to drop the column `groupId` on the `fundraisers` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `fundraisers` table. All the data in the column will be lost.
  - Added the required column `ownerId` to the `fundraisers` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "fundraisers" DROP CONSTRAINT "fundraisers_groupId_fkey";

-- DropForeignKey
ALTER TABLE "fundraisers" DROP CONSTRAINT "fundraisers_userId_fkey";

-- AlterTable
ALTER TABLE "fundraisers" DROP COLUMN "groupId",
DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_user_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_group_fkey" FOREIGN KEY ("ownerId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
