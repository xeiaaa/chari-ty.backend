/*
  Warnings:

  - You are about to drop the column `donationId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `fundraiserId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `invitationId` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `readAt` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `verificationRequestId` on the `notifications` table. All the data in the column will be lost.
  - Made the column `data` on table `notifications` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_donationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_fundraiserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_invitationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."notifications" DROP CONSTRAINT "notifications_verificationRequestId_fkey";

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "donationId",
DROP COLUMN "fundraiserId",
DROP COLUMN "groupId",
DROP COLUMN "invitationId",
DROP COLUMN "message",
DROP COLUMN "readAt",
DROP COLUMN "status",
DROP COLUMN "title",
DROP COLUMN "updatedAt",
DROP COLUMN "verificationRequestId",
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "data" SET NOT NULL;

-- DropEnum
DROP TYPE "public"."NotificationStatus";
