#!/bin/bash

# Database Migration Script for Stripe Integration
# This script updates the database schema to support Stripe payments

echo "Starting database migration..."

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Push schema changes to database
echo "Pushing schema changes to database..."
npx prisma db push

echo "Migration completed successfully!"
echo ""
echo "Database changes:"
echo "- Added stripeCustomerId to User model"
echo "- Added stripePriceId and stripeYearlyPriceId to Plan model"
echo ""
echo "Next steps:"
echo "1. Run the Stripe setup script: ./scripts/setup-stripe.sh"
echo "2. Update your plans with the Stripe price IDs"
echo "3. Configure your environment variables"