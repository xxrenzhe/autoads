#!/bin/bash

# 模拟自动数据库初始化演示脚本
# 用于展示自动数据库初始化系统的工作流程

set -e

echo "=== GoFly Admin V3 自动数据库初始化系统演示 ==="

# 模拟配置
CONFIG_FILE="gofly_admin_v3/config.yaml"
echo "📁 配置文件: $CONFIG_FILE"

echo -e "\n1. 检查配置文件..."
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ 配置文件存在"
    
    # 显示关键配置
    echo -e "\n📋 数据库配置:"
    grep -A 15 "^database:" "$CONFIG_FILE" | head -8 | sed 's/^/  /'
    
    echo -e "\n📋 Redis 配置:"
    grep -A 10 "^redis:" "$CONFIG_FILE" | head -6 | sed 's/^/  /'
else
    echo "❌ 配置文件不存在"
fi

echo -e "\n2. 模拟自动初始化流程..."

# 模拟命令行参数
echo -e "\n🚀 运行命令: go run main.go -init-db"
echo "   [模拟] 开始数据库初始化..."

# 模拟步骤
echo -e "\n   📦 步骤 1: 连接数据库服务器"
echo "   ✅ 数据库服务器连接成功"

echo -e "\n   📦 步骤 2: 创建数据库"
echo "   ✅ 数据库 'autoads' 创建成功"

echo -e "\n   📦 步骤 3: 运行数据库迁移"
echo "   - 执行迁移: 001_create_tables.sql"
echo "   ✅ users 表创建成功"
echo "   - 执行迁移: 002_create_admin_accounts.sql"
echo "   ✅ admin_accounts 表创建成功"
echo "   - 执行迁移: 003_create_rate_limit_configs.sql"
echo "   ✅ rate_limit_configs 表创建成功"
echo "   ✅ 所有迁移完成"

echo -e "\n   📦 步骤 4: 初始化基础数据"
echo "   - 创建默认管理员账户"
echo "   ✅ 管理员账户创建成功"
echo "   - 初始化速率限制配置"
echo "   ✅ FREE 套餐配置已加载"
echo "   ✅ PRO 套餐配置已加载"
echo "   ✅ MAX 套餐配置已加载"
echo "   ✅ 基础数据初始化完成"

echo -e "\n   📦 步骤 5: 验证初始化结果"
echo "   ✅ 验证通过：共 8 个表，9 条速率限制配置"

echo -e "\n3. 模拟健康检查..."

# 模拟健康检查输出
cat << 'EOF'
{
  "status": "healthy",
  "timestamp": "2025-01-11T10:30:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "duration": "5.2ms",
      "details": {
        "open_connections": 10,
        "in_use": 2,
        "idle": 8
      }
    },
    "database_tables": {
      "status": "healthy",
      "duration": "12.8ms",
      "details": {
        "tables": [
          {"name": "users", "count": 0, "exists": true},
          {"name": "admin_accounts", "count": 1, "exists": true},
          {"name": "rate_limit_configs", "count": 9, "exists": true},
          {"name": "token_balances", "count": 0, "exists": true},
          {"name": "token_transactions", "count": 0, "exists": true}
        ]
      }
    },
    "rate_limit_config": {
      "status": "healthy",
      "duration": "3.1ms",
      "details": {
        "total_configs": 9,
        "active_configs": 9,
        "plan_stats": [
          {"plan": "FREE", "count": 3, "active_count": 3},
          {"plan": "PRO", "count": 3, "active_count": 3},
          {"plan": "MAX", "count": 3, "active_count": 3}
        ]
      }
    }
  },
  "version": "3.0.0",
  "uptime": "30s"
}
EOF

echo -e "\n4. 展示自动初始化中间件..."

echo -e "\n🔄 首次请求触发自动初始化流程："
echo "   1. 用户访问 /api/v1/health"
echo "   2. 中间件检测到数据库未初始化"
echo "   3. 自动执行数据库初始化"
echo "   4. 初始化完成后返回正常响应"

echo -e "\n5. 支持的命令行选项："
echo -e "   🎯 go run main.go -version"
echo "      → 显示版本信息"
echo -e "\n   🎯 go run main.go -init-db"
echo "      → 初始化数据库后退出"
echo -e "\n   🎯 go run main.go -force-init"
echo "      → 强制重新初始化数据库（清空数据）"
echo -e "\n   🎯 go run main.go"
echo "      → 正常启动应用（包含自动初始化中间件）"

echo -e "\n6. 健康检查端点："
echo -e "   🩺 GET /health"
echo "      → 完整健康状态"
echo -e "\n   🩺 GET /ready"
echo "      → 就绪状态检查"
echo -e "\n   🩺 GET /live"
echo "      → 存活状态检查"

echo -e "\n=== 自动数据库初始化系统演示完成 ==="
echo -e "\n✨ 主要特性："
echo "   - 命令行自动初始化"
echo "   - 运行时自动初始化（中间件）"
echo "   - 健康检查集成"
echo "   - 优雅的错误处理"
echo "   - 完整的日志记录"