#!/bin/bash

echo "🔧 精确修复TypeScript错误..."

# 1. 修复错误的Props类型注解
echo "📝 修复Props类型注解..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/: \.\*Props/: Props/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/: \.\*\([A-Za-z]*Props\)/: \1/g'

# 2. 修复所有剩余的箭头函数语法
echo "📝 修复箭头函数语法..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/) => {$/) {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/) : any => {$/) {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/) : [A-Za-z]* => {$/) {/g'

# 3. 修复if语句中的箭头函数
echo "📝 修复if语句..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/if ([^)]*) => {/if (\1) {/g'

# 4. 修复catch语句
echo "📝 修复catch语句..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/} catch ([^)]*) => {/} catch (\1) {/g'

# 5. 修复switch语句
echo "📝 修复switch语句..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/switch ([^)]*) => {/switch (\1) {/g'

# 6. 修复JSX事件处理器 - 处理所有模式
echo "📝 修复JSX事件处理器..."
find src/ -name "*.tsx" | while read file; do
    # 修复 onClick={((param): type => expression)}
    sed -i '' 's/onClick={(([a-zA-Z0-9_]*): [^}]*})/onClick={\1}/g' "$file"
    
    # 修复 onClick={((param) => expression)}
    sed -i '' 's/onClick={(([a-zA-Z0-9_]*) => [^}]*)}/onClick={\1}/g' "$file"
    
    # 修复 onChange={((param): type => expression)}
    sed -i '' 's/onChange={(([a-zA-Z0-9_]*): [^}]*})/onChange={\1}/g' "$file"
    
    # 修复 onChange={((param) => expression)}
    sed -i '' 's/onChange={(([a-zA-Z0-9_]*) => [^}]*)}/onChange={\1}/g' "$file"
    
    # 修复 onSubmit={((param): type => expression)}
    sed -i '' 's/onSubmit={(([a-zA-Z0-9_]*): [^}]*})/onSubmit={\1}/g' "$file"
    
    # 修复 onSubmit={((param) => expression)}
    sed -i '' 's/onSubmit={(([a-zA-Z0-9_]*) => [^}]*)}/onSubmit={\1}/g' "$file"
    
    # 修复其他事件处理器
    sed -i '' 's/onKeyDown={(([a-zA-Z0-9_]*): [^}]*})/onKeyDown={\1}/g' "$file"
    sed -i '' 's/onFocus={(([a-zA-Z0-9_]*): [^}]*})/onFocus={\1}/g' "$file"
    sed -i '' 's/onBlur={(([a-zA-Z0-9_]*): [^}]*})/onBlur={\1}/g' "$file"
    sed -i '' 's/onMouseOver={(([a-zA-Z0-9_]*): [^}]*})/onMouseOver={\1}/g' "$file"
    sed -i '' 's/onMouseOut={(([a-zA-Z0-9_]*): [^}]*})/onMouseOut={\1}/g' "$file"
done

# 7. 修复map函数中的参数
echo "📝 修复map函数参数..."
find src/ -name "*.tsx" | xargs sed -i '' 's/\.map(([a-zA-Z0-9_]*), ([a-zA-Z0-9_]*): [^)]*) => {/.map((\1, \2) => {/g'

# 8. 修复异步函数
echo "📝 修复异步函数..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/const ([a-zA-Z0-9_]*) = async () => {/const \1 = async () => {/g'

# 9. 修复函数声明
echo "📝 修复函数声明..."
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/function \([a-zA-Z0-9_]*\)() => {/function \1() {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/export default function \([a-zA-Z0-9_]*\)() => {/export default function \1() {/g'
find src/ -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/export default async function \([a-zA-Z0-9_]*\)() => {/export default async function \1() {/g'

echo "✅ 精确修复完成！"
echo "🔍 检查剩余错误..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS"