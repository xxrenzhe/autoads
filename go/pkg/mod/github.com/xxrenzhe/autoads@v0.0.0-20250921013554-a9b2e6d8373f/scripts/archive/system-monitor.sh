#!/bin/bash

# System Monitoring Script for Admin Management System
# Usage: ./system-monitor.sh [status|logs|metrics|alerts|cleanup]

set -e

OPERATION=${1:-status}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in Docker
is_docker() {
    [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null
}

# Get system status
get_system_status() {
    log_info "System Status Overview"
    echo "======================"
    echo ""
    
    # System uptime
    echo "System Uptime:"
    uptime
    echo ""
    
    # Memory usage
    echo "Memory Usage:"
    free -h
    echo ""
    
    # Disk usage
    echo "Disk Usage:"
    df -h
    echo ""
    
    # CPU usage
    echo "CPU Usage (last 1 minute):"
    if command -v top >/dev/null 2>&1; then
        top -bn1 | grep "Cpu(s)" | awk '{print $2 $3 $4 $5 $6 $7 $8}'
    else
        echo "top command not available"
    fi
    echo ""
    
    # Load average
    echo "Load Average:"
    cat /proc/loadavg
    echo ""
    
    # Network connections
    echo "Network Connections:"
    if command -v ss >/dev/null 2>&1; then
        ss -tuln | grep -E ':(3000|5432|6379|80|443)' | head -10
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln | grep -E ':(3000|5432|6379|80|443)' | head -10
    else
        echo "Network tools not available"
    fi
    echo ""
    
    # Process status
    echo "Key Processes:"
    if is_docker; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        ps aux | grep -E "(node|postgres|redis|nginx)" | grep -v grep | head -10
    fi
    echo ""
}

# Check application health
check_app_health() {
    log_info "Application Health Check"
    echo "========================"
    echo ""
    
    # Check main application
    echo "Main Application:"
    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        local health_response=$(curl -s http://localhost:3000/api/health)
        echo "✅ Application is healthy"
        echo "Response: $health_response"
    else
        echo "❌ Application health check failed"
    fi
    echo ""
    
    # Check database connection
    echo "Database Connection:"
    if is_docker; then
        if docker exec -it $(docker ps -q -f name=postgres) pg_isready >/dev/null 2>&1; then
            echo "✅ Database is accessible"
        else
            echo "❌ Database connection failed"
        fi
    else
        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
                echo "✅ Database is accessible"
            else
                echo "❌ Database connection failed"
            fi
        else
            echo "⚠️  pg_isready not available"
        fi
    fi
    echo ""
    
    # Check Redis connection
    echo "Redis Connection:"
    if is_docker; then
        if docker exec -it $(docker ps -q -f name=redis) redis-cli ping >/dev/null 2>&1; then
            echo "✅ Redis is accessible"
        else
            echo "❌ Redis connection failed"
        fi
    else
        if command -v redis-cli >/dev/null 2>&1; then
            if redis-cli ping >/dev/null 2>&1; then
                echo "✅ Redis is accessible"
            else
                echo "❌ Redis connection failed"
            fi
        else
            echo "⚠️  redis-cli not available"
        fi
    fi
    echo ""
    
    # Check external services
    echo "External Services:"
    
    # Stripe API
    if curl -f https://api.stripe.com/v1 >/dev/null 2>&1; then
        echo "✅ Stripe API is accessible"
    else
        echo "❌ Stripe API connection failed"
    fi
    
    # SendGrid API (if configured)
    if [ -n "$SENDGRID_API_KEY" ]; then
        if curl -f https://api.sendgrid.com/v3/user/profile \
           -H "Authorization: Bearer $SENDGRID_API_KEY" >/dev/null 2>&1; then
            echo "✅ SendGrid API is accessible"
        else
            echo "❌ SendGrid API connection failed"
        fi
    fi
    
    echo ""
}

# View application logs
view_logs() {
    local service=${2:-app}
    local lines=${3:-100}
    
    log_info "Viewing logs for: $service (last $lines lines)"
    echo "================================================"
    echo ""
    
    if is_docker; then
        case $service in
            app|application)
                docker logs --tail "$lines" $(docker ps -q -f name=app) 2>&1
                ;;
            postgres|database|db)
                docker logs --tail "$lines" $(docker ps -q -f name=postgres) 2>&1
                ;;
            redis)
                docker logs --tail "$lines" $(docker ps -q -f name=redis) 2>&1
                ;;
            nginx)
                docker logs --tail "$lines" $(docker ps -q -f name=nginx) 2>&1
                ;;
            all)
                echo "=== Application Logs ==="
                docker logs --tail 50 $(docker ps -q -f name=app) 2>&1
                echo ""
                echo "=== Database Logs ==="
                docker logs --tail 20 $(docker ps -q -f name=postgres) 2>&1
                echo ""
                echo "=== Redis Logs ==="
                docker logs --tail 20 $(docker ps -q -f name=redis) 2>&1
                ;;
            *)
                log_error "Unknown service: $service"
                log_info "Available services: app, postgres, redis, nginx, all"
                ;;
        esac
    else
        # Non-Docker environment
        case $service in
            app|application)
                if [ -f "/var/log/admin-system/app.log" ]; then
                    tail -n "$lines" /var/log/admin-system/app.log
                elif command -v pm2 >/dev/null 2>&1; then
                    pm2 logs --lines "$lines"
                else
                    log_warning "Application logs not found"
                fi
                ;;
            postgres|database|db)
                if [ -f "/var/log/postgresql/postgresql.log" ]; then
                    tail -n "$lines" /var/log/postgresql/postgresql.log
                else
                    log_warning "PostgreSQL logs not found"
                fi
                ;;
            nginx)
                if [ -f "/var/log/nginx/access.log" ]; then
                    echo "=== Access Log ==="
                    tail -n "$((lines/2))" /var/log/nginx/access.log
                    echo ""
                    echo "=== Error Log ==="
                    tail -n "$((lines/2))" /var/log/nginx/error.log
                else
                    log_warning "Nginx logs not found"
                fi
                ;;
            *)
                log_error "Unknown service: $service"
                ;;
        esac
    fi
}

