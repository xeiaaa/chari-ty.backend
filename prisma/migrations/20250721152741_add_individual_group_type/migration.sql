/*
  Warnings:

  - You are about to drop the column `ownerType` on the `fundraisers` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `fundraisers` table. All the data in the column will be lost.
  - Made the column `groupId` on table `fundraisers` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `ownerId` to the `groups` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "GroupType" ADD VALUE 'individual';

-- DropForeignKey
ALTER TABLE "fundraisers" DROP CONSTRAINT "fundraisers_groupId_fkey";

-- DropForeignKey
ALTER TABLE "fundraisers" DROP CONSTRAINT "fundraisers_userId_fkey";

-- AlterTable
ALTER TABLE "fundraisers" DROP COLUMN "ownerType",
DROP COLUMN "userId",
ADD COLUMN     "acceptingDonations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isGoalReached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stopWhenGoalReached" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "groupId" SET NOT NULL;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "stripeId" TEXT;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
