#!/bin/bash

# 测试Dockerfile语法和npm配置
set -e

echo "🔍 测试Dockerfile语法..."

# 检查Dockerfile语法 - 构建到第一个RUN命令
echo "  测试构建第一阶段..."
if docker build --target base -f Dockerfile.standalone . -t test-syntax > /dev/null 2>&1; then
    echo "  ✅ Dockerfile基础阶段语法正确"
    docker rmi test-syntax > /dev/null 2>&1 || true
else
    echo "  ❌ Dockerfile语法错误"
    echo "  详细错误信息:"
    docker build --target base -f Dockerfile.standalone . -t test-syntax 2>&1 | head -20
    exit 1
fi

# 测试npm配置命令
echo "🔧 测试npm配置命令..."

# 创建临时容器测试npm配置
docker run --rm node:22-alpine sh -c "
    npm config set registry https://registry.npmjs.org/
    npm config set cache /tmp/.npm
    npm config set prefer-offline true
    npm config set maxsockets 20
    echo '✅ npm配置测试成功'
" || {
    echo "❌ npm配置测试失败"
    exit 1
}

echo "🎉 Dockerfile语法验证完成！"
