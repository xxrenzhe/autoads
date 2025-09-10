#!/bin/bash

# Fix error handling patterns in TypeScript files
# This script converts logger.error(error) to logger.error(error instanceof Error ? error : undefined)

find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "logger\.error.*error.*);" | while read file; do
    # Create backup
    cp "$file" "$file.bak"
    
    # Fix pattern: logger.error('message:', error);
    sed -i '' 's/logger\.error(\([^:]*\):, error);/logger.error(\1:, error instanceof Error ? error : undefined);/g' "$file"
    
    # Fix pattern: logger.error('message', error);
    sed -i '' 's/logger\.error(\([^,]*\), error);/logger.error(\1, error instanceof Error ? error : undefined);/g' "$file"
    
    echo "Fixed error handling in $file"
done

echo "Error handling fix completed"