#!/bin/bash

echo "🔧 Fixing remaining TypeScript errors..."

# Fix AdminAppSimple.tsx
echo "📝 Fixing AdminAppSimple.tsx..."
if [ -f "src/admin/AdminAppSimple.tsx" ]; then
    sed -i '' 's/} from '\''react-admin'\''/} from '\''react-admin'\'';/g' src/admin/AdminAppSimple.tsx
fi

# Fix all function declarations with incorrect arrow syntax
echo "📝 Fixing function declarations..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs grep -l "function.*() => {" | while read file; do
    echo "Fixing: $file"
    sed -i '' 's/function \(.*\)() => {/function \1() {/g' "$file"
    sed -i '' 's/export default function \(.*\)() => {/export default function \1() {/g' "$file"
    sed -i '' 's/export default async function \(.*\)() => {/export default async function \1() {/g' "$file"
done

# Fix component function declarations
echo "📝 Fixing component declarations..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs grep -l "}: Props) => {" | while read file; do
    echo "Fixing props in: $file"
    sed -i '' 's/}: Props) => {/}: Props) {/g' "$file"
    sed -i '' 's/}: .*Props) => {/}: .*Props) {/g' "$file"
done

# Fix if statements with incorrect arrow syntax
echo "📝 Fixing if statements..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs grep -l "if.*() => {" | while read file; do
    echo "Fixing if statements in: $file"
    sed -i '' 's/if \([^=]*\)() => {/if \1 {/g' "$file"
done

# Fix JSX event handlers
echo "📝 Fixing JSX event handlers..."
find src/ -name "*.tsx" | while read file; do
    # Fix onChange handlers
    sed -i '' 's/onChange={(([^:]*): [^)]*): [^}]*}/onChange={\1}/g' "$file"
    sed -i '' 's/onChange={(([^)]*)=>[^}]*)}/onChange={\1}/g' "$file"
    
    # Fix onClick handlers
    sed -i '' 's/onClick={(([^:]*): [^)]*): [^}]*}/onClick={\1}/g' "$file"
    sed -i '' 's/onClick={(([^)]*)=>[^}]*)}/onClick={\1}/g' "$file"
    
    # Fix onSubmit handlers
    sed -i '' 's/onSubmit={(([^:]*): [^)]*): [^}]*}/onSubmit={\1}/g' "$file"
    sed -i '' 's/onSubmit={(([^)]*)=>[^}]*)}/onSubmit={\1}/g' "$file"
done

echo "✅ All fixes applied!"
echo "🔍 Checking remaining errors..."
npx tsc --noEmit --skipLibCheck | head -30