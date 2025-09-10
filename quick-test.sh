#!/bin/bash

# 简单的容器测试脚本
echo "=== 容器崩溃修复测试 ==="
echo ""

# 检查 Docker 状态
echo "1. 检查 Docker 状态..."
docker info | grep -E "(Memory|CPUs)" | head -2

echo ""
echo "2. 检查已有镜像..."
docker images | grep -E "(url-batch|changelink|node)" | head -5

echo ""
echo "3. 建议的测试步骤："
echo "   a) 增加 Docker 内存限制到 6GB 或更多"
echo "   b) 使用 Dockerfile.standalone-lite 构建镜像"
echo "   c) 运行容器时设置 4GB 内存限制"
echo "   d) 观察容器是否在 1 分钟后崩溃"

echo ""
echo "4. 修复内容总结："
echo "   - 修复了内存配置冲突"
echo "   - 优化了监控间隔（5分钟）"
echo "   - 减少了日志频率"
echo "   - 添加了内存验证脚本"

echo ""
echo "如需构建测试镜像，请运行："
echo "docker build -f Dockerfile.standalone-lite -t url-batch-checker:test ."
echo ""
echo "如需运行容器测试，请运行："
echo "docker run --rm --memory=4g --memory-swap=4g -p 3000:3000 url-batch-checker:test"