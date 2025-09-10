#!/bin/bash

echo "=== Dependency Analysis and Cleanup ==="
echo

# Check current size
if [ -d "node_modules" ]; then
    echo "Current node_modules size: $(du -sh node_modules | cut -f1)"
else
    echo "node_modules not found"
    exit 1
fi

echo
echo "Large packages (>50MB):"
find node_modules -maxdepth 1 -type d -name "node_modules" -prune -o -type d -print0 | while IFS= read -r -d '' dir; do
    if [ "$dir" != "node_modules" ]; then
        size=$(du -sh "$dir" 2>/dev/null | cut -f1)
        # Convert to number for comparison
        size_num=$(echo "$size" | sed 's/[A-Za-z]//g')
        unit=$(echo "$size" | sed 's/[0-9.]//g')
        
        # Compare based on unit
        if [[ "$unit" == "M" && "$size_num" -gt 50 ]] || [[ "$unit" == "G" ]]; then
            echo "  $size - $(basename "$dir")"
        fi
    fi
done | sort -hr

echo
echo "Suggestions for cleanup:"
echo

# Check for development dependencies
echo "Development dependencies that might not be needed in production:"
npm ls --dev --depth=0 --silent 2>/dev/null | grep -E "(jest|vitest|storybook|testing-library|eslint|prettier|@types)" | sed 's/^[^a-zA-Z]*//'

echo
echo "Cleanup options:"
echo "1. npm prune --omit=dev    # Remove devDependencies"
echo "2. npm cache clean --force # Clear npm cache"
echo "3. Manual removal of specific packages"

echo
echo "Warning: Only remove dependencies you're sure aren't needed!"

# Ask if user wants to proceed with prune
read -p "Do you want to run 'npm prune --omit=dev'? (y/N): " response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "Removing devDependencies..."
    npm prune --omit=dev
    echo "Done! New node_modules size: $(du -sh node_modules 2>/dev/null | cut -f1)"
else
    echo "No changes made"
fi