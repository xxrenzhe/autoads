#!/bin/bash

# 简化的启动脚本 - 遵循简单实用原则

echo "🚀 启动应用..."

# 检查并执行数据库迁移（仅在生产环境）
if [ "$NODE_ENV" = "production" ] && [ "$SKIP_DB_MIGRATION" != "true" ]; then
    echo "🗄️ 检查数据库迁移..."
    
    # 等待数据库就绪（最多30秒）
    for i in {1..30}; do
        if npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT 1;
EOF
        then
            echo "✅ 数据库连接成功"
            break
        fi
        echo "⏳ 等待数据库... ($i/30)"
        sleep 1
    done
    
    # 执行迁移
    echo "📋 执行数据库迁移..."
    npx prisma migrate deploy || echo "⚠️  迁移失败，继续启动"
fi

# 启动应用（使用标准 Next.js 启动方式）
echo "🌐 启动 Next.js 应用..."
exec node server.js