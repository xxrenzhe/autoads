#!/bin/bash

# System Maintenance Master Script for Admin Management System
# Usage: ./maintenance.sh [operation] [options]

set -e

OPERATION=${1:-help}
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

# Check if script exists and is executable
check_script() {
    local script_path="$1"
    if [ ! -f "$script_path" ]; then
        log_error "Script not found: $script_path"
        return 1
    fi
    if [ ! -x "$script_path" ]; then
        log_warning "Making script executable: $script_path"
        chmod +x "$script_path"
    fi
    return 0
}

# Run database maintenance
database_maintenance() {
    local operation=${2:-help}
    
    log_info "Running database maintenance: $operation"
    
    if check_script "$SCRIPT_DIR/database-maintenance.sh"; then
        "$SCRIPT_DIR/database-maintenance.sh" "$operation"
    else
        log_error "Database maintenance script not available"
        return 1
    fi
}

# Run system monitoring
system_monitoring() {
    local operation=${2:-status}
    
    log_info "Running system monitoring: $operation"
    
    if check_script "$SCRIPT_DIR/system-monitor.sh"; then
        "$SCRIPT_DIR/system-monitor.sh" "$operation"
    else
        log_error "System monitoring script not available"
        return 1
    fi
}

# Run backup operations
backup_operations() {
    local operation=${2:-daily}
    
    log_info "Running backup operation: $operation"
    
    if check_script "$SCRIPT_DIR/backup-automation.sh"; then
        "$SCRIPT_DIR/backup-automation.sh" "$operation"
    else
        log_error "Backup automation script not available"
        return 1
    fi
}

# Full system maintenance routine
full_maintenance() {
    log_info "Starting full system maintenance routine..."
    echo "=========================================="
    echo ""
    
    # 1. System health check
    log_info "Step 1: System Health Check"
    system_monitoring "health"
    echo ""
    
    # 2. Database optimization
    log_info "Step 2: Database Optimization"
    database_maintenance "optimize"
    echo ""
    
    # 3. Database cleanup
    log_info "Step 3: Database Cleanup"
    database_maintenance "cleanup"
    echo ""
    
    # 4. System cleanup
    log_info "Step 4: System Cleanup"
    system_monitoring "cleanup"
    echo ""
    
    # 5. Create backup
    log_info "Step 5: Create Backup"
    backup_operations "daily"
    echo ""
    
    # 6. Final health check
    log_info "Step 6: Final Health Check"
    system_monitoring "alerts"
    echo ""
    
    log_success "Full system maintenance completed successfully!"
}

# Emergency maintenance (for critical issues)
emergency_maintenance() {
    log_warning "Starting emergency maintenance routine..."
    echo "========================================"
    echo ""
    
    # 1. Immediate health check
    log_info "Step 1: Emergency Health Check"
    system_monitoring "alerts"
    echo ""
    
    # 2. Create emergency backup
    log_info "Step 2: Emergency Backup"
    backup_operations "daily"
    echo ""
    
    # 3. Database health check
    log_info "Step 3: Database Health Check"
    database_maintenance "health-check"
    echo ""
    
    # 4. System resource check
    log_info "Step 4: System Resources"
    system_monitoring "metrics"
    echo ""
    
    # 5. Recent logs analysis
    log_info "Step 5: Recent Logs"
    system_monitoring "logs" "app" "50"
    echo ""
    
    log_success "Emergency maintenance completed!"
}

# Weekly maintenance routine
weekly_maintenance() {
    log_info "Starting weekly maintenance routine..."
    echo "====================================="
    echo ""
    
    # 1. Full system status
    log_info "Step 1: System Status Review"
    system_monitoring "status"
    echo ""
    
    # 2. Database maintenance
    log_info "Step 2: Database Maintenance"
    database_maintenance "optimize"
    database_maintenance "cleanup"
    echo ""
    
    # 3. Weekly backup
    log_info "Step 3: Weekly Backup"
    backup_operations "weekly"
    echo ""
    
    # 4. System cleanup
    log_info "Step 4: System Cleanup"
    system_monitoring "cleanup"
    echo ""
    
    # 5. Generate system report
    log_info "Step 5: System Report"
    system_monitoring "report"
    echo ""
    
    log_success "Weekly maintenance completed successfully!"
}

