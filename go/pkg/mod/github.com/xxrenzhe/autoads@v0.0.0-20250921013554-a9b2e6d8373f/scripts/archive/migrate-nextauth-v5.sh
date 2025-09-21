#!/bin/bash

# NextAuth.js v4 to v5 Environment Variable Migration Script
# This script helps migrate from NextAuth.js v4 to v5 environment variables

echo "Starting NextAuth.js v4 to v5 migration..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found"
    exit 1
fi

# Create backup
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
echo "Created backup: .env.local.backup.$(date +%Y%m%d_%H%M%S)"

# Migration mappings
declare -A MIGRATIONS=(
    ["GOOGLE_CLIENT_ID"]="AUTH_GOOGLE_ID"
    ["GOOGLE_CLIENT_SECRET"]="AUTH_GOOGLE_SECRET"
    ["NEXTAUTH_SECRET"]="AUTH_SECRET"
    ["NEXTAUTH_URL"]="AUTH_URL"
)

# Perform migrations
for old_var in "${!MIGRATIONS[@]}"; do
    new_var=${MIGRATIONS[$old_var]}
    
    if grep -q "^${old_var}=" .env.local; then
        # Extract the value
        value=$(grep "^${old_var}=" .env.local | cut -d'=' -f2-)
        
        # Check if new variable already exists
        if ! grep -q "^${new_var}=" .env.local; then
            # Add new variable
            echo "${new_var}=${value}" >> .env.local
            echo "Added: ${new_var}"
        else
            echo "Skipped: ${new_var} already exists"
        fi
        
        # Comment out old variable
        sed -i '' "s/^${old_var}=/# ${old_var}=/g" .env.local
        echo "Migrated: ${old_var} -> ${new_var}"
    fi
done

echo ""
echo "Migration completed!"
echo ""
echo "Next steps:"
echo "1. Review the .env.local file"
echo "2. Update any missing NextAuth.js v5 variables"
echo "3. Remove old commented variables after confirming everything works"
echo ""
echo "Required NextAuth.js v5 variables:"
echo "- AUTH_GOOGLE_ID"
echo "- AUTH_GOOGLE_SECRET"
echo "- AUTH_SECRET"