#!/bin/bash

# Automated Backup Script for Admin Management System
# Usage: ./backup-automation.sh [daily|weekly|monthly|restore]

set -e

BACKUP_TYPE=${1:-daily}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    source "$PROJECT_ROOT/.env.local"
elif [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

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

# Configuration
BACKUP_BASE_DIR="$PROJECT_ROOT/backups"
DATABASE_BACKUP_DIR="$BACKUP_BASE_DIR/database"
FILES_BACKUP_DIR="$BACKUP_BASE_DIR/files"
CONFIG_BACKUP_DIR="$BACKUP_BASE_DIR/config"
LOGS_BACKUP_DIR="$BACKUP_BASE_DIR/logs"

# Retention policies (in days)
DAILY_RETENTION=7
WEEKLY_RETENTION=30
MONTHLY_RETENTION=365

# Create backup directories
create_backup_dirs() {
    mkdir -p "$DATABASE_BACKUP_DIR"
    mkdir -p "$FILES_BACKUP_DIR"
    mkdir -p "$CONFIG_BACKUP_DIR"
    mkdir -p "$LOGS_BACKUP_DIR"
}

# Parse DATABASE_URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    export PGPASSWORD="$DB_PASSWORD"
}

# Database backup
backup_database() {
    local backup_type=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$DATABASE_BACKUP_DIR/${backup_type}_${DB_NAME}_${timestamp}"
    
    log_info "Creating $backup_type database backup..."
    
    parse_database_url
    
    # Create custom format backup (for faster restore)
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --no-owner --no-privileges \
        --format=custom > "${backup_file}.dump"
    
    # Create plain SQL backup (for inspection)
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --no-owner --no-privileges \
        --format=plain > "${backup_file}.sql"
    
    # Compress SQL backup
    gzip "${backup_file}.sql"
    
    # Create backup metadata
    cat > "${backup_file}.meta" << EOF
backup_type=$backup_type
timestamp=$timestamp
database=$DB_NAME
host=$DB_HOST
port=$DB_PORT
user=$DB_USER
format=custom,sql
size_dump=$(du -h "${backup_file}.dump" | cut -f1)
size_sql=$(du -h "${backup_file}.sql.gz" | cut -f1)
created=$(date -Iseconds)
EOF
    
    log_success "Database backup completed: ${backup_file}.dump, ${backup_file}.sql.gz"
}

# Files backup
backup_files() {
    local backup_type=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$FILES_BACKUP_DIR/${backup_type}_files_${timestamp}.tar.gz"
    
    log_info "Creating $backup_type files backup..."
    
    # Files to backup
    local files_to_backup=(
        "public/uploads"
        "storage"
        ".env.local"
        ".env.production"
        "package.json"
        "package-lock.json"
        "prisma/schema.prisma"
    )
    
    # Create tar archive
    tar -czf "$backup_file" -C "$PROJECT_ROOT" \
        --exclude="node_modules" \
        --exclude=".git" \
        --exclude="backups" \
        --exclude=".next" \
        --exclude="tmp" \
        "${files_to_backup[@]}" 2>/dev/null || true
    
    # Create backup metadata
    cat > "${backup_file}.meta" << EOF
backup_type=$backup_type
timestamp=$timestamp
files=${files_to_backup[*]}
size=$(du -h "$backup_file" | cut -f1)
created=$(date -Iseconds)
EOF
    
    log_success "Files backup completed: $backup_file"
}

# Configuration backup
backup_config() {
    local backup_type=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$CONFIG_BACKUP_DIR/${backup_type}_config_${timestamp}.tar.gz"
    
    log_info "Creating $backup_type configuration backup..."
    
    # Configuration files to backup
    local config_files=(
        "docker-compose.yml"
        "Dockerfile"
        "next.config.js"
        "tailwind.config.js"
        "tsconfig.json"
        "k8s"
        "nginx"
        "monitoring"
    )
    
    # Create tar archive
    tar -czf "$backup_file" -C "$PROJECT_ROOT" "${config_files[@]}" 2>/dev/null || true
    
    # Backup environment-specific configurations
    if [ -d "/etc/nginx/sites-available" ]; then
        tar -czf "$CONFIG_BACKUP_DIR/${backup_type}_nginx_${timestamp}.tar.gz" \
            -C "/etc/nginx" sites-available sites-enabled 2>/dev/null || true
    fi
    
    # Create backup metadata
    cat > "${backup_file}.meta" << EOF
backup_type=$backup_type
timestamp=$timestamp
config_files=${config_files[*]}
size=$(du -h "$backup_file" | cut -f1)
created=$(date -Iseconds)
EOF
    
    log_success "Configuration backup completed: $backup_file"
}

