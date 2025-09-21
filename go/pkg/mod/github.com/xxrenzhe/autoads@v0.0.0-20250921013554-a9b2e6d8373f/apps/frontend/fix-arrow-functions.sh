#!/bin/bash

# Fix arrow function syntax errors
echo "Fixing arrow function syntax..."

# Fix useUserDashboard.ts arrow functions
sed -i '' 's/useCallback(() {/useCallback(() => {/g' src/user/hooks/useUserDashboard.ts

# Check for any other similar patterns in the file
sed -i '' 's/useCallback(() {$/useCallback(() => {$/g' src/user/hooks/useUserDashboard.ts

echo "Fixed arrow function syntax"