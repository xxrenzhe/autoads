#!/bin/bash

# Health check script for deployment verification
# Usage: ./scripts/deploy-health-check.sh <environment> <base_url>

set -e

ENVIRONMENT=${1:-preview}
BASE_URL=${2:-"https://urlchecker.dev"}
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "🔍 Starting health check for $ENVIRONMENT environment"
echo "🌐 Base URL: $BASE_URL"

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    local description=$3
    
    echo "Checking $description..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" | grep -q "$expected_status"; then
            echo "✅ $description - OK"
            return 0
        else
            echo "⏳ Attempt $i/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
            sleep $RETRY_INTERVAL
        fi
    done
    
    echo "❌ $description - FAILED after $MAX_RETRIES attempts"
    return 1
}

# Function to check JSON response
check_json_endpoint() {
    local endpoint=$1
    local expected_field=$2
    local expected_value=$3
    local description=$4
    
    echo "Checking $description..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        response=$(curl -s "$BASE_URL$endpoint" || echo "{}")
        
        if echo "$response" | jq -e ".$expected_field == \"$expected_value\"" > /dev/null 2>&1; then
            echo "✅ $description - OK"
            return 0
        else
            echo "⏳ Attempt $i/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
            sleep $RETRY_INTERVAL
        fi
    done
    
    echo "❌ $description - FAILED after $MAX_RETRIES attempts"
    return 1
}

# Health checks
echo "🏥 Running health checks..."

# Basic health check
check_endpoint "/api/health" "200" "Basic health endpoint"

# Admin health check
check_json_endpoint "/api/admin/health" "status" "healthy" "Admin health endpoint"

# Database connectivity
check_json_endpoint "/api/admin/health" "database" "connected" "Database connectivity"

# Redis connectivity
check_json_endpoint "/api/admin/health" "redis" "connected" "Redis connectivity"

# Public pages
check_endpoint "/" "200" "Home page"
check_endpoint "/pricing" "200" "Pricing page"

# API endpoints
check_endpoint "/api/plans" "200" "Plans API endpoint"

echo ""
echo "🎉 All health checks passed for $ENVIRONMENT environment!"
echo "🚀 Deployment verification completed successfully"

# Optional: Run smoke tests
if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    echo "🧪 Running production smoke tests..."
    npm run test:smoke:production
fi

exit 0