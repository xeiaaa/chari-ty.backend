/*
  Warnings:

  - Added the required column `userId` to the `fundraiser_links` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "fundraiser_links" ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "fundraiser_links" ADD CONSTRAINT "fundraiser_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
