#!/bin/bash

# Fix remaining boolean logic issues
echo "Fixing boolean logic issues..."

# Fix incorrect boolean logic patterns
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/!session\.user\.id || !session\.user\.role === \"ADMIN\" || session\.user\.role === \"SUPER_ADMIN\"/!session?.user?.id || !(session.user.role === \"ADMIN\" || session.user.role === \"SUPER_ADMIN\")/g'

# Fix session.user to session?.user
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/!session\.user/!session?.user/g'

# Fix remaining prisma import issues
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/from '\''@\/lib\/prisma'\''/from '\''@\/lib\/db'\''/g'

echo "Boolean logic fixes applied!"