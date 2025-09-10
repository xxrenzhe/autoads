#!/bin/bash

# Fix MUI Grid2 import errors - MUI v7.0.0 doesn't have Grid2 yet

echo "Fixing MUI Grid2 import errors..."

# Fix SubscriptionEdit.tsx
sed -i '' 's/import Grid from '\''@mui\/material\/Grid2'\'';/import { Grid } from '\''@mui\/material'\'';/g' src/admin/resources/subscriptions/SubscriptionEdit.tsx
sed -i '' 's/<Grid xs=/<Grid item xs=/g' src/admin/resources/subscriptions/SubscriptionEdit.tsx
sed -i '' 's/<Grid md=/<Grid item md=/g' src/admin/resources/subscriptions/SubscriptionEdit.tsx

# Fix SubscriptionShow.tsx
sed -i '' 's/import Grid from '\''@mui\/material\/Grid2'\'';/import { Grid } from '\''@mui\/material'\'';/g' src/admin/resources/subscriptions/SubscriptionShow.tsx

echo "Fixed MUI Grid2 imports"