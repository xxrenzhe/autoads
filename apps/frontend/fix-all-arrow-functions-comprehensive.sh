#!/bin/bash

# Fix all arrow function syntax errors across the entire codebase
echo "Fixing all arrow function syntax errors..."

# Find all .ts and .tsx files with useCallback arrow function issues
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    # Fix useCallback without =>
    sed -i '' 's/useCallback(() {/useCallback(() => {/g' "$file"
    sed -i '' 's/useCallback(() {$/useCallback(() => {$/g' "$file"
    sed -i '' 's/useCallback(async () {/useCallback(async () => {/g' "$file"
    sed -i '' 's/useCallback(async () {$/useCallback(async () => {$/g' "$file"
    
    # Fix mutationFn without =>
    sed -i '' 's/mutationFn: async (/mutationFn: async (/g' "$file"
    sed -i '' 's/mutationFn: (/(mutationFn: (/g' "$file"
    
    # Fix queryFn without =>
    sed -i '' 's/queryFn: async (/queryFn: async (/g' "$file"
    sed -i '' 's/queryFn: (/(queryFn: (/g' "$file"
done

echo "Fixed all arrow function syntax errors"