#!/bin/bash

# 优化验证脚本
# 验证所有内存和Redis优化是否正常工作

set -e

echo "🔍 验证系统优化..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# 测试结果记录
pass_test() {
    echo -e "${GREEN}✅ $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail_test() {
    echo -e "${RED}❌ $1${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

warn_test() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

info_test() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. 验证环境变量
echo "📋 验证环境变量配置..."

if [ -n "$REDIS_URL" ]; then
    pass_test "REDIS_URL 已配置"
    
    # 检查是否为集群配置
    if [[ "$REDIS_URL" == *","* ]]; then
        NODE_COUNT=$(echo "$REDIS_URL" | tr ',' '\n' | wc -l)
        pass_test "Redis集群配置 ($NODE_COUNT 节点)"
    else
        pass_test "Redis单节点配置"
    fi
else
    warn_test "REDIS_URL 未配置，将使用内存缓存"
fi

if [ "$LOW_MEMORY_MODE" = "true" ]; then
    pass_test "低内存模式已启用"
else
    info_test "标准内存模式"
fi

if [ -n "$NODE_OPTIONS" ]; then
    pass_test "Node.js 内存选项已配置: $NODE_OPTIONS"
else
    warn_test "Node.js 内存选项未配置"
fi

# 2. 验证Redis连接
echo ""
echo "🔗 验证Redis连接..."

if [ -n "$REDIS_URL" ]; then
    # 提取第一个Redis URL进行测试
    FIRST_REDIS_URL=$(echo "$REDIS_URL" | cut -d',' -f1)
    
    # 解析Redis URL
    REDIS_HOST=$(echo "$FIRST_REDIS_URL" | sed -n 's|redis://[^@]*@\([^:]*\):.*|\1|p')
    REDIS_PORT=$(echo "$FIRST_REDIS_URL" | sed -n 's|redis://[^@]*@[^:]*:\([0-9]*\).*|\1|p')
    REDIS_PASSWORD=$(echo "$FIRST_REDIS_URL" | sed -n 's|redis://[^:]*:\([^@]*\)@.*|\1|p')
    
    if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
        if command -v redis-cli >/dev/null 2>&1; then
            if timeout 5 redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping >/dev/null 2>&1; then
                pass_test "Redis连接测试成功 ($REDIS_HOST:$REDIS_PORT)"
                
                # 测试Redis性能
                REDIS_LATENCY=$(timeout 5 redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --latency-history -i 1 2>/dev/null | head -1 | awk '{print $4}' || echo "unknown")
                if [ "$REDIS_LATENCY" != "unknown" ]; then
                    pass_test "Redis延迟: ${REDIS_LATENCY}ms"
                fi
            else
                fail_test "Redis连接测试失败"
            fi
        else
            warn_test "redis-cli 不可用，跳过连接测试"
        fi
    else
        fail_test "无法解析Redis URL"
    fi
else
    info_test "跳过Redis连接测试（未配置）"
fi

# 3. 验证内存配置
echo ""
echo "💾 验证内存配置..."

# 检查Node.js内存限制
if echo "$NODE_OPTIONS" | grep -q "max-old-space-size"; then
    HEAP_SIZE=$(echo "$NODE_OPTIONS" | grep -o 'max-old-space-size=[0-9]*' | cut -d'=' -f2)
    
    if [ "$LOW_MEMORY_MODE" = "true" ] && [ "$HEAP_SIZE" -le 768 ]; then
        pass_test "低内存模式堆大小配置正确: ${HEAP_SIZE}MB"
    elif [ "$LOW_MEMORY_MODE" != "true" ] && [ "$HEAP_SIZE" -ge 1024 ]; then
        pass_test "标准模式堆大小配置正确: ${HEAP_SIZE}MB"
    else
        warn_test "堆大小可能不适合当前模式: ${HEAP_SIZE}MB"
    fi
else
    warn_test "未配置堆内存大小限制"
fi

# 检查垃圾回收配置
if echo "$NODE_OPTIONS" | grep -q "expose-gc"; then
    pass_test "垃圾回收已暴露"
else
    warn_test "垃圾回收未暴露，内存优化功能受限"
fi

# 4. 验证应用程序响应
echo ""
echo "🌐 验证应用程序响应..."

PORT=${PORT:-3000}

if command -v curl >/dev/null 2>&1; then
    # 健康检查
    if curl -f -s "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
        pass_test "应用程序健康检查通过"
        
        # 获取内存信息
        MEMORY_INFO=$(curl -s "http://localhost:$PORT/api/health" 2>/dev/null | grep -o '"memory":[^}]*}' 2>/dev/null || echo "")
        if [ -n "$MEMORY_INFO" ]; then
            pass_test "内存信息API可用"
        else
            warn_test "内存信息API不可用"
        fi
    else
        fail_test "应用程序健康检查失败"
    fi
else
    warn_test "curl 不可用，跳过应用程序测试"
fi

# 5. 验证文件系统
echo ""
echo "📁 验证文件系统..."

# 检查优化脚本
SCRIPTS=(
    "scripts/optimized-startup.sh"
    "scripts/monitor-memory-usage.sh"
    "scripts/verify-optimizations.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        pass_test "$script 存在且可执行"
    else
        fail_test "$script 不存在或不可执行"
    fi
done

# 检查优化的源文件
OPTIMIZED_FILES=(
    "src/lib/cache/optimized-redis-client.ts"
    "src/lib/performance/advanced-memory-optimizer.ts"
    "src/lib/startup/optimized-initializer.ts"
)

for file in "${OPTIMIZED_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass_test "$file 存在"
    else
        fail_test "$file 不存在"
    fi
done

# 6. 验证Docker配置
echo ""
echo "🐳 验证Docker配置..."

DOCKERFILES=(
    "Dockerfile.optimized-2c4g"
    "Dockerfile.standalone-2c4g-fixed"
)

for dockerfile in "${DOCKERFILES[@]}"; do
    if [ -f "$dockerfile" ]; then
        pass_test "$dockerfile 存在"
        
        # 检查关键优化配置
        if grep -q "LOW_MEMORY_MODE=true" "$dockerfile"; then
            pass_test "$dockerfile 包含低内存模式配置"
        else
            warn_test "$dockerfile 缺少低内存模式配置"
        fi
        
        if grep -q "max-old-space-size" "$dockerfile"; then
            pass_test "$dockerfile 包含内存限制配置"
        else
            warn_test "$dockerfile 缺少内存限制配置"
        fi
    else
        warn_test "$dockerfile 不存在"
    fi
done

# 7. 性能基准测试
echo ""
echo "⚡ 执行性能基准测试..."

if command -v node >/dev/null 2>&1; then
    # 测试启动时间
    START_TIME=$(date +%s%N)
    
    # 简单的Node.js内存测试
    node -e "
        const start = Date.now();
        const memBefore = process.memoryUsage();
        
        // 创建一些对象测试内存
        const arr = new Array(10000).fill(0).map((_, i) => ({ id: i, data: 'test' }));
        
        const memAfter = process.memoryUsage();
        const duration = Date.now() - start;
        
        console.log('内存测试完成:');
        console.log('  执行时间:', duration + 'ms');
        console.log('  内存增长:', Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024) + 'MB');
        
        if (duration < 1000) {
            console.log('✅ 性能测试通过');
            process.exit(0);
        } else {
            console.log('⚠️  性能可能需要优化');
            process.exit(1);
        }
    " && pass_test "Node.js性能测试通过" || warn_test "Node.js性能测试未通过"
else
    warn_test "Node.js 不可用，跳过性能测试"
fi

# 8. 生成报告
echo ""
echo "📊 优化验证报告"
echo "=================="
echo -e "${GREEN}通过测试: $TESTS_PASSED${NC}"
echo -e "${RED}失败测试: $TESTS_FAILED${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo ""

# 总体评估
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ "$TOTAL_TESTS" -gt 0 ]; then
    SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    echo "成功率: ${SUCCESS_RATE}%"
    
    if [ "$SUCCESS_RATE" -ge 90 ]; then
        echo -e "${GREEN}🎉 优化验证优秀！系统已充分优化。${NC}"
        exit 0
    elif [ "$SUCCESS_RATE" -ge 70 ]; then
        echo -e "${YELLOW}⚠️  优化验证良好，但有改进空间。${NC}"
        exit 0
    else
        echo -e "${RED}❌ 优化验证不佳，需要修复问题。${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  无法执行测试，请检查环境配置。${NC}"
    exit 1
fi