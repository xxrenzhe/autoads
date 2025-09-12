#!/bin/bash
# AUTH_SECRET 轮换脚本

echo "🔄 轮换 AUTH_SECRET..."

# 生成新密钥
NEW_SECRET=$(openssl rand -hex 32)

# 备份
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)

# 更新
sed -i.tmp "s/AUTH_SECRET=.*/AUTH_SECRET=\"$NEW_SECRET\"/" .env.local
rm -f .env.local.tmp

echo "✅ AUTH_SECRET 已轮换"
echo "⚠️  所有用户需要重新登录"
