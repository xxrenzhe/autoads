-- CreateTable
CREATE TABLE "BatchopenTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "simulationConfig" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchopenTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchopenTask_userId_offerId_idx" ON "BatchopenTask"("userId", "offerId");

-- AddForeignKey
ALTER TABLE "BatchopenTask" ADD CONSTRAINT "BatchopenTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchopenTask" ADD CONSTRAINT "BatchopenTask_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
