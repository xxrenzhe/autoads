# Dependency Cleanup Script for Windows

echo "=== Checking for unused dependencies ==="

# Check if we can use npm-check
npm list -g npm-check >nul 2>&1
if %errorlevel% neq 0 (
    echo "Installing npm-check globally..."
    npm install -g npm-check
)

echo.
echo "Running dependency check..."
echo "This will show interactive options to remove unused dependencies"
echo.

npm-check

echo.
echo "Alternative: Manual cleanup suggestions"
echo "===================================="

# Check for common dev dependencies that might not be needed
echo "Large dev dependencies that might be candidates for removal:"
npm ls --dev --depth=0 --silent 2>nul | findstr /i "jest vitest storybook eslint prettier typescript @types"

echo.
echo "To manually remove a package: npm uninstall <package-name>"
echo "To remove dev dependency: npm uninstall <package-name> --save-dev"