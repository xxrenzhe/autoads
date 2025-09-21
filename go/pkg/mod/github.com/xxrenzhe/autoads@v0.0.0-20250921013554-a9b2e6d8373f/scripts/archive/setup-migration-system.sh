#!/bin/bash

# 迁移系统设置脚本
# 用于初始化和配置数据迁移系统

set -e

echo "🚀 开始设置数据迁移系统..."

# 检查必要的依赖
echo "📦 检查依赖..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查tsx
if ! command -v tsx &> /dev/null; then
    echo "📦 安装 tsx..."
    npm install -g tsx
fi

# 检查数据库连接
echo "🔗 检查数据库连接..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL 环境变量未设置"
    echo "请在 .env 文件中设置 DATABASE_URL"
    exit 1
fi

# 创建必要的目录
echo "📁 创建目录结构..."
mkdir -p backups
mkdir -p logs/migrations

# 设置权限
chmod +x scripts/migrations/*.ts
chmod +x scripts/setup-migration-system.sh

# 运行数据库迁移（Prisma）
echo "🗄️  运行Prisma数据库迁移..."
npx prisma migrate deploy

# 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npx prisma generate

# 测试迁移系统
echo "🧪 测试迁移系统..."
npm run migrate:status || echo "ℹ️  首次运行，迁移表将在首次执行时创建"

# 运行系统测试
echo "🔍 运行系统测试..."
tsx scripts/migrations/test-migration-system.ts

echo ""
echo "✅ 数据迁移系统设置完成！"
echo ""
echo "📋 可用命令："
echo "  npm run migrate:status     - 查看迁移状态"
echo "  npm run migrate:run        - 执行待处理迁移"
echo "  npm run migrate:validate   - 验证所有迁移"
echo "  npm run rollback:analyze   - 分析回滚计划"
echo "  npm run rollback:safe      - 执行安全回滚"
echo "  npm run rollback:list      - 列出所有备份"
echo ""
echo "📚 详细文档请查看: scripts/migrations/README.md"
echo ""
echo "🎉 现在可以开始使用数据迁移系统了！"