#!/bin/bash

# 批量清理敏感信息脚本
# 使用方法: ./scripts/clean-all-sensitive-info.sh

set -e

echo "🔥 开始批量清理敏感信息..."

# 创建备份
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 创建备份目录: $BACKUP_DIR"

# 需要清理的文件列表
FILES_TO_CLEAN=(
    "docs/MustKnow.md"
    ".env.example"
    ".env.test"
    "test-redis-connection.js"
    "test-siterank-standalone.mjs"
    ".env.preview.template"
    ".env.production.template"
    "DEPLOYMENT_GUIDE_2C4G.md"
    "scripts/generate-env.sh"
    "scripts/switch-environment.sh"
)

# 清理函数
clean_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "📝 清理文件: $file"
        cp "$file" "$BACKUP_DIR/$(basename $file).backup"
        
        # 数据库密码
        sed -i '' 's/w8mhnnqh/[DATABASE_PASSWORD]/g' "$file"
        
        # Redis密码
        sed -i '' 's/9xdjb8nf/[REDIS_PASSWORD]/g' "$file"
        
        # AUTH_SECRET
        sed -i '' 's/85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834/[AUTH_SECRET]/g' "$file"
        
        # Google OAuth ID
        sed -i '' 's/1007142410985-4945m48srrp056kp0q5n0e5he8omrdol/[GOOGLE_OAUTH_ID]/g' "$file"
        
        # Google OAuth Secret
        sed -i '' 's/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/[GOOGLE_OAUTH_SECRET]/g' "$file"
        
        echo "✅ 已清理: $file"
    fi
}

# 清理所有文件
for file in "${FILES_TO_CLEAN[@]}"; do
    clean_file "$file"
done

# 特殊处理 MustKnow.md - 创建一个清理版本
if [ -f "docs/MustKnow.md" ]; then
    echo "⚠️  创建 MustKnow.md 的清理版本..."
    cp "docs/MustKnow.md" "docs/MustKnow.md.sensitive"
    
    # 创建清理版本
    sed -e 's/w8mhnnqh/[DATABASE_PASSWORD]/g' \
        -e 's/9xdjb8nf/[REDIS_PASSWORD]/g' \
        -e 's/85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834/[AUTH_SECRET]/g' \
        -e 's/1007142410985-4945m48srrp056kp0q5n0e5he8omrdol/[GOOGLE_OAUTH_ID]/g' \
        -e 's/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/[GOOGLE_OAUTH_SECRET]/g' \
        "docs/MustKnow.md" > "docs/MustKnow.md.clean"
    
    echo "✅ 已创建清理版本: docs/MustKnow.md.clean"
    echo "⚠️  原文件保留为: docs/MustKnow.md.sensitive"
fi

echo ""
echo "🎯 清理完成！"
echo ""
echo "📋 后续步骤："
echo "1. 立即更改所有密码和密钥"
echo "2. 撤销并重新生成 Google OAuth 凭据"
echo "3. 检查访问日志"
echo "4. 安装 pre-commit 钩子防止再次发生"
echo ""
echo "📦 备份文件位置: $BACKUP_DIR"
echo ""
echo "⚠️  警告：敏感信息已经提交到 GitHub，需要立即处理！"