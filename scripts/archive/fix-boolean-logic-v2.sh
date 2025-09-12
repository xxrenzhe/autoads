#!/bin/bash

# Fix incorrect boolean logic patterns
echo "Fixing incorrect boolean logic patterns..."

# Fix the incorrect pattern: !session?.user?.role === "ADMIN" should be session?.user?.role !== "ADMIN"
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/!session\?\.user\?\.role === \"ADMIN\"/session?.user?.role !== \"ADMIN\"/g'

# Fix the pattern: !session?.user?.id || !session?.user?.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/!session\?\.user\?\.id || !session\?\.user\?\.role === \"ADMIN\" || session\.user\.role === \"SUPER_ADMIN\"/!session?.user?.id || !(session?.user?.role === \"ADMIN\" || session?.user?.role === \"SUPER_ADMIN\")/g'

echo "Boolean logic fixes completed!"