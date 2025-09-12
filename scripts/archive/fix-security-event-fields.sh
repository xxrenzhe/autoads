#!/bin/bash

# Fix SecurityEvent field mismatches
# This script replaces eventType with type and timestamp with createdAt

echo "Fixing SecurityEvent field mismatches..."

# Fix eventType -> type in SecurityEvent queries
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/eventType:/type:/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/eventType as/type as/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/eventType/type/g'

# Fix timestamp -> createdAt in SecurityEvent queries
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/timestamp:/createdAt:/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/timestamp as/createdAt as/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/.timestamp/.createdAt/g'

echo "SecurityEvent field fixes completed!"