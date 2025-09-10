#!/bin/bash

# ========================================
# NextAuth v5 Environment Migration Script
# Migrates from NextAuth v4 to v5 environment variables
# ========================================

set -e

echo "🔄 Migrating NextAuth environment variables to v5 format..."

# Function to update environment file
update_env_file() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        echo "⚠️  File $file not found, skipping..."
        return
    fi
    
    echo "📝 Updating $file..."
    
    # Create backup
    cp "$file" "$file.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Update NextAuth variables
    sed -i.tmp \
        -e 's/NEXTAUTH_SECRET=/AUTH_SECRET=/g' \
        -e 's/NEXTAUTH_URL=/AUTH_URL=/g' \
        -e 's/GOOGLE_CLIENT_ID=/AUTH_GOOGLE_ID=/g' \
        -e 's/GOOGLE_CLIENT_SECRET=/AUTH_GOOGLE_SECRET=/g' \
        "$file"
    
    # Add AUTH_TRUST_HOST if not present
    if ! grep -q "AUTH_TRUST_HOST" "$file"; then
        echo "" >> "$file"
        echo "# NextAuth v5 Trust Host Configuration" >> "$file"
        echo "AUTH_TRUST_HOST=\"true\"" >> "$file"
    fi
    
    # Remove temporary file
    rm -f "$file.tmp"
    
    echo "✅ Updated $file"
}

# Update environment files
ENV_FILES=(
    ".env"
    ".env.local"
    ".env.example"
    ".env.clawcloud.preview"
    ".env.clawcloud.production"
)

for file in "${ENV_FILES[@]}"; do
    update_env_file "$file"
done

# Update Docker Compose files
echo "📝 Updating Docker Compose files..."

DOCKER_FILES=(
    "docker-compose.yml"
    "docker-compose.production.yml"
    "docker-compose.dev.yml"
)

for file in "${DOCKER_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "📝 Updating $file..."
        cp "$file" "$file.backup.$(date +%Y%m%d_%H%M%S)"
        
        sed -i.tmp \
            -e 's/NEXTAUTH_SECRET=/AUTH_SECRET=/g' \
            -e 's/NEXTAUTH_URL=/AUTH_URL=/g' \
            -e 's/\${NEXTAUTH_SECRET}/\${AUTH_SECRET}/g' \
            -e 's/\${NEXTAUTH_URL}/\${AUTH_URL}/g' \
            "$file"
        
        # Add AUTH_TRUST_HOST if not present
        if ! grep -q "AUTH_TRUST_HOST" "$file"; then
            # Find the line with AUTH_SECRET and add AUTH_TRUST_HOST after it
            sed -i.tmp '/AUTH_SECRET=/a\
      - AUTH_TRUST_HOST=${AUTH_TRUST_HOST}' "$file"
        fi
        
        rm -f "$file.tmp"
        echo "✅ Updated $file"
    fi
done

echo ""
echo "✅ NextAuth v5 migration completed!"
echo ""
echo "📋 Summary of changes:"
echo "   • NEXTAUTH_SECRET → AUTH_SECRET"
echo "   • NEXTAUTH_URL → AUTH_URL"
echo "   • GOOGLE_CLIENT_ID → AUTH_GOOGLE_ID"
echo "   • GOOGLE_CLIENT_SECRET → AUTH_GOOGLE_SECRET"
echo "   • Added AUTH_TRUST_HOST=true"
echo ""
echo "🔍 Please review the updated files and update your environment variables accordingly."
echo "💾 Backup files have been created with timestamp suffixes."