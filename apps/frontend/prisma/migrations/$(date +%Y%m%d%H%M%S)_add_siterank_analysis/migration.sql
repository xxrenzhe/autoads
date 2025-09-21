-- CreateTable
CREATE TABLE "SiterankAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiterankAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiterankAnalysis_offerId_key" ON "SiterankAnalysis"("offerId");

-- CreateIndex
CREATE INDEX "SiterankAnalysis_userId_idx" ON "SiterankAnalysis"("userId");

-- AddForeignKey
ALTER TABLE "SiterankAnalysis" ADD CONSTRAINT "SiterankAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiterankAnalysis" ADD CONSTRAINT "SiterankAnalysis_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