# Logs backup
backup_logs() {
    local backup_type=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$LOGS_BACKUP_DIR/${backup_type}_logs_${timestamp}.tar.gz"
    
    log_info "Creating $backup_type logs backup..."
    
    # Log directories to backup
    local log_dirs=()
    
    # Application logs
    if [ -d "/var/log/admin-system" ]; then
        log_dirs+=("/var/log/admin-system")
    fi
    
    # Nginx logs
    if [ -d "/var/log/nginx" ]; then
        log_dirs+=("/var/log/nginx")
    fi
    
    # PostgreSQL logs
    if [ -d "/var/log/postgresql" ]; then
        log_dirs+=("/var/log/postgresql")
    fi
    
    # PM2 logs
    if [ -d "$HOME/.pm2/logs" ]; then
        log_dirs+=("$HOME/.pm2/logs")
    fi
    
    # Create tar archive if there are logs to backup
    if [ ${#log_dirs[@]} -gt 0 ]; then
        tar -czf "$backup_file" "${log_dirs[@]}" 2>/dev/null || true
        
        # Create backup metadata
        cat > "${backup_file}.meta" << EOF
backup_type=$backup_type
timestamp=$timestamp
log_dirs=${log_dirs[*]}
size=$(du -h "$backup_file" | cut -f1)
created=$(date -Iseconds)
EOF
        
        log_success "Logs backup completed: $backup_file"
    else
        log_warning "No log directories found to backup"
    fi
}

# Docker volumes backup
backup_docker_volumes() {
    local backup_type=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    if ! command -v docker >/dev/null 2>&1; then
        log_warning "Docker not available, skipping volumes backup"
        return
    fi
    
    log_info "Creating $backup_type Docker volumes backup..."
    
    # Get list of volumes
    local volumes=$(docker volume ls -q | grep -E "(postgres|redis)" || true)
    
    for volume in $volumes; do
        local backup_file="$FILES_BACKUP_DIR/${backup_type}_volume_${volume}_${timestamp}.tar.gz"
        
        # Backup volume
        docker run --rm \
            -v "$volume":/data \
            -v "$FILES_BACKUP_DIR":/backup \
            alpine:latest \
            tar -czf "/backup/$(basename "$backup_file")" -C /data . 2>/dev/null || true
        
        if [ -f "$backup_file" ]; then
            log_success "Volume backup completed: $volume -> $backup_file"
        fi
    done
}

# Cleanup old backups
cleanup_old_backups() {
    local backup_type=$1
    local retention_days=$2
    
    log_info "Cleaning up old $backup_type backups (older than $retention_days days)..."
    
    # Cleanup database backups
    find "$DATABASE_BACKUP_DIR" -name "${backup_type}_*" -mtime +$retention_days -delete 2>/dev/null || true
    
    # Cleanup file backups
    find "$FILES_BACKUP_DIR" -name "${backup_type}_*" -mtime +$retention_days -delete 2>/dev/null || true
    
    # Cleanup config backups
    find "$CONFIG_BACKUP_DIR" -name "${backup_type}_*" -mtime +$retention_days -delete 2>/dev/null || true
    
    # Cleanup log backups
    find "$LOGS_BACKUP_DIR" -name "${backup_type}_*" -mtime +$retention_days -delete 2>/dev/null || true
    
    log_success "Old $backup_type backups cleaned up"
}

# Send backup notification
send_notification() {
    local backup_type=$1
    local status=$2
    local message=""
    
    if [ "$status" = "success" ]; then
        message="✅ $backup_type backup completed successfully"
    else
        message="❌ $backup_type backup failed"
    fi
    
    # Send Slack notification if webhook URL is set
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
    
    # Send email notification if configured
    if [ -n "$BACKUP_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "Backup Notification" "$BACKUP_EMAIL" || true
    fi
    
    log_info "Notification sent: $message"
}

# Daily backup
daily_backup() {
    log_info "Starting daily backup..."
    
    create_backup_dirs
    
    backup_database "daily"
    backup_files "daily"
    backup_config "daily"
    backup_logs "daily"
    backup_docker_volumes "daily"
    
    cleanup_old_backups "daily" $DAILY_RETENTION
    
    send_notification "daily" "success"
    log_success "Daily backup completed successfully"
}

# Weekly backup
weekly_backup() {
    log_info "Starting weekly backup..."
    
    create_backup_dirs
    
    backup_database "weekly"
    backup_files "weekly"
    backup_config "weekly"
    backup_logs "weekly"
    backup_docker_volumes "weekly"
    
    cleanup_old_backups "weekly" $WEEKLY_RETENTION
    
    send_notification "weekly" "success"
    log_success "Weekly backup completed successfully"
}

# Monthly backup
monthly_backup() {
    log_info "Starting monthly backup..."
    
    create_backup_dirs
    
    backup_database "monthly"
    backup_files "monthly"
    backup_config "monthly"
    backup_logs "monthly"
    backup_docker_volumes "monthly"
    
    cleanup_old_backups "monthly" $MONTHLY_RETENTION
    
    send_notification "monthly" "success"
    log_success "Monthly backup completed successfully"
}

# List available backups
list_backups() {
    log_info "Available Backups"
    echo "================="
    echo ""
    
    echo "Database Backups:"
    ls -lh "$DATABASE_BACKUP_DIR"/*.dump 2>/dev/null | tail -10 || echo "No database backups found"
    echo ""
    
    echo "File Backups:"
    ls -lh "$FILES_BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -10 || echo "No file backups found"
    echo ""
    
    echo "Config Backups:"
    ls -lh "$CONFIG_BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -10 || echo "No config backups found"
    echo ""
    
    echo "Log Backups:"
    ls -lh "$LOGS_BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -10 || echo "No log backups found"
    echo ""
}

# Restore from backup
restore_backup() {
    local backup_file="$2"
    
    if [ -z "$backup_file" ]; then
        log_error "Please specify backup file to restore"
        log_info "Usage: $0 restore <backup_file>"
        list_backups
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will restore from backup and may overwrite existing data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Starting restore from: $backup_file"
    
    # Determine backup type and restore accordingly
    if [[ "$backup_file" == *.dump ]]; then
        # Database restore
        parse_database_url
        pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --no-owner --no-privileges \
            "$backup_file"
        log_success "Database restore completed"
        
    elif [[ "$backup_file" == *.tar.gz ]]; then
        # File/config restore
        log_info "Extracting backup archive..."
        tar -xzf "$backup_file" -C "$PROJECT_ROOT"
        log_success "Files restore completed"
        
    else
        log_error "Unsupported backup file format: $backup_file"
        exit 1
    fi
}

# Show backup status
show_status() {
    log_info "Backup System Status"
    echo "===================="
    echo ""
    
    echo "Backup Directories:"
    echo "  Database: $DATABASE_BACKUP_DIR"
    echo "  Files: $FILES_BACKUP_DIR"
    echo "  Config: $CONFIG_BACKUP_DIR"
    echo "  Logs: $LOGS_BACKUP_DIR"
    echo ""
    
    echo "Retention Policies:"
    echo "  Daily: $DAILY_RETENTION days"
    echo "  Weekly: $WEEKLY_RETENTION days"
    echo "  Monthly: $MONTHLY_RETENTION days"
    echo ""
    
    echo "Disk Usage:"
    du -sh "$BACKUP_BASE_DIR"/* 2>/dev/null || echo "No backups found"
    echo ""
    
    echo "Recent Backups:"
    find "$BACKUP_BASE_DIR" -name "*.meta" -mtime -7 -exec cat {} \; 2>/dev/null | head -20 || echo "No recent backups found"
}

# Show usage
show_usage() {
    echo "Automated Backup Tool"
    echo "===================="
    echo ""
    echo "Usage: $0 [operation] [options]"
    echo ""
    echo "Operations:"
    echo "  daily               Perform daily backup"
    echo "  weekly              Perform weekly backup"
    echo "  monthly             Perform monthly backup"
    echo "  list                List available backups"
    echo "  restore <file>      Restore from backup file"
    echo "  status              Show backup system status"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 daily"
    echo "  $0 weekly"
    echo "  $0 monthly"
    echo "  $0 list"
    echo "  $0 restore backups/database/daily_admin_system_20240115_120000.dump"
    echo "  $0 status"
    echo ""
    echo "Cron Examples:"
    echo "  # Daily backup at 2 AM"
    echo "  0 2 * * * /path/to/backup-automation.sh daily"
    echo ""
    echo "  # Weekly backup on Sunday at 3 AM"
    echo "  0 3 * * 0 /path/to/backup-automation.sh weekly"
    echo ""
    echo "  # Monthly backup on 1st day at 4 AM"
    echo "  0 4 1 * * /path/to/backup-automation.sh monthly"
    echo ""
}

# Main function
main() {
    case "$BACKUP_TYPE" in
        daily)
            daily_backup
            ;;
        weekly)
            weekly_backup
            ;;
        monthly)
            monthly_backup
            ;;
        list)
            list_backups
            ;;
        restore)
            restore_backup "$@"
            ;;
        status)
            show_status
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Error handling
trap 'log_error "Backup failed with error"; send_notification "$BACKUP_TYPE" "failure"; exit 1' ERR

# Run main function
main "$@"