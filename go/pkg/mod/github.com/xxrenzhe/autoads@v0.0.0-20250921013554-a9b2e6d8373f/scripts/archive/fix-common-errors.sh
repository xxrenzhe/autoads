#!/bin/bash

# Fix common TypeScript error patterns
# 1. Fix browserService.close() calls
echo "Fixing browserService.close() calls..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' '/await browserService\.close();/d'

# 2. Fix error handling patterns in admin routes
echo "Fixing error handling patterns..."
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/logger\.error(/logger.error(/g; s/error instanceof Error ? error : undefined/error instanceof Error ? error : undefined/g'

# 3. Fix missing user.isAdmin property
echo "Fixing missing isAdmin property..."
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/session\.user\.isAdmin/session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"/g'

# 4. Fix NextAuth session access patterns
echo "Fixing NextAuth session access..."
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/\.user\./\.session?.user\./g'

# 5. Fix error handling patterns
echo "Fixing error handling..."
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/error instanceof Error ? error\.message : String(error)/error instanceof Error ? error : undefined/g'

echo "Fixes applied!"