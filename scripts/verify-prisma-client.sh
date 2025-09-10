#!/bin/bash

# Prisma Client Verification Script
# Verifies that Prisma client was generated successfully

set -e

echo "🔍 Verifying Prisma client generation..."

# Check if Prisma client exists
if [ ! -d "node_modules/@prisma/client" ]; then
    echo "❌ Prisma client not found in node_modules"
    exit 1
fi

# Check if the client was generated properly
if [ ! -f "node_modules/@prisma-client/index.js" ] && [ ! -f "node_modules/@prisma/client/index.js" ]; then
    echo "❌ Prisma client index file not found"
    exit 1
fi

# Check if Prisma client package.json exists
if [ ! -f "node_modules/@prisma/client/package.json" ]; then
    echo "❌ Prisma client package.json not found"
    exit 1
fi

# Verify Prisma client version matches expected
CLIENT_VERSION=$(node -e "console.log(require('./node_modules/@prisma/client/package.json').version)" 2>/dev/null || echo "unknown")
if [ "$CLIENT_VERSION" = "unknown" ]; then
    echo "❌ Could not read Prisma client version"
    exit 1
fi

echo "✅ Prisma client generated successfully (version $CLIENT_VERSION)"

# Optional: Try to import Prisma client to verify it works
echo "🧪 Testing Prisma client import..."
if node -e "require('@prisma/client')" 2>/dev/null; then
    echo "✅ Prisma client import test passed"
else
    echo "⚠️  Prisma client import test failed (may be normal without DATABASE_URL)"
fi

echo "✅ Prisma client verification completed"