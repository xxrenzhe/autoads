#!/bin/bash

# Database Maintenance Script for Admin Management System
# Usage: ./database-maintenance.sh [backup|restore|optimize|cleanup|health-check]

set -e

OPERATION=${1:-help}
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

# Parse DATABASE_URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Extract components from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    export PGPASSWORD="$DB_PASSWORD"
}

# Create backup directory
create_backup_dir() {
    local backup_dir="$PROJECT_ROOT/backups/database"
    mkdir -p "$backup_dir"
    echo "$backup_dir"
}

# Database backup
backup_database() {
    log_info "Starting database backup..."
    
    parse_database_url
    local backup_dir=$(create_backup_dir)
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_${DB_NAME}_${timestamp}.sql"
    
    log_info "Creating backup: $backup_file"
    
    # Create full database backup
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --no-owner --no-privileges \
        --format=custom > "${backup_file}.dump"
    
    # Create plain SQL backup for easier inspection
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --no-owner --no-privileges \
        --format=plain > "$backup_file"
    
    # Compress backups
    gzip "$backup_file"
    
    log_success "Backup completed: ${backup_file}.gz and ${backup_file}.dump"
    
    # Show backup size
    local backup_size=$(du -h "${backup_file}.gz" | cut -f1)
    local dump_size=$(du -h "${backup_file}.dump" | cut -f1)
    log_info "Backup sizes: SQL=${backup_size}, Custom=${dump_size}"
    
    # Cleanup old backups (keep last 30 days)
    log_info "Cleaning up old backups..."
    find "$backup_dir" -name "backup_*.sql.gz" -mtime +30 -delete
    find "$backup_dir" -name "backup_*.dump" -mtime +30 -delete
    
    log_success "Database backup completed successfully"
}

# Database restore
restore_database() {
    local backup_file="$2"
    
    if [ -z "$backup_file" ]; then
        log_error "Please specify backup file to restore"
        log_info "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warning "This will restore the database and overwrite existing data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    parse_database_url
    
    log_info "Starting database restore from: $backup_file"
    
    # Determine file type and restore accordingly
    if [[ "$backup_file" == *.dump ]]; then
        # Custom format restore
        pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --no-owner --no-privileges \
            "$backup_file"
    elif [[ "$backup_file" == *.sql.gz ]]; then
        # Compressed SQL restore
        gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    elif [[ "$backup_file" == *.sql ]]; then
        # Plain SQL restore
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file"
    else
        log_error "Unsupported backup file format: $backup_file"
        exit 1
    fi
    
    log_success "Database restore completed successfully"
}

# Database optimization
optimize_database() {
    log_info "Starting database optimization..."
    
    parse_database_url
    
    # Run VACUUM ANALYZE on all tables
    log_info "Running VACUUM ANALYZE..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "VACUUM ANALYZE;"
    
    # Reindex all indexes
    log_info "Reindexing database..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "REINDEX DATABASE $DB_NAME;"
    
    # Update table statistics
    log_info "Updating table statistics..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "ANALYZE;"
    
    # Show database size after optimization
    local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
    log_info "Database size after optimization: $db_size"
    
    log_success "Database optimization completed successfully"
}

# Database cleanup
cleanup_database() {
    log_info "Starting database cleanup..."
    
    parse_database_url
    
    # Clean up old sessions (older than 30 days)
    log_info "Cleaning up old sessions..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM sessions WHERE expires < NOW() - INTERVAL '30 days';
    "
    
    # Clean up old token transactions (older than 1 year)
    log_info "Cleaning up old token transactions..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM token_transactions WHERE created_at < NOW() - INTERVAL '1 year';
    "
    
    # Clean up old audit logs (older than 6 months)
    log_info "Cleaning up old audit logs..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '6 months';
    "
    
    # Clean up old notification instances (older than 3 months)
    log_info "Cleaning up old notifications..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM notification_instances WHERE created_at < NOW() - INTERVAL '3 months';
    "
    
    # Clean up orphaned records
    log_info "Cleaning up orphaned records..."
    
    # Remove token transactions for deleted users
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM token_transactions 
        WHERE user_id NOT IN (SELECT id FROM users);
    "
    
    # Remove subscriptions for deleted users
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DELETE FROM subscriptions 
        WHERE user_id NOT IN (SELECT id FROM users);
    "
    
    # Show cleanup results
    log_info "Cleanup completed. Running VACUUM to reclaim space..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "VACUUM;"
    
    local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
    log_info "Database size after cleanup: $db_size"
    
    log_success "Database cleanup completed successfully"
}

