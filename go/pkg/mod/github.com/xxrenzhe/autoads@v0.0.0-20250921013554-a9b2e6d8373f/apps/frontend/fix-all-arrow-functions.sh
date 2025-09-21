#!/bin/bash

# Fix all arrow function syntax errors
echo "Fixing arrow function syntax errors..."

# Fix useUserDashboard.ts
sed -i '' 's/useCallback(() {/useCallback(() => {/g' src/user/hooks/useUserDashboard.ts
sed -i '' 's/useCallback(() {$/useCallback(() => {$/g' src/user/hooks/useUserDashboard.ts

# Fix useTokenUsage.ts
sed -i '' 's/useCallback(() {/useCallback(() => {/g' src/user/hooks/useTokenUsage.ts
sed -i '' 's/useCallback(() {$/useCallback(() => {$/g' src/user/hooks/useTokenUsage.ts

# Also fix any other patterns that might exist
sed -i '' 's/useCallback(async () {/useCallback(async () => {/g' src/user/hooks/useUserDashboard.ts
sed -i '' 's/useCallback(async () {$/useCallback(async () => {$/g' src/user/hooks/useUserDashboard.ts

sed -i '' 's/useCallback(async () {/useCallback(async () => {/g' src/user/hooks/useTokenUsage.ts
sed -i '' 's/useCallback(async () {$/useCallback(async () => {$/g' src/user/hooks/useTokenUsage.ts

echo "Fixed arrow function syntax errors"