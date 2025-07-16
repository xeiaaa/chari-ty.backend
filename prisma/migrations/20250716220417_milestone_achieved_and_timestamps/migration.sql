/*
  Warnings:

  - You are about to drop the column `unlocked` on the `milestones` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `milestones` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "milestones" DROP COLUMN "unlocked",
ADD COLUMN     "achieved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "achievedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
