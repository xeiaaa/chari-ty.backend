-- CreateTable
CREATE TABLE "fundraiser_links" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fundraiser_links_fundraiserId_alias_key" ON "fundraiser_links"("fundraiserId", "alias");

-- AddForeignKey
ALTER TABLE "fundraiser_links" ADD CONSTRAINT "fundraiser_links_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