# Monthly maintenance routine
monthly_maintenance() {
    log_info "Starting monthly maintenance routine..."
    echo "======================================"
    echo ""
    
    # 1. Comprehensive system review
    log_info "Step 1: Comprehensive System Review"
    system_monitoring "status"
    system_monitoring "metrics"
    echo ""
    
    # 2. Database deep maintenance
    log_info "Step 2: Database Deep Maintenance"
    database_maintenance "backup"
    database_maintenance "optimize"
    database_maintenance "cleanup"
    database_maintenance "health-check"
    echo ""
    
    # 3. Monthly backup
    log_info "Step 3: Monthly Backup"
    backup_operations "monthly"
    echo ""
    
    # 4. System cleanup and optimization
    log_info "Step 4: System Cleanup"
    system_monitoring "cleanup"
    echo ""
    
    # 5. Security review
    log_info "Step 5: Security Review"
    security_review
    echo ""
    
    # 6. Performance analysis
    log_info "Step 6: Performance Analysis"
    performance_analysis
    echo ""
    
    # 7. Generate comprehensive report
    log_info "Step 7: Comprehensive Report"
    system_monitoring "report"
    echo ""
    
    log_success "Monthly maintenance completed successfully!"
}

# Security review
security_review() {
    log_info "Performing security review..."
    
    # Check for security updates
    if command -v apt >/dev/null 2>&1; then
        log_info "Checking for security updates..."
        apt list --upgradable 2>/dev/null | grep -i security || log_info "No security updates available"
    fi
    
    # Check file permissions
    log_info "Checking critical file permissions..."
    
    # Check environment files
    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        local env_perms=$(stat -c "%a" "$PROJECT_ROOT/.env.local")
        if [ "$env_perms" != "600" ]; then
            log_warning "Environment file permissions should be 600, currently: $env_perms"
            chmod 600 "$PROJECT_ROOT/.env.local"
            log_info "Fixed environment file permissions"
        fi
    fi
    
    # Check for exposed sensitive files
    log_info "Checking for exposed sensitive files..."
    find "$PROJECT_ROOT" -name "*.key" -o -name "*.pem" -o -name "*.p12" | while read -r file; do
        local file_perms=$(stat -c "%a" "$file")
        if [ "$file_perms" != "600" ]; then
            log_warning "Sensitive file has incorrect permissions: $file ($file_perms)"
        fi
    done
    
    # Check for default passwords (basic check)
    log_info "Checking for potential default passwords..."
    if grep -r "password123\|admin123\|default" "$PROJECT_ROOT"/.env* 2>/dev/null; then
        log_warning "Potential default passwords found in environment files"
    fi
    
    log_success "Security review completed"
}

# Performance analysis
performance_analysis() {
    log_info "Performing performance analysis..."
    
    # Database performance
    log_info "Database performance metrics:"
    database_maintenance "stats"
    
    # Application performance
    log_info "Application performance test:"
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health 2>/dev/null || echo "N/A")
    log_info "API response time: ${response_time}s"
    
    # System performance
    log_info "System performance metrics:"
    system_monitoring "metrics"
    
    log_success "Performance analysis completed"
}

# Update system dependencies
update_dependencies() {
    log_info "Updating system dependencies..."
    
    # Update Node.js dependencies
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        log_info "Checking for Node.js dependency updates..."
        cd "$PROJECT_ROOT"
        
        # Check for outdated packages
        npm outdated || true
        
        # Update dependencies (with user confirmation)
        read -p "Update Node.js dependencies? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm update
            log_success "Node.js dependencies updated"
        fi
    fi
    
    # Update system packages
    if command -v apt >/dev/null 2>&1; then
        log_info "Checking for system updates..."
        apt list --upgradable 2>/dev/null | head -10
        
        read -p "Update system packages? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            apt update && apt upgrade -y
            log_success "System packages updated"
        fi
    fi
    
    log_success "Dependency update check completed"
}

# Maintenance mode management
maintenance_mode() {
    local action=${2:-status}
    local maintenance_file="$PROJECT_ROOT/public/maintenance.flag"
    
    case $action in
        enable)
            touch "$maintenance_file"
            log_success "Maintenance mode enabled"
            ;;
        disable)
            rm -f "$maintenance_file"
            log_success "Maintenance mode disabled"
            ;;
        status)
            if [ -f "$maintenance_file" ]; then
                log_info "Maintenance mode: ENABLED"
            else
                log_info "Maintenance mode: DISABLED"
            fi
            ;;
        *)
            log_error "Invalid maintenance mode action: $action"
            log_info "Usage: $0 maintenance-mode [enable|disable|status]"
            ;;
    esac
}