# Get system metrics
get_metrics() {
    log_info "System Metrics"
    echo "=============="
    echo ""
    
    # CPU metrics
    echo "CPU Metrics:"
    if [ -f /proc/stat ]; then
        local cpu_usage=$(awk '/^cpu / {usage=($2+$4)*100/($2+$3+$4+$5)} END {print usage "%"}' /proc/stat)
        echo "  Current Usage: $cpu_usage"
    fi
    
    if [ -f /proc/loadavg ]; then
        local load_avg=$(cat /proc/loadavg | awk '{print $1, $2, $3}')
        echo "  Load Average (1m, 5m, 15m): $load_avg"
    fi
    echo ""
    
    # Memory metrics
    echo "Memory Metrics:"
    if [ -f /proc/meminfo ]; then
        local total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local free_mem=$(grep MemFree /proc/meminfo | awk '{print $2}')
        local used_mem=$((total_mem - free_mem))
        local mem_usage=$((used_mem * 100 / total_mem))
        
        echo "  Total: $((total_mem / 1024)) MB"
        echo "  Used: $((used_mem / 1024)) MB ($mem_usage%)"
        echo "  Free: $((free_mem / 1024)) MB"
    fi
    echo ""
    
    # Disk metrics
    echo "Disk Metrics:"
    df -h | grep -E '^/dev/' | while read line; do
        echo "  $line"
    done
    echo ""
    
    # Network metrics
    echo "Network Metrics:"
    if [ -f /proc/net/dev ]; then
        echo "  Interface statistics:"
        awk '/eth0|ens|enp/ {print "    " $1 " RX: " $2 " bytes, TX: " $10 " bytes"}' /proc/net/dev
    fi
    echo ""
    
    # Application-specific metrics
    echo "Application Metrics:"
    
    # Database connections
    if is_docker; then
        local db_connections=$(docker exec $(docker ps -q -f name=postgres) psql -U admin -d admin_system -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "N/A")
        echo "  Database Connections: $db_connections"
    fi
    
    # Redis memory usage
    if is_docker; then
        local redis_memory=$(docker exec $(docker ps -q -f name=redis) redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r' 2>/dev/null || echo "N/A")
        echo "  Redis Memory Usage: $redis_memory"
    fi
    
    # Application response time
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health 2>/dev/null || echo "N/A")
    echo "  API Response Time: ${response_time}s"
    
    echo ""
}

