-- CreateTable
CREATE TABLE "public"."api_performance_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userAgent" TEXT,
    "clientIp" TEXT,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "responseSize" INTEGER NOT NULL DEFAULT 0,
    "memoryHeapUsed" BIGINT,
    "memoryHeapTotal" BIGINT,
    "memoryRss" BIGINT,
    "cpuUser" BIGINT,
    "cpuSystem" BIGINT,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_performance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."performance_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "endpoint" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "performance_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_performance_logs_requestId_key" ON "public"."api_performance_logs"("requestId");

-- CreateIndex
CREATE INDEX "api_performance_logs_timestamp_idx" ON "public"."api_performance_logs"("timestamp");

-- CreateIndex
CREATE INDEX "api_performance_logs_responseTime_idx" ON "public"."api_performance_logs"("responseTime");

-- CreateIndex
CREATE INDEX "api_performance_logs_method_url_idx" ON "public"."api_performance_logs"("method", "url");

-- CreateIndex
CREATE INDEX "performance_alerts_resolved_severity_createdAt_idx" ON "public"."performance_alerts"("resolved", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "performance_alerts_type_createdAt_idx" ON "public"."performance_alerts"("type", "createdAt");
