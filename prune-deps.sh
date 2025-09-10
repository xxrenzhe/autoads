#!/bin/bash

# Production Dependencies Cleanup Script
# This script helps identify and remove unnecessary dependencies for production

echo "=== Production Dependencies Cleanup ==="
echo

# Create a backup of current package.json
cp package.json package.json.backup
echo "✅ Backed up package.json to package.json.backup"

# Function to ask for confirmation
confirm() {
    read -p "$1 (y/N): " response
    [[ "$response" =~ ^[Yy]$ ]]
}

echo
echo "Current disk usage:"
echo "  node_modules: $(du -sh node_modules 2>/dev/null | cut -f1 || echo 'not found')"
echo "  .next: $(du -sh .next 2>/dev/null | cut -f1 || echo 'not found')"
echo

# Option 1: Remove devDependencies
echo "1. Remove development dependencies"
echo "   This will remove all devDependencies, saving ~300-500MB"
echo "   You can reinstall them later with 'npm install'"
echo

if confirm "Do you want to remove devDependencies?"; then
    echo "🗑️  Removing devDependencies..."
    npm prune --omit=dev
    echo "✅ Done! New size: $(du -sh node_modules 2>/dev/null | cut -f1)"
fi

echo
echo "2. Clear npm cache"
echo "   This can free up additional space"
echo

if confirm "Do you want to clear npm cache?"; then
    echo "🧹 Clearing cache..."
    npm cache clean --force
    echo "✅ Cache cleared"
fi

echo
echo "3. Check for unused packages (requires depcheck)"
echo

if command -v depcheck &> /dev/null; then
    echo "🔍 Checking for unused dependencies..."
    depcheck . || echo "⚠️  Some analysis errors occurred"
else
    echo "depcheck not installed. Install with: npm install -g depcheck"
fi

echo
echo "4. Manual cleanup suggestions"
echo "   Consider removing these if not needed:"
echo "   - Storybook related packages (if not using documentation)"
echo "   - Testing packages (if tests run in CI only)"
echo "   - TypeScript (if using JS in production)"
echo

echo "=== Summary ==="
echo "To restore devDependencies: npm install"
echo "To restore from backup: cp package.json.backup package.json && npm install"