#!/bin/bash

# 简单的环境变量检查脚本
echo "检查环境变量配置..."

# 加载环境变量
if [ -f .env ]; then
    echo "加载 .env 文件..."
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -f .env.local ]; then
    echo "加载 .env.local 文件..."
    export $(cat .env.local | grep -v '^#' | xargs)
fi

echo ""
echo "NextAuth v5 配置检查："
echo "===================="
echo "AUTH_SECRET: ${AUTH_SECRET:0:10}... (${#AUTH_SECRET} 字符)"
echo "AUTH_URL: $AUTH_URL"
echo "AUTH_TRUST_HOST: $AUTH_TRUST_HOST"
echo "AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID:0:20}..."
echo "AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET:0:10}..."

echo ""
echo "数据库配置："
echo "==========="
echo "DATABASE_URL: ${DATABASE_URL:0:30}..."
echo "REDIS_URL: ${REDIS_URL:0:30}..."

echo ""
if [[ "$AUTH_SECRET" == "your-nextauth-secret-key-here" ]] || [[ "$AUTH_SECRET" == "your-secret-key-here" ]]; then
    echo "❌ AUTH_SECRET 仍然是占位符值，需要设置真实的密钥"
elif [[ ${#AUTH_SECRET} -lt 32 ]]; then
    echo "❌ AUTH_SECRET 太短，应该至少32个字符"
else
    echo "✅ AUTH_SECRET 配置正确"
fi

if [[ "$AUTH_GOOGLE_ID" == "your-google-client-id" ]] || [[ -z "$AUTH_GOOGLE_ID" ]]; then
    echo "⚠️  需要配置 Google OAuth 客户端 ID"
else
    echo "✅ Google OAuth ID 已配置"
fi