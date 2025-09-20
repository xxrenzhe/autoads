#!/bin/bash

# AutoAds GoFly 启动脚本
# 用于启动和测试 GoFly Admin 后台管理系统

echo "================================"
echo "AutoAds GoFly 启动脚本"
echo "================================"

# 检查环境
echo "检查环境..."
if ! command -v go &> /dev/null; then
    echo "错误: Go 未安装"
    exit 1
fi

if ! command -v mysql &> /dev/null; then
    echo "警告: MySQL 未安装，请确保数据库可用"
fi

# 检查配置文件
if [ ! -f "config.yaml" ]; then
    echo "错误: config.yaml 不存在"
    exit 1
fi

# 创建数据库（如果不存在）
echo "创建数据库..."
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS autoads_gofly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || echo "请手动创建数据库: CREATE DATABASE autoads_gofly"

# 初始化数据库
echo "初始化数据库..."
if [ -f "scripts/init.sql" ]; then
    mysql -u root -p autoads_gofly < scripts/init.sql 2>/dev/null || echo "请手动执行: mysql -u root -p autoads_gofly < scripts/init.sql"
else
    echo "警告: 数据库初始化脚本不存在"
fi

# 下载依赖
echo "下载 Go 依赖..."
go mod download
go mod tidy

# 创建bin目录
mkdir -p bin

# 构建应用
echo "构建应用..."
go build -o bin/gofly_admin main.go

if [ $? -eq 0 ]; then
    echo "构建成功！"
    
    # 启动应用
    echo "启动应用..."
    echo "访问地址: http://localhost:8080"
    echo "管理员登录: POST /api/v1/admin/login"
    echo "用户名: admin"
    echo "密码: admin123"
    echo ""
    echo "API文档:"
    echo "- 健康检查: GET /health"
    echo "- 用户注册: POST /api/v1/user/register"
    echo "- 用户登录: POST /api/v1/user/login"
    echo "- 管理员登录: POST /api/v1/admin/login"
    echo "- 管理员仪表板: GET /api/v1/admin/dashboard"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo ""
    
    # 设置环境变量
    export GOLLY_ENV=development
    
    # 运行应用
    ./bin/gofly_admin
else
    echo "构建失败！"
    exit 1
fi