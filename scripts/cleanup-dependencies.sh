#!/bin/bash

# Dependency Cleanup Script
# Removes over-engineering related dependencies

echo "Starting dependency cleanup..."

# Check if jq is installed for JSON parsing
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed. Please install jq first."
    exit 1
fi

# Backup package.json
cp package.json package.json.backup

# Dependencies to remove (over-engineering related)
DEPENDENCIES_TO_REMOVE=(
    # Storybook (over-engineering for admin UI)
    "@storybook/*"
    "storybook"
    
    # Complex monitoring and analytics
    "recharts"
    "@next/bundle-analyzer"
    
    # Testing overkill (keeping basic jest)
    "allure-playwright"
    "@vitest/*"
    "vitest"
    
    # Unused complex utilities
    "reflect-metadata"
    "long"
    
    # Development tools not needed
    "@chromatic-com/storybook"
    "@stripe/react-stripe-js" # Using server-side Stripe
)

echo "Removing unused dependencies..."

# Create a temporary script to remove dependencies using npm
for dep in "${DEPENDENCIES_TO_REMOVE[@]}"; do
    echo "Removing $dep..."
    npm uninstall "$dep" 2>/dev/null || true
done

echo "Dependency cleanup complete!"
echo ""
echo "Dependencies removed:"
printf '%s\n' "${DEPENDENCIES_TO_REMOVE[@]}"
echo ""
echo "Remaining dependency count: $(jq '.dependencies | keys | length' package.json)"
echo "Dev dependencies remaining: $(jq '.devDependencies | keys | length' package.json)"