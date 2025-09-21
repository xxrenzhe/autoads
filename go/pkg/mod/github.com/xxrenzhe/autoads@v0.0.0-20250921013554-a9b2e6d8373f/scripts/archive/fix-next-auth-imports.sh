#!/bin/bash

# Fix next-auth import errors for v5 beta

echo "Fixing next-auth v5 beta imports..."

# Fix getServerSession imports
sed -i '' 's/import { getServerSession } from "next-auth"/import getServerSession from "next-auth"/g' src/app/api/admin/statistics/behavior/route.ts
sed -i '' 's/import { getServerSession } from "next-auth"/import getServerSession from "next-auth"/g' src/app/api/admin/statistics/usage/route.ts
sed -i '' 's/import { getServerSession } from "next-auth"/import getServerSession from "next-auth"/g' src/app/api/admin/subscriptions/\[id\]/actions/route.ts
sed -i '' 's/import { getServerSession } from "next-auth"/import getServerSession from "next-auth"/g' src/app/api/admin/subscriptions/\[id\]/route.ts
sed -i '' 's/import { getServerSession } from "next-auth"/import getServerSession from "next-auth"/g' src/app/api/admin/subscriptions/route.ts
sed -i '' 's/import { getServerSession } from "next-auth"/import getServerSession from "next-auth"/g' src/app/api/admin/tokens/transactions/route.ts

# Fix authConfig import - check what's actually exported
sed -i '' 's/import { authConfig } from.*$/import { authOptions } from '\'''@/lib/auth'\'''/g' src/app/api/admin/statistics/behavior/route.ts
sed -i '' 's/import { authConfig } from.*$/import { authOptions } from '\'''@/lib/auth'\'''/g' src/app/api/admin/statistics/usage/route.ts
sed -i '' 's/import { authConfig } from.*$/import { authOptions } from '\'''@/lib/auth'\'''/g' src/app/api/admin/subscriptions/\[id\]/actions/route.ts
sed -i '' 's/import { authConfig } from.*$/import { authOptions } from '\'''@/lib/auth'\'''/g' src/app/api/admin/subscriptions/\[id\]/route.ts
sed -i '' 's/import { authConfig } from.*$/import { authOptions } from '\'''@/lib/auth'\'''/g' src/app/api/admin/subscriptions/route.ts

# Fix authOptions import
sed -i '' 's/import { authOptions } from.*$/import { authOptions } from '\'''@/lib/auth/v5-config'\'''/g' src/app/api/admin/tokens/transactions/route.ts

echo "Fixed next-auth import errors"