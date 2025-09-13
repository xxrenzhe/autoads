#!/bin/bash

echo "🔧 Fixing function declaration syntax errors..."

# Find all files with incorrect arrow function syntax
echo "📝 Finding files with incorrect syntax..."
files_with_errors=$(grep -l "function.*() => {" src/ --include="*.tsx" --include="*.ts" | head -50)

# Fix each file
for file in $files_with_errors; do
    echo "Fixing: $file"
    
    # Create backup
    cp "$file" "$file.bak"
    
    # Fix the syntax: "function name() => {" -> "function name() {"
    sed -i '' 's/function \(.*\)() => {/function \1() {/g' "$file"
    
    # Special case for default exports
    sed -i '' 's/export default function \(.*\)() => {/export default function \1() {/g' "$file"
    
    # Special case for async functions
    sed -i '' 's/export default async function \(.*\)() => {/export default async function \1() {/g' "$file"
    
    # Fix arrow functions in variable declarations
    sed -i '' 's/const \(.*\) = () => {/const \1 = () => {/g' "$file"
    
    echo "Fixed: $file"
done

echo "✅ Function syntax fixes completed!"
echo "🔍 Checking remaining errors..."
npx tsc --noEmit --skipLibCheck | head -50