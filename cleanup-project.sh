#!/bin/bash

# AutoAds 项目清理脚本
# 清理临时文件和不必要的目录

echo "开始清理 AutoAds 项目..."

# 1. 清理系统临时文件
echo "1. 清理系统临时文件..."
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete
rm -f temp_file

# 2. 清理构建和缓存文件
echo "2. 清理构建和缓存文件..."
if [ -d ".next" ]; then
    echo "删除 .next 目录..."
    rm -rf .next
fi

if [ -d "node_modules/.cache" ]; then
    echo "删除 node_modules 缓存..."
    rm -rf node_modules/.cache
fi

# 3. 清理日志文件
echo "3. 清理日志文件..."
if [ -d "logs" ]; then
    echo "保留 logs 目录但清理旧日志..."
    find logs -name "*.log" -mtime +7 -delete
fi

# 4. 清理 TypeScript 构建信息
echo "4. 清理 TypeScript 构建信息..."
find . -name "*.tsbuildinfo" -delete

# 5. 清理测试覆盖率报告
echo "5. 清理测试覆盖率报告..."
if [ -d "coverage" ]; then
    rm -rf coverage
fi

# 6. 清理 Docker 构建缓存
echo "6. 清理 Docker 构建缓存..."
docker system prune -f

# 7. 删除不需要的配置文件
echo "7. 整理配置文件..."
# 保留有用的模板文件，删除其他临时配置

echo "清理完成！"
echo ""
echo "建议保留的文件和目录："
echo "- docs/ (文档目录)"
echo "- gofly_admin_v3/ (GoFly 框架源码)"
echo "- src/ (源代码)"
echo "- prisma/ (数据库架构)"
echo "- scripts/ (脚本文件)"
echo "- public/ (静态资源)"
echo ""
echo "已清理的文件类型："
echo "- 系统临时文件 (.DS_Store, Thumbs.db)"
echo "- 构建缓存 (.next, .cache)"
echo "- 临时日志文件"
echo "- TypeScript 构建信息"
echo "- 测试覆盖率报告"