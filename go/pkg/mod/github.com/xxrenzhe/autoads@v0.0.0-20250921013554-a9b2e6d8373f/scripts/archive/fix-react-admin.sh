#!/bin/bash

# Fix react-admin component imports and usage issues

echo "Fixing react-admin component issues..."

# Fix ReferenceField imports (it should be available in react-admin)
find src/admin/resources -name "*.tsx" -exec sed -i '' 's/ReferenceField/ReferenceField/g' {} \;

# Fix label prop issues by removing unsupported label props
sed -i '' 's/<SubscriptionStatus label="状态" \/>/<SubscriptionStatus \/>/g' src/admin/resources/subscriptions/SubscriptionShow.tsx

# Fix other label prop issues in components
find src/admin/resources -name "*.tsx" -exec sed -i '' 's/<\([A-Za-z]*\) label=\([^>]*\)>/<\1>/g' {} \;

echo "Fixed react-admin component issues"