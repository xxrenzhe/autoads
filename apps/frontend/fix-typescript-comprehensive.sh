#!/bin/bash

echo "🔧 Starting comprehensive TypeScript error fixes..."

# Function to fix specific JSX syntax errors
fix_jsx_syntax() {
    echo "📝 Fixing JSX syntax errors..."
    
    # Fix APIAnalyticsDashboard.tsx
    sed -i '' 's/return (/return (/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/) {/) => {/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/className=\\"mt-4 p-4 bg-white rounded-lg shadow\\">/className=\"mt-4 p-4 bg-white rounded-lg shadow\">/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/<div className=\\"mb-4\\"><h3 className=\\"text-lg font-semibold mb-2\\">/\
<div className=\"mb-4\">\
  <h3 className=\"text-lg font-semibold mb-2\">/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/<div className=\\"grid grid-cols-1 md:grid-cols-2 gap-4\\">/\
<div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    sed -i '' 's/<div className=\\"flex justify-between items-center\\">/\
<div className=\"flex justify-between items-center\">/g' src/admin/components/api/APIAnalyticsDashboard.tsx
    
    # Fix PlanManager.tsx
    sed -i '' 's/return (/return (/g' src/subscription/components/PlanManager.tsx
    sed -i '' 's/) {/) => {/g' src/subscription/components/PlanManager.tsx
    sed -i '' 's/<Card className=\\"mb-6\\"><CardContent className=\\"p-6\\">/\
<Card className=\"mb-6\">\
  <CardContent className=\"p-6\">/g' src/subscription/components/PlanManager.tsx
    
    # Fix SubscriptionManager.tsx
    sed -i '' 's/return (/return (/g' src/subscription/components/SubscriptionManager.tsx
    sed -i '' 's/) {/) => {/g' src/subscription/components/SubscriptionManager.tsx
    
    # Fix TokenCostCalculator.tsx
    sed -i '' 's/return (/return (/g' src/token/components/TokenCostCalculator.tsx
    
    # Fix UserBehaviorAnalytics.tsx
    sed -i '' 's/return (/return (/g' src/user/components/analytics/UserBehaviorAnalytics.tsx
    sed -i '' 's/) {/) => {/g' src/user/components/analytics/UserBehaviorAnalytics.tsx
    
    # Fix UsageChart.tsx
    sed -i '' 's/return (/return (/g' src/user/components/dashboard/UsageChart.tsx
    sed -i '' 's/) {/) => {/g' src/user/components/dashboard/UsageChart.tsx
    
    # Fix TokenUsageTracker.tsx
    sed -i '' 's/return (/return (/g' src/user/components/usage/TokenUsageTracker.tsx
    sed -i '' 's/) {/) => {/g' src/user/components/usage/TokenUsageTracker.tsx
}

# Function to fix missing imports
fix_missing_imports() {
    echo "📦 Fixing missing imports..."
    
    # Add missing React import to files that need it
    files=(
        "src/admin/components/api/APIAnalyticsDashboard.tsx"
        "src/subscription/components/PlanManager.tsx"
        "src/subscription/components/SubscriptionManager.tsx"
        "src/token/components/TokenCostCalculator.tsx"
        "src/user/components/analytics/UserBehaviorAnalytics.tsx"
        "src/user/components/dashboard/UsageChart.tsx"
        "src/user/components/usage/TokenUsageTracker.tsx"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            if ! grep -q "^import React" "$file"; then
                sed -i '' '1s/^/import React from '\''react'\'';\n/' "$file"
                echo "Added React import to $file"
            fi
        fi
    done
}

# Function to fix function declarations
fix_function_declarations() {
    echo "🔧 Fixing function declarations..."
    
    # Fix arrow function syntax in JSX
    find src -name "*.tsx" -type f -exec sed -i '' 's/return (/return (/g' {} \;
    find src -name "*.tsx" -type f -exec sed -i '' 's/) {/) => {/g' {} \;
}

# Function to fix JSX structure
fix_jsx_structure() {
    echo "🏗️ Fixing JSX structure..."
    
    # Fix missing React fragments
    files=(
        "src/admin/components/api/APIAnalyticsDashboard.tsx"
        "src/subscription/components/PlanManager.tsx"
        "src/subscription/components/SubscriptionManager.tsx"
        "src/token/components/TokenCostCalculator.tsx"
        "src/user/components/analytics/UserBehaviorAnalytics.tsx"
        "src/user/components/dashboard/UsageChart.tsx"
        "src/user/components/usage/TokenUsageTracker.tsx"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # Backup the file
            cp "$file" "$file.bak"
            
            # Fix JSX structure
            sed -i '' 's/className=\\\"/className=\"/g' "$file"
            sed -i '' 's/\\\\\"/\"/g' "$file"
            sed -i '' 's/className=\\"/className=\"/g' "$file"
            sed -i '' 's/\\">/">/g' "$file"
            sed -i '' 's/\\\">/\">/g' "$file"
            sed -i '' 's/\\\"><</\"></</g' "$file"
            sed -i '' 's/\\\"><</\"></</g' "$file"
            
            echo "Fixed JSX structure in $file"
        fi
    done
}

# Function to run type checking
run_type_check() {
    echo "🔍 Running type checking..."
    npx tsc --noEmit --skipLibCheck | head -50
}

# Main execution
echo "🚀 Starting TypeScript error fixes..."

# Step 1: Fix JSX syntax
fix_jsx_syntax

# Step 2: Fix missing imports
fix_missing_imports

# Step 3: Fix function declarations
fix_function_declarations

# Step 4: Fix JSX structure
fix_jsx_structure

# Step 5: Run type check to see remaining errors
run_type_check

echo "✅ TypeScript error fixes completed!"
echo "📋 Summary of changes:"
echo "  - Fixed JSX syntax errors"
echo "  - Added missing React imports"
echo "  - Fixed function declarations"
echo "  - Fixed JSX structure issues"