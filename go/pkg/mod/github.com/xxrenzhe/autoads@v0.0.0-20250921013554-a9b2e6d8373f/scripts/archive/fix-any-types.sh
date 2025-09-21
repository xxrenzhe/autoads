#!/bin/bash

# Fix TypeScript 'any' type errors in reduce functions and callbacks

echo "Fixing TypeScript 'any' type errors..."

# Fix src/app/api/admin/api-management/rate-limits/route.ts
sed -i '' 's/rules\.map(rule => (/rules.map((rule: any) => (/g' src/app/api/admin/api-management/rate-limits/route.ts

# Fix src/app/api/admin/notifications/process/route.ts
sed -i '' 's/notifications\.map(n => (/notifications.map((n: any) => (/g' src/app/api/admin/notifications/process/route.ts

# Fix src/app/api/admin/notifications/queue/route.ts
sed -i '' 's/notifications\.map(notification => (/notifications.map((notification: any) => (/g' src/app/api/admin/notifications/queue/route.ts

# Fix src/app/api/admin/notifications/stats/route.ts
sed -i '' 's/notifications\.forEach(n => {/notifications.forEach((n: any) => {/g' src/app/api/admin/notifications/stats/route.ts
sed -i '' 's/\.reduce((sum, time) =>/.reduce((sum: any, time: any) =>/g' src/app/api/admin/notifications/stats/route.ts

# Fix src/app/api/admin/security-minimal/route.ts
sed -i '' 's/events\.map(event => (/events.map((event: any) => (/g' src/app/api/admin/security-minimal/route.ts
sed -i '' 's/\.reduce((acc, stat) =>/.reduce((acc: any, stat: any) =>/g' src/app/api/admin/security-minimal/route.ts
sed -i '' 's/events\.forEach(e => {/events.forEach((e: any) => {/g' src/app/api/admin/security-minimal/route.ts

# Fix src/app/api/admin-security-simple/route.ts
sed -i '' 's/\.reduce((acc, a) =>/.reduce((acc: any, a: any) =>/g' src/app/api/admin/security-simple/route.ts

# Fix src/app/api/admin/security/route.ts
sed -i '' 's/users\.map(user => (/users.map((user: any) => (/g' src/app/api/admin/security/route.ts
sed -i '' 's/alerts\.map(alert => (/alerts.map((alert: any) => (/g' src/app/api/admin/security/route.ts
sed -i '' 's/activities\.map(activity => (/activities.map((activity: any) => (/g' src/app/api/admin/security/route.ts
sed -i '' 's/\.reduce((acc, a) =>/.reduce((acc: any, a: any) =>/g' src/app/api/admin/security/route.ts
sed -i '' 's/\.map(r => ({/.map((r: any) => ({/g' src/app/api/admin/security/route.ts

echo "Fixed 'any' type errors in admin API routes"