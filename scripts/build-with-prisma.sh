#!/bin/bash

# Build script with Prisma client generation
# This ensures Prisma client is always generated before building

set -e

echo "🔧 Starting build process with Prisma client generation..."

# Check if DATABASE_URL is set (for schema validation)
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL not set. Using placeholder for build."
    export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Validate Prisma schema
echo "✅ Validating Prisma schema..."
npx prisma validate

# Verify Prisma client generation
echo "🔍 Verifying Prisma client..."
./scripts/verify-prisma-client.sh

# Run TypeScript type checking
echo "🔍 Running TypeScript type checking..."
npm run type-check

# Build the application
echo "🏗️  Building Next.js application..."
if [ "$NODE_ENV" = "production" ]; then
    npm run build:production
else
    npm run build:preview
fi

echo "✅ Build completed successfully!"