#!/bin/bash

# Storage monitoring script for containerized environment
# Monitors ephemeral storage usage and alerts before hitting limits

set -e

# Configuration
WARNING_THRESHOLD=70  # Warn at 70% usage
CRITICAL_THRESHOLD=90 # Critical at 90% usage
MAX_EPHEMERAL_STORAGE_MB=100 # 100Mi limit

# Function to get directory size in MB
get_dir_size_mb() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    du -sm "$dir" 2>/dev/null | cut -f1 || echo "0"
  else
    echo "0"
  fi
}

# Function to check storage usage
check_storage() {
  local usage_mb=$(df -m /tmp 2>/dev/null | awk 'NR==2 {print $3}' || echo "0")
  local total_mb=$(df -m /tmp 2>/dev/null | awk 'NR==2 {print $2}' || echo "100")
  local usage_percent=$((usage_mb * 100 / total_mb))
  
  echo "Storage usage: ${usage_mb}MB/${total_mb}MB (${usage_percent}%)"
  
  # Check individual directories
  local crash_logs_size=$(get_dir_size_mb "/tmp/crash-logs")
  local app_logs_size=$(get_dir_size_mb "/app/logs")
  local tmp_size=$(get_dir_size_mb "/tmp")
  
  echo "Breakdown:"
  echo "  - Crash logs: ${crash_logs_size}MB"
  echo "  - App logs: ${app_logs_size}MB"
  echo "  - Other tmp: ${tmp_size}MB"
  
  # Alert thresholds
  if [[ $usage_percent -ge $CRITICAL_THRESHOLD ]]; then
    echo "🚨 CRITICAL: Storage usage at ${usage_percent}%!"
    # Force cleanup
    /usr/local/bin/log-rotation.sh
    return 2
  elif [[ $usage_percent -ge $WARNING_THRESHOLD ]]; then
    echo "⚠️  WARNING: Storage usage at ${usage_percent}%"
    return 1
  fi
  
  return 0
}

# Main execution
if [[ "$1" == "monitor" ]]; then
  # Continuous monitoring mode
  while true; do
    check_storage
    sleep 60
  done
else
  # Single check mode
  check_storage
fi