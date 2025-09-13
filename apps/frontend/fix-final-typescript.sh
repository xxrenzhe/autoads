#!/bin/bash

echo "🔧 Final comprehensive TypeScript error fixes..."

# Fix all remaining arrow function syntax issues
echo "📝 Fixing arrow function syntax..."

# Fix all function declarations
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/function \(.*\)() => {/function \1() {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/export default function \(.*\)() => {/export default function \1() {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/export default async function \(.*\)() => {/export default async function \1() {/g'

# Fix component props
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/}: Props) => {/}: Props) {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/}: .*Props) => {/}: .*Props) {/g'

# Fix if statements
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/if \([^=]*\)() => {/if \1 {/g'

# Fix catch blocks
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/} catch (error) => {/} catch (error) {/g'

# Fix switch statements  
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/switch (.*[^=>]) => {/switch \1 {/g'

# Fix JSX event handlers with complex patterns
find src/ -name "*.tsx" | while read file; do
    # Fix onClick patterns
    sed -i '' 's/onClick={(([^:]*): [^)]*): [^}]*}/onClick={() => \1}/g' "$file"
    sed -i '' 's/onClick={(([^:]*): [^)]*):\s*([^}]*)}/onClick={\2}/g' "$file"
    sed -i '' 's/onClick={(([^)]*)=>[^}]*)}/onClick={\1}/g' "$file"
    
    # Fix onChange patterns
    sed -i '' 's/onChange={(([^:]*): [^)]*): [^}]*}/onChange={() => \1}/g' "$file"
    sed -i '' 's/onChange={(([^:]*): [^)]*):\s*([^}]*)}/onChange={\2}/g' "$file"
    sed -i '' 's/onChange={(([^)]*)=>[^}]*)}/onChange={\1}/g' "$file"
    
    # Fix onSubmit patterns
    sed -i '' 's/onSubmit={(([^:]*): [^)]*): [^}]*}/onSubmit={() => \1}/g' "$file"
    sed -i '' 's/onSubmit={(([^:]*): [^)]*):\s*([^}]*)}/onSubmit={\2}/g' "$file"
    sed -i '' 's/onSubmit={(([^)]*)=>[^}]*)}/onSubmit={\1}/g' "$file"
    
    # Fix other event handlers
    sed -i '' 's/onKeyDown={(([^:]*): [^)]*):\s*([^}]*)}/onKeyDown={\2}/g' "$file"
    sed -i '' 's/onFocus={(([^:]*): [^)]*):\s*([^}]*)}/onFocus={\2}/g' "$file"
    sed -i '' 's/onBlur={(([^:]*): [^)]*):\s*([^}]*)}/onBlur={\2}/g' "$file"
done

# Fix map function parameter syntax
find src/ -name "*.tsx" | xargs sed -i '' 's/\.map(([^,]*), ([^:]*): [^)]*):/\.map((\1, \2):/g'

# Fix array.map with incorrect parameter syntax
find src/ -name "*.tsx" | xargs sed -i '' 's/\.map(([^,)]*), ([^:]*): [^)]*) => {/\.map((\1, \2) => {/g'

# Fix async functions
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/const \(.*\) = async () => {/const \1 = async () => {/g'

echo "✅ All fixes applied!"
echo "🔍 Checking error count..."
ERROR_COUNT=$(npx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS" || echo "0")
echo "Remaining errors: $ERROR_COUNT"

if [ "$ERROR_COUNT" -lt 100 ]; then
    echo "🎉 Significant improvement! Remaining errors:"
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
else
    echo "⚠️  Still many errors remaining. Need more targeted fixes."
fi