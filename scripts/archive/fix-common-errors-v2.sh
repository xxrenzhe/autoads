#!/bin/bash

# Fix common TypeScript errors systematically

echo "Fixing TypeScript errors..."

# Fix MultiLevelCacheService.getInstance() calls
find src -name "*.ts" -not -path "node_modules/*" -exec sed -i '' 's/MultiLevelCacheService\.getInstance()/MultiLevelCacheService/g' {} \;

# Fix error handling in logger.error calls
find src -name "*.ts" -not -path "node_modules/*" -exec sed -i '' 's/logger\.error(\([^)]*\), error);/logger.error(\1, error as Error);/g' {} \;

# Fix any type parameters in reduce functions
find src -name "*.ts" -not -path "node_modules/*" -exec sed -i '' 's/reduce((\([a-zA-Z]\+\), \([a-zA-Z]\+\))/reduce((\1: any, \2: any/g' {} \;

echo "Fixed common TypeScript errors"