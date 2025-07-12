-- CreateEnum
CREATE TYPE "FundraiserCategory" AS ENUM ('education', 'health', 'disaster_relief', 'environment', 'animals', 'children', 'community', 'arts', 'sports', 'food', 'housing', 'technology', 'other');

-- CreateEnum
CREATE TYPE "FundraiserOwnerType" AS ENUM ('user', 'group');

-- CreateEnum
CREATE TYPE "FundraiserStatus" AS ENUM ('draft', 'pending', 'published', 'suspended');

-- CreateTable
CREATE TABLE "fundraisers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "FundraiserCategory" NOT NULL,
    "goalAmount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "endDate" TIMESTAMP(3),
    "coverUrl" TEXT NOT NULL,
    "galleryUrls" TEXT[],
    "ownerType" "FundraiserOwnerType" NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "status" "FundraiserStatus" NOT NULL DEFAULT 'draft',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraisers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraisers_slug_key" ON "fundraisers"("slug");

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
