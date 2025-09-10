#!/bin/bash

# Fix incorrect session access patterns introduced by the previous script
echo "Fixing session access patterns..."

# Fix incorrect session.user patterns
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/session\.session\.user\.id/session.user.id/g'
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/session\.session\.user\.role/session.user.role/g'

# Fix prisma session.user references (these should be just prisma.user)
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/prisma\.session\.user\.count/prisma.user.count/g'
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/prisma\.session\.user\.findUnique/prisma.user.findUnique/g'
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/prisma\.session\.user\.findMany/prisma.user.findMany/g'

# Fix incorrect boolean logic in admin checks
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/!session\.user\.id || !session\.user\.role === \"ADMIN\" || session\.user\.role === \"SUPER_ADMIN\"/!session.user.id || !(session.user.role === \"ADMIN\" || session.user.role === \"SUPER_ADMIN\")/g'

# Fix incorrect auth options usage
find src/app/api/admin -name "*.ts" | xargs sed -i '' 's/getServerSession(authOptions)/auth()/g'

echo "Session access patterns fixed!"