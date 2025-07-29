-- AlterTable
ALTER TABLE "fundraisers" ADD COLUMN     "coverId" TEXT;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
