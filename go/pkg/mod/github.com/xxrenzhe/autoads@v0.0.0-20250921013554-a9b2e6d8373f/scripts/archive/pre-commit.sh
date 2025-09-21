#!/bin/bash

# Pre-commit hook to prevent sensitive information leaks
# 安装: cp scripts/pre-commit.sh .git/hooks/pre-commit
# 权限: chmod +x .git/hooks/pre-commit

echo "🔍 检查敏感信息..."

# 定义敏感信息模式
SENSITIVE_PATTERNS=(
    "DATABASE_URL=postgresql://"
    "REDIS_URL=redis://default:"
    "AUTH_SECRET=[a-f0-9]{64}"
    "AUTH_GOOGLE_ID=[0-9]+-[^@]+\.apps\.googleusercontent\.com"
    "AUTH_GOOGLE_SECRET=[A-Za-z0-9_-]{20,}"
    "w8mhnnqh"  # 已知泄漏的数据库密码
    "9xdjb8nf"  # 已知泄漏的Redis密码
    "85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834"  # 已知泄漏的AUTH_SECRET
    "1007142410985-4945m48srrp056kp0q5n0e5he8omrdol"  # 已知泄漏的Google ID
    "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"  # 已知泄漏的Google Secret
)

# 错误计数
ERROR_COUNT=0

# 检查暂存的文件
FILES=$(git diff --cached --name-only)

for FILE in $FILES; do
    # 跳过某些文件类型
    if [[ "$FILE" =~ \.(png|jpg|jpeg|gif|ico|pdf|bin|exe)$ ]]; then
        continue
    fi
    
    # 检查文件内容
    if git show ":$FILE" | grep -q -E "$(IFS="|"; echo "${SENSITIVE_PATTERNS[*]}")"; then
        echo "❌ 发现可能的敏感信息在文件: $FILE"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        
        # 显示具体行（可选）
        echo "相关内容:"
        git show ":$FILE" | grep -n -E "$(IFS="|"; echo "${SENSITIVE_PATTERNS[*]}")" | head -5
        echo "---"
    fi
done

# 检查文件名是否包含敏感信息
for FILE in $FILES; do
    if [[ "$FILE" =~ (password|secret|key|token|credential) ]]; then
        echo "⚠️  文件名可能包含敏感信息: $FILE"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
done

# 检查环境变量文件
for FILE in $FILES; do
    if [[ "$FILE" =~ \.env$ ]] || [[ "$FILE" =~ config ]]; then
        if git show ":$FILE" | grep -q -E "(password|secret|key|token|credential)"; then
            echo "❌ 环境配置文件可能包含敏感信息: $FILE"
            ERROR_COUNT=$((ERROR_COUNT + 1))
        fi
    fi
done

if [ $ERROR_COUNT -gt 0 ]; then
    echo ""
    echo "🚫 发现 $ERROR_COUNT 个潜在的安全问题！"
    echo ""
    echo "请："
    echo "1. 移除所有敏感信息"
    echo "2. 使用环境变量替代硬编码"
    echo "3. 确保密码和密钥不在代码中"
    echo ""
    echo "如果确实需要提交，请使用 --no-verify 跳过检查（不推荐）"
    exit 1
fi

echo "✅ 敏感信息检查通过"
exit 0