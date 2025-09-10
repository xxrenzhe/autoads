-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."security_threats" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "indicators" TEXT[],
    "affectedResources" TEXT[],
    "recommendedActions" TEXT[],
    "triggeringEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "notes" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "security_threats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "public"."audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_category_timestamp_idx" ON "public"."audit_logs"("category", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_severity_timestamp_idx" ON "public"."audit_logs"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_ipAddress_timestamp_idx" ON "public"."audit_logs"("ipAddress", "timestamp");

-- CreateIndex
CREATE INDEX "security_threats_type_status_idx" ON "public"."security_threats"("type", "status");

-- CreateIndex
CREATE INDEX "security_threats_severity_detectedAt_idx" ON "public"."security_threats"("severity", "detectedAt");

-- CreateIndex
CREATE INDEX "security_threats_status_detectedAt_idx" ON "public"."security_threats"("status", "detectedAt");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
