#!/bin/bash

# 数据库初始化脚本
# 用于初始化 gofly_admin_v3 项目的数据库

set -e

echo "=== GoFly Admin V3 数据库初始化 ==="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认配置文件路径
CONFIG_FILE="${SCRIPT_DIR}/config.yaml"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "错误: 配置文件 $CONFIG_FILE 不存在"
    exit 1
fi

# 提取数据库配置（使用 yq 或其他 YAML 解析工具）
if command -v yq &> /dev/null; then
    DB_HOST=$(yq e '.db.host' "$CONFIG_FILE")
    DB_PORT=$(yq e '.db.port' "$CONFIG_FILE")
    DB_NAME=$(yq e '.db.name' "$CONFIG_FILE")
    DB_USER=$(yq e '.db.user' "$CONFIG_FILE")
    DB_PASSWORD=$(yq e '.db.password' "$CONFIG_FILE")
else
    echo "警告: 未找到 yq 命令，使用默认配置"
    DB_HOST="localhost"
    DB_PORT="3306"
    DB_NAME="autoads"
    DB_USER="root"
    DB_PASSWORD=""
fi

echo "数据库配置:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Name: $DB_NAME"
echo "  User: $DB_USER"

# 检查 MySQL 是否可访问
echo -e "\n检查 MySQL 连接..."
if ! mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &> /dev/null; then
    echo "错误: 无法连接到 MySQL 服务器"
    echo "请检查数据库连接参数和 MySQL 服务状态"
    exit 1
fi

echo "✅ MySQL 连接成功"

# 创建数据库（如果不存在）
echo -e "\n创建数据库..."
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e \
    "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "✅ 数据库创建成功"

# 运行迁移文件
echo -e "\n运行数据库迁移..."

# 按顺序执行迁移文件
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"

if [ -d "$MIGRATIONS_DIR" ]; then
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            echo "执行迁移: $(basename "$migration_file")"
            mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$migration_file"
            echo "✅ 迁移完成"
        fi
    done
else
    echo "警告: 迁移目录 $MIGRATIONS_DIR 不存在"
fi

# 运行初始化脚本
echo -e "\n运行初始化脚本..."
INIT_SCRIPT="${SCRIPT_DIR}/scripts/init.sql"
if [ -f "$INIT_SCRIPT" ]; then
    echo "执行初始化脚本..."
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$INIT_SCRIPT"
    echo "✅ 初始化脚本执行完成"
else
    echo "警告: 初始化脚本 $INIT_SCRIPT 不存在"
fi

# 执行 Prisma 迁移（如果存在）
echo -e "\n检查 Prisma 迁移..."
if [ -f "${SCRIPT_DIR}/prisma/schema.prisma" ]; then
    if command -v npx &> /dev/null; then
        cd "$SCRIPT_DIR"
        echo "执行 Prisma 生成..."
        npx prisma generate
        echo "执行 Prisma 迁移..."
        npx prisma db push
        echo "✅ Prisma 迁移完成"
        
        # 执行种子数据
        if [ -f "prisma/seed-default-plans.ts" ]; then
            echo "执行种子数据..."
            npx tsx prisma/seed-default-plans.ts
            echo "✅ 种子数据执行完成"
        fi
    else
        echo "警告: 未找到 npx 命令，跳过 Prisma 迁移"
    fi
fi

# 验证表是否创建成功
echo -e "\n验证数据库表..."
TABLES=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
    "SELECT table_name FROM information_schema.tables WHERE table_schema = '$DB_NAME' ORDER BY table_name;" | \
    tail -n +2)

echo "创建的表:"
echo "$TABLES" | sed 's/^/  - /'

# 验证数据
echo -e "\n验证数据..."

# 检查用户数
USER_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
    "SELECT COUNT(*) FROM users;" | tail -n 1)
echo "用户数: $USER_COUNT"

# 检查速率限制配置
RATE_LIMIT_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
    "SELECT COUNT(*) FROM rate_limit_configs;" | tail -n 1)
echo "速率限制配置数: $RATE_LIMIT_COUNT"

if [ "$RATE_LIMIT_COUNT" -gt 0 ]; then
    echo -e "\n速率限制配置:"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
        "SELECT plan, feature, per_minute, per_hour, concurrent FROM rate_limit_configs WHERE is_active = 1 ORDER BY plan, feature;" | \
        sed 's/^/  /'
fi

echo -e "\n=== 数据库初始化完成 ==="
echo "数据库 '$DB_NAME' 已成功初始化"

# 清理
echo -e "\n提示: 运行 'go run test_db_connection.go' 来测试数据库连接"