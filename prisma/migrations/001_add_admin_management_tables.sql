-- Migration: Add Admin Management System Tables
-- This migration adds all the necessary tables for the comprehensive admin management system

-- Admin Dashboard Configuration
CREATE TABLE IF NOT EXISTS "admin_dashboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{}',
    "widgets" JSONB NOT NULL DEFAULT '{}',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_dashboards_pkey" PRIMARY KEY ("id")
);

-- Feature Flags for A/B Testing and Feature Rollout
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conditions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- Enhanced Plan Features Configuration
CREATE TABLE IF NOT EXISTS "plan_features" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- Payment Provider Management
CREATE TABLE IF NOT EXISTS "payment_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'unknown',
    "lastHealthCheck" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_providers_pkey" PRIMARY KEY ("id")
);

-- Subscription Analytics and Events
CREATE TABLE IF NOT EXISTS "subscription_analytics" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromPlanId" TEXT,
    "toPlanId" TEXT,
    "revenue" DOUBLE PRECISION,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_analytics_pkey" PRIMARY KEY ("id")
);

-- Hot-reloadable Configuration Management
CREATE TABLE IF NOT EXISTS "configuration_items" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isHotReload" BOOLEAN NOT NULL DEFAULT true,
    "validationRule" TEXT,
    "defaultValue" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_items_pkey" PRIMARY KEY ("id")
);

-- Configuration Change History
CREATE TABLE IF NOT EXISTS "configuration_history" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuration_history_pkey" PRIMARY KEY ("id")
);

-- Enhanced Notification Templates
CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- Notification Instances
CREATE TABLE IF NOT EXISTS "notification_instances" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_instances_pkey" PRIMARY KEY ("id")
);

-- Notification Preferences
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Create Unique Constraints
CREATE UNIQUE INDEX IF NOT EXISTS "admin_dashboards_userId_key" ON "admin_dashboards"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "feature_flags_name_key" ON "feature_flags"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "plan_features_planId_featureName_key" ON "plan_features"("planId", "featureName");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_providers_name_key" ON "payment_providers"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "configuration_items_key_key" ON "configuration_items"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_name_key" ON "notification_templates"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_channel_type_key" ON "notification_preferences"("userId", "channel", "type");

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS "subscription_analytics_subscriptionId_idx" ON "subscription_analytics"("subscriptionId");
CREATE INDEX IF NOT EXISTS "subscription_analytics_eventType_idx" ON "subscription_analytics"("eventType");
CREATE INDEX IF NOT EXISTS "subscription_analytics_timestamp_idx" ON "subscription_analytics"("timestamp");
CREATE INDEX IF NOT EXISTS "configuration_items_category_idx" ON "configuration_items"("category");
CREATE INDEX IF NOT EXISTS "configuration_items_isHotReload_idx" ON "configuration_items"("isHotReload");
CREATE INDEX IF NOT EXISTS "configuration_history_configKey_idx" ON "configuration_history"("configKey");
CREATE INDEX IF NOT EXISTS "configuration_history_timestamp_idx" ON "configuration_history"("timestamp");
CREATE INDEX IF NOT EXISTS "notification_templates_type_idx" ON "notification_templates"("type");
CREATE INDEX IF NOT EXISTS "notification_templates_category_idx" ON "notification_templates"("category");
CREATE INDEX IF NOT EXISTS "notification_instances_userId_idx" ON "notification_instances"("userId");
CREATE INDEX IF NOT EXISTS "notification_instances_status_idx" ON "notification_instances"("status");
CREATE INDEX IF NOT EXISTS "notification_instances_scheduledAt_idx" ON "notification_instances"("scheduledAt");

-- Add Foreign Key Constraints
ALTER TABLE "admin_dashboards" ADD CONSTRAINT "admin_dashboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_analytics" ADD CONSTRAINT "subscription_analytics_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "configuration_items" ADD CONSTRAINT "configuration_items_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "configuration_history" ADD CONSTRAINT "configuration_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "configuration_history" ADD CONSTRAINT "configuration_history_configKey_fkey" FOREIGN KEY ("configKey") REFERENCES "configuration_items"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_instances" ADD CONSTRAINT "notification_instances_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_instances" ADD CONSTRAINT "notification_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;