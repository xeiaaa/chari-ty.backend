-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "fundraiserId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "purpose" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milestones_fundraiserId_stepNumber_key" ON "milestones"("fundraiserId", "stepNumber");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_fundraiserId_fkey" FOREIGN KEY ("fundraiserId") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
