#!/bin/bash

# Fix NextAuth session structure issues
echo "Fixing NextAuth session structure issues..."

# Fix session.user.role checks
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/session\.user\.role/session.user.role/g'

# Fix prisma session.user references to prisma.user
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/prisma\.session\.user\./prisma.user./g'

# Fix boolean logic issues in admin checks
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/!session\.user\.id || !session\.user\.role === \"ADMIN\" || session\.user\.role === \"SUPER_ADMIN\"/!session?.user?.id || !(session.user.role === \"ADMIN\" || session.user.role === \"SUPER_ADMIN\")/g'

# Fix incorrect session.user access in dashboard stats
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/session\.user\.role/session.user.role/g'

echo "Session structure fixes applied!"