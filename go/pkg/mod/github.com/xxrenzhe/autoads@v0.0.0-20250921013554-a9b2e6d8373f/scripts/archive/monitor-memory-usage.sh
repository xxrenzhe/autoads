#!/bin/bash

# 内存使用监控脚本
# 实时监控应用程序内存使用情况

set -e

echo "📊 启动内存使用监控..."

# 配置
MONITOR_INTERVAL=${MONITOR_INTERVAL:-10}  # 监控间隔（秒）
LOG_FILE=${LOG_FILE:-"/tmp/memory-monitor.log"}
ALERT_THRESHOLD=${ALERT_THRESHOLD:-600}   # 警告阈值（MB）
CRITICAL_THRESHOLD=${CRITICAL_THRESHOLD:-700}  # 严重阈值（MB）

# 创建日志文件
touch "$LOG_FILE"

echo "⚙️  监控配置:"
echo "  - 监控间隔: ${MONITOR_INTERVAL}秒"
echo "  - 日志文件: $LOG_FILE"
echo "  - 警告阈值: ${ALERT_THRESHOLD}MB"
echo "  - 严重阈值: ${CRITICAL_THRESHOLD}MB"
echo ""

# 获取进程ID
get_app_pid() {
    # 尝试多种方式找到应用进程
    local pid=""
    
    # 方法1: 通过端口查找
    if command -v lsof >/dev/null 2>&1; then
        pid=$(lsof -ti:${PORT:-3000} 2>/dev/null | head -1)
    fi
    
    # 方法2: 通过进程名查找
    if [ -z "$pid" ]; then
        pid=$(pgrep -f "next.*start\|node.*server" 2>/dev/null | head -1)
    fi
    
    # 方法3: 通过Node.js进程查找
    if [ -z "$pid" ]; then
        pid=$(pgrep -f "node" 2>/dev/null | head -1)
    fi
    
    echo "$pid"
}

# 格式化内存大小
format_memory() {
    local bytes=$1
    local mb=$((bytes / 1024))
    echo "${mb}MB"
}

# 获取系统内存信息
get_system_memory() {
    if [ -f /proc/meminfo ]; then
        local total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local available_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        local used_kb=$((total_kb - available_kb))
        
        echo "系统内存: $(format_memory $((used_kb * 1024))) / $(format_memory $((total_kb * 1024)))"
    else
        echo "系统内存: 无法获取"
    fi
}

# 获取进程内存信息
get_process_memory() {
    local pid=$1
    
    if [ -z "$pid" ]; then
        echo "进程内存: 未找到应用进程"
        return
    fi
    
    if [ -f "/proc/$pid/status" ]; then
        local vmrss_kb=$(grep VmRSS "/proc/$pid/status" 2>/dev/null | awk '{print $2}')
        local vmsize_kb=$(grep VmSize "/proc/$pid/status" 2>/dev/null | awk '{print $2}')
        
        if [ -n "$vmrss_kb" ] && [ -n "$vmsize_kb" ]; then
            local rss_mb=$((vmrss_kb / 1024))
            local vsize_mb=$((vmsize_kb / 1024))
            
            echo "进程内存: RSS=$(format_memory $((vmrss_kb * 1024))) VSZ=$(format_memory $((vmsize_kb * 1024)))"
            echo "$rss_mb"  # 返回RSS MB用于阈值检查
        else
            echo "进程内存: 无法获取详细信息"
            echo "0"
        fi
    else
        echo "进程内存: 进程不存在 (PID: $pid)"
        echo "0"
    fi
}

# 获取Node.js内存信息（如果可用）
get_nodejs_memory() {
    local pid=$1
    
    if [ -z "$pid" ]; then
        return
    fi
    
    # 尝试通过API获取Node.js内存信息
    if command -v curl >/dev/null 2>&1; then
        local memory_info=$(curl -s "http://localhost:${PORT:-3000}/api/health" 2>/dev/null | grep -o '"memory":[^}]*}' 2>/dev/null || echo "")
        
        if [ -n "$memory_info" ]; then
            echo "Node.js内存: $memory_info"
        fi
    fi
}

# 检查内存阈值
check_thresholds() {
    local rss_mb=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [ "$rss_mb" -gt "$CRITICAL_THRESHOLD" ]; then
        echo "🚨 严重警告: 内存使用超过严重阈值 (${rss_mb}MB > ${CRITICAL_THRESHOLD}MB)"
        echo "[$timestamp] CRITICAL: Memory usage ${rss_mb}MB exceeds critical threshold ${CRITICAL_THRESHOLD}MB" >> "$LOG_FILE"
        
        # 触发紧急优化
        trigger_emergency_optimization
        
    elif [ "$rss_mb" -gt "$ALERT_THRESHOLD" ]; then
        echo "⚠️  警告: 内存使用超过警告阈值 (${rss_mb}MB > ${ALERT_THRESHOLD}MB)"
        echo "[$timestamp] WARNING: Memory usage ${rss_mb}MB exceeds alert threshold ${ALERT_THRESHOLD}MB" >> "$LOG_FILE"
        
        # 触发预防性优化
        trigger_preventive_optimization
    fi
}

# 触发紧急优化
trigger_emergency_optimization() {
    echo "🔧 触发紧急内存优化..."
    
    # 尝试通过API触发优化
    if command -v curl >/dev/null 2>&1; then
        curl -s -X POST "http://localhost:${PORT:-3000}/api/admin/optimize/emergency" >/dev/null 2>&1 || true
    fi
    
    # 手动垃圾回收（如果可能）
    if [ -n "$APP_PID" ]; then
        kill -USR2 "$APP_PID" 2>/dev/null || true
    fi
}

# 触发预防性优化
trigger_preventive_optimization() {
    echo "🔧 触发预防性内存优化..."
    
    # 尝试通过API触发优化
    if command -v curl >/dev/null 2>&1; then
        curl -s -X POST "http://localhost:${PORT:-3000}/api/admin/optimize/preventive" >/dev/null 2>&1 || true
    fi
}

# 主监控循环
main_monitor_loop() {
    local iteration=0
    
    while true; do
        iteration=$((iteration + 1))
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        
        echo "[$timestamp] 监控迭代 #$iteration"
        echo "=================================="
        
        # 获取应用进程ID
        APP_PID=$(get_app_pid)
        
        if [ -n "$APP_PID" ]; then
            echo "应用进程: PID $APP_PID"
            
            # 获取内存信息
            get_system_memory
            local rss_mb=$(get_process_memory "$APP_PID")
            get_nodejs_memory "$APP_PID"
            
            # 检查阈值
            if [ "$rss_mb" != "0" ] && [ -n "$rss_mb" ]; then
                check_thresholds "$rss_mb"
                
                # 记录到日志
                echo "[$timestamp] INFO: Memory usage ${rss_mb}MB" >> "$LOG_FILE"
            fi
        else
            echo "⚠️  未找到应用进程"
            echo "[$timestamp] WARNING: Application process not found" >> "$LOG_FILE"
        fi
        
        echo ""
        sleep "$MONITOR_INTERVAL"
    done
}

# 信号处理
cleanup() {
    echo ""
    echo "📊 内存监控已停止"
    echo "日志文件: $LOG_FILE"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 启动监控
echo "🚀 开始监控内存使用..."
echo ""

main_monitor_loop