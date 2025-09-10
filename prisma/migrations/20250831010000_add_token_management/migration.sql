-- Add token purchase options to plans
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "extraTokenOptions" JSONB;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "allowExtraTokens" BOOLEAN DEFAULT true;

-- Create token_purchases table
CREATE TABLE IF NOT EXISTS "token_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "token_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create token_transactions table
CREATE TABLE IF NOT EXISTS "token_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "token_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create check_ins table
CREATE TABLE IF NOT EXISTS "check_ins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL,
    "rewardLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_ins_userId_date_key" UNIQUE ("userId", "date"),
    CONSTRAINT "check_ins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS "invitations" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "invitedId" TEXT,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "email" TEXT,
    "tokensReward" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invitations_invitedId_key" UNIQUE ("invitedId"),
    CONSTRAINT "invitations_code_key" UNIQUE ("code"),
    CONSTRAINT "invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitations_invitedId_fkey" FOREIGN KEY ("invitedId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add new columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "token_transactions_userId_createdAt_idx" ON "token_transactions"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "check_ins_userId_date_idx" ON "check_ins"("userId", "date");
CREATE INDEX IF NOT EXISTS "invitations_inviterId_createdAt_idx" ON "invitations"("inviterId", "createdAt");