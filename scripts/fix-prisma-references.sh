#!/bin/bash

# Fix TypeScript errors after Prisma schema changes

echo "🔧 Fixing TypeScript errors..."

# Fix tokenUsage to token_usage
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.tokenUsage/prisma.token_usage/g' {} \;

# Fix tokenUsages to token_usage in includes
find src -name "*.ts" -type f -exec sed -i '' 's/tokenUsages:/token_usage:/g' {} \;

# Fix securityEvent to security_events
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.securityEvent/prisma.security_events/g' {} \;

# Fix apiRateLimit to api_rate_limits
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.apiRateLimit/prisma.api_rate_limits/g' {} \;

# Fix paymentProvider to payment_providers
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.paymentProvider/prisma.payment_providers/g' {} \;

# Fix adminDashboard to admin_dashboards
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.adminDashboard/prisma.admin_dashboards/g' {} \;

# Fix planFeature to plan_features
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.planFeature/prisma.plan_features/g' {} \;

# Fix configurationItem to configuration_items
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.configurationItem/prisma.configuration_items/g' {} \;

# Fix featureFlag to feature_flags
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.featureFlag/prisma.feature_flags/g' {} \;

# Fix tokenConfig to token_configs
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.tokenConfig/prisma.token_configs/g' {} \;

# Fix notification to notifications
find src -name "*.ts" -type f -exec sed -i '' 's/prisma\.notification/prisma.notifications/g' {} \;

echo "✅ Fixed all Prisma model references"