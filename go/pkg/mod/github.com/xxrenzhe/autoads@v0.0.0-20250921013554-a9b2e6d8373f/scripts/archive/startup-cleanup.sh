#!/bin/bash

# Startup cleanup script
# Ensures clean state on container start

set -e

echo "🧹 Performing startup cleanup..."

# Clean old crash logs (keep only from last run)
find /tmp/crash-logs -name "*.log" -type f -mtime +0 -delete 2>/dev/null || true

# Clean old app logs
find /app/logs -name "*.log" -type f -mtime +1 -delete 2>/dev/null || true

# Clean temporary files
find /tmp -name "*.tmp" -type f -delete 2>/dev/null || true

# Clean Next.js cache if too large
if [[ -d "/app/.next/cache" ]]; then
  cache_size=$(du -cm /app/.next/cache 2>/dev/null | tail -1 | cut -f1)
  if [[ $cache_size -gt 10 ]]; then
    echo "Cleaning Next.js cache (${cache_size}MB)..."
    rm -rf /app/.next/cache/*
  fi
fi

echo "✅ Startup cleanup completed"