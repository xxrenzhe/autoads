CREATE TABLE IF NOT EXISTS "UserAdsConnection" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "loginCustomerId" TEXT NOT NULL, -- MCC ID (10 digits)
  "primaryCustomerId" TEXT,        -- optional default customer under MCC
  "refreshToken" TEXT NOT NULL,    -- TODO: store encrypted
  "scopes" TEXT,                   -- comma separated scopes
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_useradsconnection_user ON "UserAdsConnection"("userId");

