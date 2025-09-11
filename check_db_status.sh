#!/bin/bash

# 数据库状态检查脚本
# 用于验证 gofly_admin_v3 数据库初始化状态

set -e

echo "=== GoFly Admin V3 数据库状态检查 ==="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认配置文件路径
CONFIG_FILE="${SCRIPT_DIR}/gofly_admin_v3/config.yaml"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "错误: 配置文件 $CONFIG_FILE 不存在"
    exit 1
fi

# 提取数据库配置（使用 grep 和 awk 来解析 YAML）
echo -e "\n读取配置文件..."
DB_HOST=$(grep -A 10 "^database:" "$CONFIG_FILE" | grep "host:" | awk '{print $2}' | tr -d '"')
DB_PORT=$(grep -A 10 "^database:" "$CONFIG_FILE" | grep "port:" | awk '{print $2}')
DB_USER=$(grep -A 10 "^database:" "$CONFIG_FILE" | grep "username:" | awk '{print $2}' | tr -d '"')
DB_PASSWORD=$(grep -A 10 "^database:" "$CONFIG_FILE" | grep "password:" | awk '{print $2}' | tr -d '"')
DB_NAME=$(grep -A 10 "^database:" "$CONFIG_FILE" | grep "database:" | awk '{print $2}' | tr -d '"')

# 设置默认值
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"3306"}
DB_USER=${DB_USER:-"root"}
DB_NAME=${DB_NAME:-"autoads"}

echo "数据库配置:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT" 
echo "  Name: $DB_NAME"
echo "  User: $DB_USER"

# 检查 MySQL 是否可访问
echo -e "\n检查 MySQL 连接..."
if ! mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" &> /dev/null; then
    echo "❌ 错误: 无法连接到 MySQL 服务器"
    echo "请检查数据库连接参数和 MySQL 服务状态"
    exit 1
fi

echo "✅ MySQL 连接成功"

# 检查数据库是否存在
echo -e "\n检查数据库..."
DB_EXISTS=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e \
    "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DB_NAME';" | tail -n 1)

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "❌ 数据库 '$DB_NAME' 不存在"
    echo "提示: 运行 './gofly_admin_v3/scripts/init_db.sh' 来初始化数据库"
    exit 1
fi

echo "✅ 数据库 '$DB_NAME' 存在"

# 检查数据库表
echo -e "\n检查数据库表..."
TABLES=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
    "SELECT table_name FROM information_schema.tables WHERE table_schema = '$DB_NAME' ORDER BY table_name;" | \
    tail -n +2)

echo "数据库表:"
if [ -z "$TABLES" ]; then
    echo "  ❌ 没有找到任何表"
    echo "提示: 数据库未正确初始化"
    exit 1
else
    echo "$TABLES" | sed 's/^/  ✅ /'
fi

# 检查关键表
REQUIRED_TABLES=("users" "admin_accounts" "rate_limit_configs")
echo -e "\n检查关键表:"
for table in "${REQUIRED_TABLES[@]}"; do
    if echo "$TABLES" | grep -q "^$table$"; then
        # 获取记录数
        COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
            "SELECT COUNT(*) FROM $table;" | tail -n 1)
        echo "  ✅ $table ($COUNT 条记录)"
    else
        echo "  ❌ $table (缺失)"
    fi
done

# 检查速率限制配置
echo -e "\n检查速率限制配置..."
RL_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
    "SELECT COUNT(*) FROM rate_limit_configs WHERE is_active = 1;" | tail -n 1)

if [ "$RL_COUNT" -gt 0 ]; then
    echo "✅ 找到 $RL_COUNT 个激活的速率限制配置"
    
    echo -e "\n速率限制配置详情:"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
        "SELECT plan, feature, per_minute, per_hour, concurrent FROM rate_limit_configs WHERE is_active = 1 ORDER BY plan, feature;" | \
        sed 's/^/  /'
else
    echo "❌ 没有激活的速率限制配置"
fi

# 检查管理员账户
echo -e "\n检查管理员账户..."
ADMIN_COUNT=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e \
    "SELECT COUNT(*) FROM admin_accounts WHERE status = 'ACTIVE';" | tail -n 1)

if [ "$ADMIN_COUNT" -gt 0 ]; then
    echo "✅ 找到 $ADMIN_COUNT 个激活的管理员账户"
else
    echo "❌ 没有激活的管理员账户"
fi

# 检查 Redis 配置
echo -e "\n检查 Redis 配置..."
REDIS_ENABLED=$(grep -A 10 "^redis:" "$CONFIG_FILE" | grep "enable:" | awk '{print $2}' | tr -d '"' | tr '[:upper:]' '[:lower:]')

if [ "$REDIS_ENABLED" = "true" ]; then
    REDIS_HOST=$(grep -A 10 "^redis:" "$CONFIG_FILE" | grep "host:" | awk '{print $2}' | tr -d '"')
    REDIS_PORT=$(grep -A 10 "^redis:" "$CONFIG_FILE" | grep "port:" | awk '{print $2}')
    REDIS_HOST=${REDIS_HOST:-"localhost"}
    REDIS_PORT=${REDIS_PORT:-"6379"}
    
    echo "Redis 配置: $REDIS_HOST:$REDIS_PORT"
    
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &> /dev/null; then
            echo "✅ Redis 连接成功"
        else
            echo "❌ Redis 连接失败"
        fi
    else
        echo "⚠️  未找到 redis-cli 命令，无法测试 Redis 连接"
    fi
else
    echo "Redis 未启用"
fi

# 总结
echo -e "\n=== 总结 ==="
if [ "$DB_EXISTS" -eq 1 ] && [ -n "$TABLES" ] && [ "$RL_COUNT" -gt 0 ]; then
    echo "✅ 数据库已正确初始化"
    echo "✅ 速率限制系统已配置"
    echo "✅ 系统可以正常运行"
else
    echo "❌ 数据库初始化不完整"
    echo "提示: 运行 './gofly_admin_v3/scripts/init_db.sh' 来完整初始化数据库"
fi