#!/bin/bash

# Log rotation script for containerized environment
# Designed to keep ephemeral storage usage under 100Mi

set -e

LOG_DIRS=(
  "/tmp/crash-logs"
  "/app/logs"
  "/tmp"
)

MAX_LOG_SIZE_MB=10
MAX_TOTAL_SIZE_MB=50
MAX_LOG_FILES=5

echo "🔄 Starting log rotation..."

for dir in "${LOG_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo "Processing directory: $dir"
    
    # Find and remove old log files
    find "$dir" -name "*.log" -type f -mtime +1 -delete 2>/dev/null || true
    
    # Find large log files and truncate them
    find "$dir" -name "*.log" -type f -size +${MAX_LOG_SIZE_MB}M -exec sh -c '
      file="$1"
      echo "Truncating large log file: $file"
      # Keep last 1000 lines
      tail -n 1000 "$file" > "${file}.tmp"
      mv "${file}.tmp" "$file"
    ' sh {} \;
    
    # Limit number of log files
    find "$dir" -name "*.log" -type f | sort -r | tail -n +$((MAX_LOG_FILES + 1)) | xargs rm -f 2>/dev/null || true
  fi
done

# Check total log usage
total_usage=$(du -cm /tmp /app/logs 2>/dev/null | tail -1 | cut -f1)
echo "Total log usage: ${total_usage}MB"

if [[ $total_usage -gt $MAX_TOTAL_SIZE_MB ]]; then
  echo "⚠️  Log usage exceeds limit, cleaning up..."
  # Clean oldest files regardless of age
  find /tmp /app/logs -name "*.log" -type f -printf "%T@ %p\n" | sort -n | head -n 10 | cut -d' ' -f2- | xargs rm -f
fi

# Clean up Next.js cache if it exists
if [[ -d "/app/.next/cache" ]]; then
  cache_size=$(du -cm /app/.next/cache 2>/dev/null | tail -1 | cut -f1)
  if [[ $cache_size -gt 20 ]]; then
    echo "Cleaning Next.js cache (${cache_size}MB)..."
    find /app/.next/cache -type f -mtime +1 -delete 2>/dev/null || true
  fi
fi

# Clean up npm cache if too large
if [[ -d "/home/nextjs/.npm" ]]; then
  npm_cache_size=$(du -cm /home/nextjs/.npm 2>/dev/null | tail -1 | cut -f1)
  if [[ $npm_cache_size -gt 50 ]]; then
    echo "Cleaning npm cache (${npm_cache_size}MB)..."
    npm cache clean --force 2>/dev/null || true
  fi
fi

echo "✅ Log rotation completed"