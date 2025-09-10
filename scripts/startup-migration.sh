#!/bin/bash

# 启动时配置优化和迁移脚本
# 用于容器启动时执行数据库迁移

echo "🚀 容器启动 - 检查配置系统优化..."

# 检查是否需要运行迁移
if [ "$SKIP_DB_MIGRATION" = "true" ]; then
    echo "⏭️  跳过数据库迁移（SKIP_DB_MIGRATION=true）"
    exit 0
fi

# 检查数据库连接
echo "🔍 检查数据库连接..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if npx prisma db execute --stdin --url="$DATABASE_URL" << EOF
SELECT 1;
EOF
    then
        echo "✅ 数据库连接成功"
        break
    else
        echo "⏳ 等待数据库连接... ($((attempt + 1))/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    fi
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ 无法连接到数据库，跳过迁移"
    exit 1
fi

# 检查是否已经执行过迁移
echo "🔍 检查迁移状态..."
MIGRATION_STATUS=$(npx prisma migrate status 2>/dev/null || echo "pending")

if echo "$MIGRATION_STATUS" | grep -q "No pending migrations"; then
    echo "✅ 数据库已是最新状态"
else
    echo "🗄️ 运行数据库迁移..."
    npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        echo "✅ 数据库迁移成功"
    else
        echo "❌ 数据库迁移失败"
        exit 1
    fi
fi

# 检查是否需要执行配置数据迁移
echo "📋 检查配置数据迁移..."
CONFIG_COUNT=$(npx prisma db execute --stdin --url="$DATABASE_URL" << EOF
SELECT COUNT(*)::int as count FROM system_configs;
EOF
2>/dev/null | tail -n 1 || echo "0")

ENV_COUNT=$(npx prisma db execute --stdin --url="$DATABASE_URL" << EOF
SELECT COUNT(*)::int as count FROM environment_variables;
EOF
2>/dev/null | tail -n 1 || echo "0")

if [ "$CONFIG_COUNT" = "0" ] && [ "$ENV_COUNT" -gt "0" ]; then
    echo "📋 执行配置数据迁移..."
    npx tsx scripts/migrate-configs.ts
    
    if [ $? -eq 0 ]; then
        echo "✅ 配置数据迁移成功"
    else
        echo "❌ 配置数据迁移失败"
        exit 1
    fi
else
    echo "✅ 配置数据已是最新状态（SystemConfig: $CONFIG_COUNT, EnvVar: $ENV_COUNT）"
fi

echo "🎉 配置系统优化部署完成！"