# Show maintenance schedule
show_schedule() {
    log_info "Recommended Maintenance Schedule"
    echo "==============================="
    echo ""
    echo "Daily (Automated):"
    echo "  - System health check"
    echo "  - Database backup"
    echo "  - Log rotation"
    echo "  - Basic cleanup"
    echo ""
    echo "Weekly (Automated):"
    echo "  - Database optimization"
    echo "  - System cleanup"
    echo "  - Weekly backup"
    echo "  - Performance review"
    echo ""
    echo "Monthly (Manual Review):"
    echo "  - Security review"
    echo "  - Dependency updates"
    echo "  - Comprehensive backup"
    echo "  - Performance analysis"
    echo "  - System report review"
    echo ""
    echo "Cron Examples:"
    echo "  # Daily maintenance at 2 AM"
    echo "  0 2 * * * $SCRIPT_DIR/maintenance.sh daily"
    echo ""
    echo "  # Weekly maintenance on Sunday at 3 AM"
    echo "  0 3 * * 0 $SCRIPT_DIR/maintenance.sh weekly"
    echo ""
    echo "  # Monthly maintenance on 1st day at 4 AM"
    echo "  0 4 1 * * $SCRIPT_DIR/maintenance.sh monthly"
    echo ""
}

# Show system overview
system_overview() {
    log_info "System Overview"
    echo "==============="
    echo ""
    
    # Basic system info
    echo "System Information:"
    echo "  Hostname: $(hostname)"
    echo "  OS: $(uname -s) $(uname -r)"
    echo "  Uptime: $(uptime -p 2>/dev/null || uptime)"
    echo ""
    
    # Application info
    echo "Application Information:"
    echo "  Project Root: $PROJECT_ROOT"
    echo "  Node Version: $(node --version 2>/dev/null || echo 'Not available')"
    echo "  NPM Version: $(npm --version 2>/dev/null || echo 'Not available')"
    echo ""
    
    # Service status
    echo "Service Status:"
    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "  ✅ Application: Running"
    else
        echo "  ❌ Application: Not responding"
    fi
    
    # Database status
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
            echo "  ✅ Database: Running"
        else
            echo "  ❌ Database: Not accessible"
        fi
    else
        echo "  ⚠️  Database: Status unknown"
    fi
    
    # Redis status
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            echo "  ✅ Redis: Running"
        else
            echo "  ❌ Redis: Not accessible"
        fi
    else
        echo "  ⚠️  Redis: Status unknown"
    fi
    
    echo ""
}

# Show usage
show_usage() {
    echo "System Maintenance Master Script"
    echo "==============================="
    echo ""
    echo "Usage: $0 [operation] [options]"
    echo ""
    echo "Main Operations:"
    echo "  full                Run full maintenance routine"
    echo "  daily               Run daily maintenance routine"
    echo "  weekly              Run weekly maintenance routine"
    echo "  monthly             Run monthly maintenance routine"
    echo "  emergency           Run emergency maintenance"
    echo ""
    echo "Individual Operations:"
    echo "  database <op>       Run database maintenance (backup|restore|optimize|cleanup|health-check)"
    echo "  monitor <op>        Run system monitoring (status|health|logs|metrics|alerts|cleanup)"
    echo "  backup <op>         Run backup operations (daily|weekly|monthly|list|restore)"
    echo ""
    echo "System Management:"
    echo "  maintenance-mode    Manage maintenance mode (enable|disable|status)"
    echo "  update-deps         Update system dependencies"
    echo "  security-review     Perform security review"
    echo "  performance         Analyze system performance"
    echo ""
    echo "Information:"
    echo "  overview            Show system overview"
    echo "  schedule            Show recommended maintenance schedule"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 full"
    echo "  $0 daily"
    echo "  $0 database backup"
    echo "  $0 monitor health"
    echo "  $0 backup weekly"
    echo "  $0 maintenance-mode enable"
    echo "  $0 overview"
    echo ""
}

# Main function
main() {
    case "$OPERATION" in
        full)
            full_maintenance
            ;;
        daily)
            full_maintenance  # For now, daily is same as full
            ;;
        weekly)
            weekly_maintenance
            ;;
        monthly)
            monthly_maintenance
            ;;
        emergency)
            emergency_maintenance
            ;;
        database)
            database_maintenance "$@"
            ;;
        monitor)
            system_monitoring "$@"
            ;;
        backup)
            backup_operations "$@"
            ;;
        maintenance-mode)
            maintenance_mode "$@"
            ;;
        update-deps)
            update_dependencies
            ;;
        security-review)
            security_review
            ;;
        performance)
            performance_analysis
            ;;
        overview)
            system_overview
            ;;
        schedule)
            show_schedule
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Error handling
trap 'log_error "Maintenance operation failed"; exit 1' ERR

# Run main function
main "$@"