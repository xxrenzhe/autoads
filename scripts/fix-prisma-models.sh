#!/bin/bash

# Fix remaining Prisma model references

echo "🔧 Fixing Prisma model references..."

# Fix payment_providers -> paymentProvider
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.payment_providers/prisma.paymentProvider/g' {} \;

# Fix security_events -> securityEvent
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.security_events/prisma.securityEvent/g' {} \;

# Fix token_usage_history -> tokenUsageHistory (if exists)
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.token_usage_history/prisma.tokenUsageHistory/g' {} \;

# Fix user_behavior_analytics -> userBehaviorAnalytics
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.user_behavior_analytics/prisma.userBehaviorAnalytics/g' {} \;

echo "✅ Fixed Prisma model references"