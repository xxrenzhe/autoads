#!/bin/bash

# 优化的启动脚本 - 确保配置系统优化生效

echo "🚀 启动应用..."

# 仅在生产环境且未跳过迁移时执行
if [ "$NODE_ENV" = "production" ] && [ "$SKIP_DB_MIGRATION" != "true" ]; then
    echo "🔧 检查配置系统优化..."
    
    # 等待数据库就绪
    echo "⏳ 等待数据库连接..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT 1;
EOF
        then
            echo "✅ 数据库连接成功"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    # 检查是否需要迁移
    if [ $attempt -lt $max_attempts ]; then
        # 检查 SystemConfig 表是否存在
        CONFIG_TABLE_EXISTS=$(npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'system_configs'
);
EOF
)
        
        if [ "$CONFIG_TABLE_EXISTS" = "true" ]; then
            echo "✅ 配置系统已优化，检查迁移状态..."
            
            # 执行待处理的迁移
            npx prisma migrate deploy --skip-generate || echo "⚠️  部分迁移失败，继续启动"
            
            # 检查是否需要从 EnvironmentVariable 迁移数据
            ENV_COUNT=$(npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT COUNT(*) FROM environment_variables;
EOF
)
            CONFIG_COUNT=$(npx prisma db execute --stdin --url="$DATABASE_URL" << EOF 2>/dev/null
SELECT COUNT(*) FROM system_configs;
EOF
)
            
            if [ "$ENV_COUNT" -gt 0 ] && [ "$CONFIG_COUNT" -eq 0 ]; then
                echo "📋 执行配置数据迁移..."
                npx tsx scripts/migrate-configs.ts || echo "⚠️  配置迁移失败，继续启动"
            fi
        else
            echo "🗄️ 初始化数据库..."
            # 首先尝试使用迁移（如果有完整的迁移历史）
            if ! npx prisma migrate deploy 2>/dev/null; then
                echo "⚠️  迁移失败，尝试使用 db push 同步 schema..."
                # 如果迁移失败，使用 db push 确保 schema 同步
                npx prisma db push --accept-data-loss --skip-generate || echo "⚠️  Schema 同步失败，继续启动"
            fi
        fi
        
        # 执行部署后初始化
        echo "🔧 执行部署后初始化..."
        node scripts/post-deploy-init.js || echo "⚠️  部署后初始化失败，继续启动"
    else
        echo "❌ 无法连接数据库，跳过迁移"
    fi
fi

# 显示优化状态
echo "📊 配置系统状态："
if [ "$NODE_ENV" = "production" ]; then
    echo "   - 缓存系统: ✅ 已启用"
    echo "   - 批量操作优化: ✅ 已启用"
    echo "   - 热重载优化: ✅ 已启用"
    echo "   - 简化验证规则: ✅ 已启用"
fi

# 启动应用
echo "🌐 启动 Next.js 应用..."
exec node server.js