# Check for alerts
check_alerts() {
    log_info "System Alerts"
    echo "============="
    echo ""
    
    local alerts=()
    
    # Check disk usage
    df -h | grep -E '^/dev/' | while read line; do
        local usage=$(echo "$line" | awk '{print $5}' | sed 's/%//')
        local mount=$(echo "$line" | awk '{print $6}')
        
        if [ "$usage" -gt 90 ]; then
            alerts+=("🔴 CRITICAL: Disk usage on $mount is ${usage}%")
        elif [ "$usage" -gt 80 ]; then
            alerts+=("🟡 WARNING: Disk usage on $mount is ${usage}%")
        fi
    done
    
    # Check memory usage
    if [ -f /proc/meminfo ]; then
        local total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        local free_mem=$(grep MemFree /proc/meminfo | awk '{print $2}')
        local mem_usage=$((100 - (free_mem * 100 / total_mem)))
        
        if [ "$mem_usage" -gt 90 ]; then
            alerts+=("🔴 CRITICAL: Memory usage is ${mem_usage}%")
        elif [ "$mem_usage" -gt 80 ]; then
            alerts+=("🟡 WARNING: Memory usage is ${mem_usage}%")
        fi
    fi
    
    # Check load average
    if [ -f /proc/loadavg ]; then
        local load_1m=$(cat /proc/loadavg | awk '{print $1}')
        local cpu_cores=$(nproc)
        local load_threshold=$(echo "$cpu_cores * 2" | bc -l 2>/dev/null || echo $((cpu_cores * 2)))
        
        if (( $(echo "$load_1m > $load_threshold" | bc -l 2>/dev/null || [ "$load_1m" -gt "$load_threshold" ]) )); then
            alerts+=("🔴 CRITICAL: Load average (${load_1m}) exceeds threshold (${load_threshold})")
        fi
    fi
    
    # Check application health
    if ! curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        alerts+=("🔴 CRITICAL: Application health check failed")
    fi
    
    # Check database connection
    if is_docker; then
        if ! docker exec $(docker ps -q -f name=postgres) pg_isready >/dev/null 2>&1; then
            alerts+=("🔴 CRITICAL: Database connection failed")
        fi
    fi
    
    # Check Redis connection
    if is_docker; then
        if ! docker exec $(docker ps -q -f name=redis) redis-cli ping >/dev/null 2>&1; then
            alerts+=("🔴 CRITICAL: Redis connection failed")
        fi
    fi
    
    # Display alerts
    if [ ${#alerts[@]} -eq 0 ]; then
        echo "✅ No alerts - system is healthy"
    else
        echo "Found ${#alerts[@]} alert(s):"
        printf '%s\n' "${alerts[@]}"
    fi
    
    echo ""
}

# Cleanup system logs and temporary files
cleanup_system() {
    log_info "Starting system cleanup..."
    
    local cleaned_space=0
    
    # Clean up old log files
    log_info "Cleaning up old log files..."
    
    if is_docker; then
        # Clean up Docker logs
        docker system prune -f >/dev/null 2>&1 || true
        log_info "Docker system cleaned up"
    else
        # Clean up application logs older than 30 days
        if [ -d "/var/log/admin-system" ]; then
            find /var/log/admin-system -name "*.log" -mtime +30 -delete 2>/dev/null || true
        fi
        
        # Clean up nginx logs older than 30 days
        if [ -d "/var/log/nginx" ]; then
            find /var/log/nginx -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
        fi
        
        # Clean up PostgreSQL logs older than 30 days
        if [ -d "/var/log/postgresql" ]; then
            find /var/log/postgresql -name "*.log.*" -mtime +30 -delete 2>/dev/null || true
        fi
    fi
    
    # Clean up temporary files
    log_info "Cleaning up temporary files..."
    
    # Clean up /tmp files older than 7 days
    find /tmp -type f -mtime +7 -delete 2>/dev/null || true
    
    # Clean up application temp files
    if [ -d "$PROJECT_ROOT/tmp" ]; then
        find "$PROJECT_ROOT/tmp" -type f -mtime +1 -delete 2>/dev/null || true
    fi
    
    # Clean up old backup files (keep last 30 days)
    if [ -d "$PROJECT_ROOT/backups" ]; then
        find "$PROJECT_ROOT/backups" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null || true
        find "$PROJECT_ROOT/backups" -name "*.dump" -mtime +30 -delete 2>/dev/null || true
    fi
    
    # Clean up npm cache
    if command -v npm >/dev/null 2>&1; then
        npm cache clean --force >/dev/null 2>&1 || true
    fi
    
    # Clean up package manager caches
    if command -v apt-get >/dev/null 2>&1; then
        apt-get clean >/dev/null 2>&1 || true
    fi
    
    log_success "System cleanup completed"
}

# Generate system report
generate_report() {
    local report_file="$PROJECT_ROOT/system-report-$(date +%Y%m%d_%H%M%S).txt"
    
    log_info "Generating system report: $report_file"
    
    {
        echo "System Report - $(date)"
        echo "=================================="
        echo ""
        
        echo "SYSTEM STATUS"
        echo "============="
        get_system_status
        
        echo ""
        echo "APPLICATION HEALTH"
        echo "=================="
        check_app_health
        
        echo ""
        echo "SYSTEM METRICS"
        echo "=============="
        get_metrics
        
        echo ""
        echo "ALERTS"
        echo "======"
        check_alerts
        
    } > "$report_file"
    
    log_success "System report generated: $report_file"
}

# Show usage
show_usage() {
    echo "System Monitoring Tool"
    echo "====================="
    echo ""
    echo "Usage: $0 [operation] [options]"
    echo ""
    echo "Operations:"
    echo "  status              Show system status overview"
    echo "  health              Check application health"
    echo "  logs [service]      View logs (services: app, postgres, redis, nginx, all)"
    echo "  metrics             Show system metrics"
    echo "  alerts              Check for system alerts"
    echo "  cleanup             Clean up old logs and temporary files"
    echo "  report              Generate comprehensive system report"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 health"
    echo "  $0 logs app"
    echo "  $0 logs postgres 200"
    echo "  $0 metrics"
    echo "  $0 alerts"
    echo "  $0 cleanup"
    echo "  $0 report"
    echo ""
}

# Main function
main() {
    case "$OPERATION" in
        status)
            get_system_status
            ;;
        health)
            check_app_health
            ;;
        logs)
            view_logs "$@"
            ;;
        metrics)
            get_metrics
            ;;
        alerts)
            check_alerts
            ;;
        cleanup)
            cleanup_system
            ;;
        report)
            generate_report
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Run main function
main "$@"