# Database health check
health_check() {
    log_info "Starting database health check..."
    
    parse_database_url
    
    # Test connection
    log_info "Testing database connection..."
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log_error "Cannot connect to database"
        exit 1
    fi
    log_success "Database connection: OK"
    
    # Check database size
    local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
    log_info "Database size: $db_size"
    
    # Check active connections
    local active_connections=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")
    log_info "Active connections: $active_connections"
    
    # Check for long-running queries
    log_info "Checking for long-running queries..."
    local long_queries=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT count(*) FROM pg_stat_activity 
        WHERE state = 'active' AND now() - query_start > interval '5 minutes';
    ")
    
    if [ "$long_queries" -gt 0 ]; then
        log_warning "Found $long_queries long-running queries (>5 minutes)"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT pid, now() - query_start as duration, query 
            FROM pg_stat_activity 
            WHERE state = 'active' AND now() - query_start > interval '5 minutes';
        "
    else
        log_success "No long-running queries found"
    fi
    
    # Check table sizes
    log_info "Top 10 largest tables:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
        LIMIT 10;
    "
    
    # Check index usage
    log_info "Checking unused indexes..."
    local unused_indexes=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT count(*) FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 AND schemaname = 'public';
    ")
    
    if [ "$unused_indexes" -gt 0 ]; then
        log_warning "Found $unused_indexes unused indexes"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) as size
            FROM pg_stat_user_indexes 
            WHERE idx_scan = 0 AND schemaname = 'public'
            ORDER BY pg_relation_size(indexrelid) DESC;
        "
    else
        log_success "All indexes are being used"
    fi
    
    # Check for bloated tables
    log_info "Checking for table bloat..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT schemaname, tablename, 
               pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
               n_dead_tup, n_live_tup,
               CASE WHEN n_live_tup > 0 
                    THEN round(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2) 
                    ELSE 0 
               END as dead_tuple_percent
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public' AND n_dead_tup > 1000
        ORDER BY dead_tuple_percent DESC;
    "
    
    log_success "Database health check completed"
}

# Show database statistics
show_stats() {
    log_info "Database Statistics"
    echo "==================="
    
    parse_database_url
    
    # Basic database info
    echo "Database: $DB_NAME"
    echo "Host: $DB_HOST:$DB_PORT"
    echo "User: $DB_USER"
    echo ""
    
    # Database size
    local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));")
    echo "Database Size: $db_size"
    echo ""
    
    # Table counts
    echo "Table Row Counts:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT schemaname, tablename, n_live_tup as row_count
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC;
    "
    
    echo ""
    echo "Connection Statistics:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT state, count(*) as count
        FROM pg_stat_activity 
        GROUP BY state
        ORDER BY count DESC;
    "
}

# Show usage
show_usage() {
    echo "Database Maintenance Tool"
    echo "========================="
    echo ""
    echo "Usage: $0 [operation] [options]"
    echo ""
    echo "Operations:"
    echo "  backup              Create database backup"
    echo "  restore <file>      Restore database from backup file"
    echo "  optimize            Optimize database (VACUUM, REINDEX, ANALYZE)"
    echo "  cleanup             Clean up old data and orphaned records"
    echo "  health-check        Perform comprehensive health check"
    echo "  stats               Show database statistics"
    echo "  help                Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore backups/database/backup_admin_system_20240115_120000.sql.gz"
    echo "  $0 optimize"
    echo "  $0 cleanup"
    echo "  $0 health-check"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL        PostgreSQL connection string (required)"
    echo ""
}

# Main function
main() {
    case "$OPERATION" in
        backup)
            backup_database
            ;;
        restore)
            restore_database "$@"
            ;;
        optimize)
            optimize_database
            ;;
        cleanup)
            cleanup_database
            ;;
        health-check)
            health_check
            ;;
        stats)
            show_stats
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Run main function
main "$@"