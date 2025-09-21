# API Simplification Script

# APIs to Keep (18 total):
# /api/admin/users/* (4 routes)
# /api/admin/config/* (2 routes)  
# /api/admin/plans/* (4 routes)
# /api/admin/payments/* (3 routes)
# /api/admin/monitoring/* (2 routes)
# /api/admin/tokens/* (3 routes)

echo "Starting API simplification..."
echo "Current API count: $(find src/app/api/admin -name 'route.ts' | wc -l)"

# Create backup directory
mkdir -p admin-api-backup

# Copy all APIs to backup first
cp -r src/app/api/admin admin-api-backup/

# Remove over-engineered API categories
echo "Removing over-engineered APIs..."

# Analytics APIs (20+ routes)
rm -rf src/app/api/admin/analytics
rm -rf src/app/api/admin/dashboard

# Complex configuration APIs (15+ routes) - keep only basic config
rm -rf src/app/api/admin/config/backup
rm -rf src/app/api/admin/config/export
rm -rf src/app/api/admin/config/history
rm -rf src/app/api/admin/config/hot-update
rm -rf src/app/api/admin/config/import
rm -rf src/app/api/admin/config/logs
rm -rf src/app/api/admin/config/notifications
rm -rf src/app/api/admin/config/refresh
rm -rf src/app/api/admin/config/reload
rm -rf src/app/api/admin/config/sync
rm -rf src/app/api/admin/config/validate

# Complex monitoring APIs (15+ routes)
rm -rf src/app/api/admin/monitoring/alerts
rm -rf src/app/api/admin/monitoring/health
rm -rf src/app/api/admin/monitoring/performance
rm -rf src/app/api/admin/monitoring/slow-queries
rm -rf src/app/api/admin/monitoring/trends

# Complex notification APIs (25+ routes)
rm -rf src/app/api/admin/notifications

# Security audit APIs (10+ routes)
rm -rf src/app/api/admin/security

# System metrics APIs (10+ routes)
rm -rf src/app/api/admin/system

# Token analytics APIs (8+ routes) - keep basic token APIs
rm -rf src/app/api/admin/token-analytics

# Complex integration APIs (15+ routes)
rm -rf src/app/api/admin/integrations

# Other over-engineered APIs
rm -rf src/app/api/admin/cache
rm -rf src/app/api/admin/compatibility
rm -rf src/app/api/admin/cron
rm -rf src/app/api/admin/env-vars
rm -rf src/app/api/admin/ip-bans
rm -rf src/app/api/admin/payment-providers
rm -rf src/app/api/admin/performance
rm -rf src/app/api/admin/restart
rm -rf src/app/api/admin/subscription/analytics
rm -rf src/app/api/admin/subscription/reports
rm -rf src/app/api/admin/token-config
rm -rf src/app/api/admin/token-transactions
rm -rf src/app/api/admin/webhooks

echo "API simplification complete!"
echo "Remaining API count: $(find src/app/api/admin -name 'route.ts' | wc -l)"