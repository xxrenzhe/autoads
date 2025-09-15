-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('API_LIMIT', 'BATCH_LIMIT', 'ACCOUNT_SUSPEND', 'LOGIN_BLOCK', 'FEATURE_ACCESS');

-- CreateTable
CREATE TABLE "user_restrictions" (
    "id" VARCHAR(191) NOT NULL,
    "userId" VARCHAR(191) NOT NULL,
    "type" "RestrictionType" NOT NULL,
    "reason" VARCHAR(191) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_restrictions_userId_type_idx" ON "user_restrictions"("userId", "type");
CREATE INDEX "user_restrictions_expiresAt_idx" ON "user_restrictions"("expiresAt");
CREATE INDEX "user_restrictions_isActive_idx" ON "user_restrictions"("isActive");

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;