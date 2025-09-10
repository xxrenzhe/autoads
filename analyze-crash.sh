#!/bin/bash

# Container Crash Analysis Script
# 用于分析容器崩溃问题的脚本

echo "=========================================="
echo "Container Crash Analysis Tool"
echo "=========================================="

# 检查是否有容器正在运行
echo "Checking running containers..."
docker ps --filter "name=url-batch-checker" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Checking recent container logs..."
echo "================================"

# 获取最近退出的容器
CONTAINER_ID=$(docker ps -a --filter "name=url-batch-checker" --format "{{.ID}}" | head -1)

if [ -n "$CONTAINER_ID" ]; then
    echo "Showing logs for container: $CONTAINER_ID"
    echo ""
    
    # 显示最后100行日志
    docker logs --tail 100 $CONTAINER_ID
    
    echo ""
    echo "================================"
    echo "Crash Analysis:"
    echo "================================"
    
    # 检查常见的崩溃原因
    if docker logs $CONTAINER_ID 2>&1 | grep -q "OutOfMemoryError"; then
        echo "❌ Out of Memory Error detected"
        echo "   Consider increasing memory limit or optimizing memory usage"
    fi
    
    if docker logs $CONTAINER_ID 2>&1 | grep -q "Cannot allocate memory"; then
        echo "❌ Memory Allocation Error detected"
        echo "   Node.js memory settings may be too high for container limits"
    fi
    
    if docker logs $CONTAINER_ID 2>&1 | grep -q "JavaScript heap out of memory"; then
        echo "❌ JavaScript Heap Out of Memory detected"
        echo "   Need to adjust --max-old-space-size in NODE_OPTIONS"
    fi
    
    if docker logs $CONTAINER_ID 2>&1 | grep -q "Segmentation fault"; then
        echo "❌ Segmentation Fault detected"
        echo "   This could be related to native modules or memory corruption"
    fi
    
    # 检查是否正常启动
    if docker logs $CONTAINER_ID 2>&1 | grep -q "Starting ChangeLink AutoAds Application"; then
        echo "✅ Application started successfully"
        
        # 检查启动后的内存使用
        if docker logs $CONTAINER_ID 2>&1 | grep -q "Initial memory usage:"; then
            echo "📊 Memory usage logged at startup"
        fi
    fi
    
    # 检查Next.js编译错误
    if docker logs $CONTAINER_ID 2>&1 | grep -q "Build error occurred"; then
        echo "❌ Next.js Build Error detected"
        echo "   Check build logs for specific errors"
    fi
    
    # 检查数据库连接问题
    if docker logs $CONTAINER_ID 2>&1 | grep -q "Connection refused\|ECONNREFUSED"; then
        echo "❌ Database Connection Error detected"
        echo "   Verify DATABASE_URL and database availability"
    fi
    
    echo ""
    echo "================================"
    echo "Container Status:"
    docker inspect $CONTAINER_ID --format='{{.State.Status}} - Exit Code: {{.State.ExitCode}}'
    
    echo ""
    echo "Memory Usage (if available):"
    docker stats $CONTAINER_ID --no-stream --format "table {{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || echo "Container not running"
    
else
    echo "No url-batch-checker container found"
    echo ""
    echo "Checking all recent containers..."
    docker ps -a --filter "ancestor=url-batch-checker" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.ExitCode}}" | head -10
fi

echo ""
echo "================================"
echo "System Resources:"
echo "================================"
echo "Docker Memory Limit:"
docker system info | grep "Total Memory"

echo ""
echo "Host Memory:"
free -h

echo ""
echo "To view live container logs, run:"
echo "  docker logs -f <container-id>"
echo ""
echo "To start a new container with debug mode:"
echo "  docker run -it --rm -p 3000:3000 --memory=4g --memory-swap=4g url-batch-checker:latest"