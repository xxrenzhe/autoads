#!/bin/bash

echo "🚀 Starting Role Management System Migration..."

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not installed. Please install Node.js first."
    exit 1
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma client"
    exit 1
fi

# Push schema changes to database
echo "🗄️  Pushing schema changes to database..."
npx prisma db push

if [ $? -ne 0 ]; then
    echo "❌ Failed to push schema changes"
    exit 1
fi

# Run the seed script
echo "🌱 Seeding initial roles and permissions..."
npx tsx prisma/seed-roles.ts

if [ $? -ne 0 ]; then
    echo "❌ Failed to seed database"
    exit 1
fi

echo "✅ Migration completed successfully!"
echo ""
echo "📋 Summary:"
echo "  • Created Role, Permission, and RolePermission tables"
echo "  • Added roleId field to User table"
echo "  • Seeded 3 initial roles: USER, ADMIN, SUPER_ADMIN"
echo "  • Created 25 permissions across 7 categories"
echo "  • Set up role inheritance hierarchy"
echo ""
echo "🔗 Next steps:"
echo "  1. Restart your application server"
echo "  2. Test the role management features in the admin panel"
echo "  3. Verify existing users still have correct permissions"