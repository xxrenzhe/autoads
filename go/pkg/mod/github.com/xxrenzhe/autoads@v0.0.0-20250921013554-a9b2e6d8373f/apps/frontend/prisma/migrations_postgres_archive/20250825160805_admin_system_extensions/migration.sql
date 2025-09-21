-- Add missing fields to users table
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "tokenBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- Add missing fields to plans table  
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "tokenQuota" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "rateLimit" INTEGER NOT NULL DEFAULT 100;

-- Create user_activities table
CREATE TABLE IF NOT EXISTS "public"."user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- Create api_usages table
CREATE TABLE IF NOT EXISTS "public"."api_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "tokenConsumed" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usages_pkey" PRIMARY KEY ("id")
);

-- Create service_configs table
CREATE TABLE IF NOT EXISTS "public"."service_configs" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "lastChecked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_configs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for user_activities
CREATE INDEX IF NOT EXISTS "user_activities_userId_timestamp_idx" ON "public"."user_activities"("userId", "timestamp");
CREATE INDEX IF NOT EXISTS "user_activities_action_timestamp_idx" ON "public"."user_activities"("action", "timestamp");

-- Create indexes for api_usages
CREATE INDEX IF NOT EXISTS "api_usages_userId_timestamp_idx" ON "public"."api_usages"("userId", "timestamp");
CREATE INDEX IF NOT EXISTS "api_usages_endpoint_timestamp_idx" ON "public"."api_usages"("endpoint", "timestamp");

-- Create unique constraint for service_configs
CREATE UNIQUE INDEX IF NOT EXISTS "service_configs_serviceName_key" ON "public"."service_configs"("serviceName");

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_activities_userId_fkey') THEN
        ALTER TABLE "public"."user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_usages_userId_fkey') THEN
        ALTER TABLE "public"."api_usages" ADD CONSTRAINT "api_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;