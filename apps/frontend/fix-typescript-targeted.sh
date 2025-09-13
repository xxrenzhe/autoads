#!/bin/bash

echo "🔧 Fixing TypeScript errors with targeted fixes..."

# Fix APIAnalyticsDashboard.tsx first
echo "📝 Fixing APIAnalyticsDashboard.tsx..."
if [ -f "src/admin/components/api/APIAnalyticsDashboard.tsx" ]; then
    # Create a backup
    cp src/admin/components/api/APIAnalyticsDashboard.tsx src/admin/components/api/APIAnalyticsDashboard.tsx.bak
    
    # Fix the JSX syntax issues
    sed -i '' 's/className=\\\"/className=\"/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/\\\\\"/\"/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    
    # Fix the malformed JSX
    sed -i '' 's/return (/return (/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/) {/) => {/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    
    # Fix JSX closing tags
    sed -i '' 's/<div className=\\"mb-4\\"><h3 className=\\"text-lg font-semibold mb-2\\">/\
<div className=\"mb-4\">\
  <h3 className=\"text-lg font-semibold mb-2\">/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    
    echo "Fixed APIAnalyticsDashboard.tsx"
fi

# Fix PlanManager.tsx
echo "📝 Fixing PlanManager.tsx..."
if [ -f "src/subscription/components/PlanManager.tsx" ]; then
    cp src/subscription/components/PlanManager.tsx src/subscription/components/PlanManager.tsx.bak
    
    # Fix JSX syntax
    sed -i '' 's/className=\\\"/className=\"/g' src/subscription/components/PlanManager.tsx
    sed -i '' 's/\\\\\"/\"/g' src/subscription/components/PlanManager.tsx
    
    # Fix function syntax
    sed -i '' 's/return (/return (/g' src/subscription/components/PlanManager.tsx
    sed -i '' 's/) {/) => {/g' src/subscription/components/PlanManager.tsx
    
    echo "Fixed PlanManager.tsx"
fi

# Fix SubscriptionManager.tsx
echo "📝 Fixing SubscriptionManager.tsx..."
if [ -f "src/subscription/components/SubscriptionManager.tsx" ]; then
    cp src/subscription/components/SubscriptionManager.tsx src/subscription/components/SubscriptionManager.tsx.bak
    
    # Fix JSX syntax
    sed -i '' 's/className=\\\"/className=\"/g' src/subscription/components/SubscriptionManager.tsx
    sed -i '' 's/\\\\\"/\"/g' src/subscription/components/SubscriptionManager.tsx
    
    # Fix function syntax
    sed -i '' 's/return (/return (/g' src/subscription/components/SubscriptionManager.tsx
    sed -i '' 's/) {/) => {/g' src/subscription/components/SubscriptionManager.tsx
    
    echo "Fixed SubscriptionManager.tsx"
fi

# Fix TokenCostCalculator.tsx
echo "📝 Fixing TokenCostCalculator.tsx..."
if [ -f "src/token/components/TokenCostCalculator.tsx" ]; then
    cp src/token/components/TokenCostCalculator.tsx src/token/components/TokenCostCalculator.tsx.bak
    
    # Fix JSX syntax
    sed -i '' 's/className=\\\"/className=\"/g' src/token/components/TokenCostCalculator.tsx
    sed -i '' 's/\\\\\"/\"/g' src/token/components/TokenCostCalculator.tsx
    
    # Fix function syntax
    sed -i '' 's/return (/return (/g' src/token/components/TokenCostCalculator.tsx
    sed -i '' 's/) {/) => {/g' src/token/components/TokenCostCalculator.tsx
    
    echo "Fixed TokenCostCalculator.tsx"
fi

# Fix UserBehaviorAnalytics.tsx
echo "📝 Fixing UserBehaviorAnalytics.tsx..."
if [ -f "src/user/components/analytics/UserBehaviorAnalytics.tsx" ]; then
    cp src/user/components/analytics/UserBehaviorAnalytics.tsx src/user/components/analytics/UserBehaviorAnalytics.tsx.bak
    
    # Fix JSX syntax
    sed -i '' 's/className=\\\"/className=\"/g' src/user/components/analytics/UserBehaviorAnalytics.tsx
    sed -i '' 's/\\\\\"/\"/g' src/user/components/analytics/UserBehaviorAnalytics.tsx
    
    # Fix function syntax
    sed -i '' 's/return (/return (/g' src/user/components/analytics/UserBehaviorAnalytics.tsx
    sed -i '' 's/) {/) => {/g' src/user/components/analytics/UserBehaviorAnalytics.tsx
    
    echo "Fixed UserBehaviorAnalytics.tsx"
fi

# Fix UsageChart.tsx
echo "📝 Fixing UsageChart.tsx..."
if [ -f "src/user/components/dashboard/UsageChart.tsx" ]; then
    cp src/user/components/dashboard/UsageChart.tsx src/user/components/dashboard/UsageChart.tsx.bak
    
    # Fix JSX syntax
    sed -i '' 's/className=\\\"/className=\"/g' src/user/components/dashboard/UsageChart.tsx
    sed -i '' 's/\\\\\"/\"/g' src/user/components/dashboard/UsageChart.tsx
    
    # Fix function syntax
    sed -i '' 's/return (/return (/g' src/user/components/dashboard/UsageChart.tsx
    sed -i '' 's/) {/) => {/g' src/user/components/dashboard/UsageChart.tsx
    
    echo "Fixed UsageChart.tsx"
fi

# Fix TokenUsageTracker.tsx
echo "📝 Fixing TokenUsageTracker.tsx..."
if [ -f "src/user/components/usage/TokenUsageTracker.tsx" ]; then
    cp src/user/components/usage/TokenUsageTracker.tsx src/user/components/usage/TokenUsageTracker.tsx.bak
    
    # Fix JSX syntax
    sed -i '' 's/className=\\\"/className=\"/g' src/user/components/usage/TokenUsageTracker.tsx
    sed -i '' 's/\\\\\"/\"/g' src/user/components/usage/TokenUsageTracker.tsx
    
    # Fix function syntax
    sed -i '' 's/return (/return (/g' src/user/components/usage/TokenUsageTracker.tsx
    sed -i '' 's/) {/) => {/g' src/user/components/usage/TokenUsageTracker.tsx
    
    echo "Fixed TokenUsageTracker.tsx"
fi

# Fix AdminAppSimple.tsx
echo "📝 Fixing AdminAppSimple.tsx..."
if [ -f "src/admin/AdminAppSimple.tsx" ]; then
    cp src/admin/AdminAppSimple.tsx src/admin/AdminAppSimple.tsx.bak
    
    # Fix import/export syntax
    sed -i '' 's/export {/export {/g' src/admin/AdminAppSimple.tsx
    
    echo "Fixed AdminAppSimple.tsx"
fi

echo "✅ Targeted fixes completed!"
echo "🔍 Checking remaining errors..."
npx tsc --noEmit --skipLibCheck | head -30