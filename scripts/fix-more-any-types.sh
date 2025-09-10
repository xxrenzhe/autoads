#!/bin/bash

# Fix remaining TypeScript 'any' type errors

echo "Fixing remaining TypeScript 'any' type errors..."

# Fix src/app/api/payment/verify/route.ts
sed -i '' 's/transactions\.forEach(tx => {/transactions.forEach((tx: any) => {/g' src/app/api/payment/verify/route.ts

# Fix src/app/api/siterank/rank/route.ts
sed -i '' 's/\.map(r => ({/.map((r: any) => ({/g' src/app/api/siterank/rank/route.ts
sed -i '' 's/\.sort((a, b) =>/.sort((a: any, b: any) =>/g' src/app/api/siterank/rank/route.ts

# Fix src/app/api/user/usage-report/route.ts
sed -i '' 's/\.reduce((sum, d) =>/.reduce((sum: any, d: any) =>/g' src/app/api/user/usage-report/route.ts
sed -i '' 's/dailyData\.map(d => (/dailyData.map((d: any) => (/g' src/app/api/user/usage-report/route.ts

# Fix src/components/user/InvitationModule.tsx
sed -i '' 's/\.reduce((acc, e, v) =>/.reduce((acc: any, e: any, v: any) =>/g' src/components/user/InvitationModule.tsx
sed -i '' 's/errors\.forEach(e => {/errors.forEach((e: any) => {/g' src/components/user/InvitationModule.tsx

# Fix src/lib/aggressive-cleanup-manager.ts
sed -i '' 's/\.sort((a, b) =>/.sort((a: any, b: any) =>/g' src/lib/aggressive-cleanup-manager.ts

# Fix src/lib/security/behavior-analysis-service.ts
sed -i '' 's/\.reduce((acc, a) =>/.reduce((acc: any, a: any) =>/g' src/lib/security/behavior-analysis-service.ts
sed -i '' 's/alerts\.forEach(a => {/alerts.forEach((a: any) => {/g' src/lib/security/behavior-analysis-service.ts
sed -i '' 's/\.map(a => ({/.map((a: any) => ({/g' src/lib/security/behavior-analysis-service.ts
sed -i '' 's/\.forEach(item => {/.forEach((item: any) => {/g' src/lib/security/behavior-analysis-service.ts
sed -i '' 's/\.reduce((sum, item) =>/.reduce((sum: any, item: any) =>/g' src/lib/security/behavior-analysis-service.ts

# Fix src/lib/services/token-transaction-service.ts
sed -i '' 's/\.reduce((sum, t) =>/.reduce((sum: any, t: any) =>/g' src/lib/services/token-transaction-service.ts
sed -i '' 's/\.forEach(t => {/transactions.forEach((t: any) => {/g' src/lib/services/token-transaction-service.ts
sed -i '' 's/\.map(stat => ({/.map((stat: any) => ({/g' src/lib/services/token-transaction-service.ts
sed -i '' 's/transactions\.map(t => (/transactions.map((t: any) => (/g' src/lib/services/token-transaction-service.ts

# Fix src/lib/services/usage-stats-service.ts
sed -i '' 's/\.forEach(log => {/logs.forEach((log: any) => {/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/\.map(api => ({/.map((api: any) => ({/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/\.map(behavior => ({/.map((behavior: any) => ({/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/\.reduce((acc, stat) =>/.reduce((acc: any, stat: any) =>/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/\.map((item, index) =>/.map((item: any, index: any) =>/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/trend\.push(/trend.push((item: any) =>/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/\.map(t => ({/.map((t: any) => ({/g' src/lib/services/usage-stats-service.ts
sed -i '' 's/\.map(f => ({/.map((f: any) => ({/g' src/lib/services/usage-stats-service.ts

# Fix src/lib/siterank files
sed -i '' 's/\.map((result, index) =>/.map((result: any, index: any) =>/g' src/lib/siterank/enhanced-similarweb-service.ts
sed -i '' 's/\.map((result, index) =>/.map((result: any, index: any) =>/g' src/lib/siterank/unified-similarweb-service.ts

echo "Fixed remaining 'any' type errors"