#!/bin/bash

# Test Configuration Verification Script
# This script verifies that all test dependencies are properly configured

echo "🔍 Verifying test configuration..."

# Check if jest.config.js exists
if [ ! -f "jest.config.js" ]; then
    echo "❌ jest.config.js not found"
    exit 1
fi

# Check if jest.setup.js exists
if [ ! -f "jest.setup.js" ]; then
    echo "❌ jest.setup.js not found"
    exit 1
fi

# Check if test-utils exists
if [ ! -f "__tests__/utils/api-test-utils.ts" ]; then
    echo "❌ Test utilities not found"
    exit 1
fi

# Check if required dev dependencies are installed
echo "📦 Checking test dependencies..."
npm list jest --depth=0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Jest is not installed"
    echo "Installing jest..."
    npm install --save-dev jest
fi

npm list @testing-library/jest-dom --depth=0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ @testing-library/jest-dom is not installed"
    echo "Installing @testing-library/jest-dom..."
    npm install --save-dev @testing-library/jest-dom
fi

# Check if playwright is installed for e2e tests
npm list @playwright/test --depth=0 > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  Playwright is not installed (e2e tests will be skipped)"
fi

# Check TypeScript configuration
if [ ! -f "tsconfig.json" ]; then
    echo "❌ tsconfig.json not found"
    exit 1
fi

# Check if we can import our test utilities
echo "🔍 Testing import paths..."
npx tsx __tests__/utils/api-test-utils.ts > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Test utilities import successfully"
else
    echo "❌ Failed to import test utilities"
    exit 1
fi

# Verify test file structure
echo "📁 Checking test file structure..."
test_files=(
    "__tests__/api/admin/users.comprehensive.test.ts"
    "__tests__/api/admin/plans-subscriptions.test.ts"
    "__tests__/performance/admin-performance.test.ts"
    "__tests__/e2e/admin-workflows.test.ts"
    "__tests__/integration/core-services-integration.test.ts"
)

for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file not found"
    fi
done

echo ""
echo "🚀 Running a sample test to verify configuration..."

# Run a single test to verify everything works
npm test -- --testNamePattern="should return users list with stats" --verbose

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Test configuration verified successfully!"
    echo ""
    echo "📋 Available test commands:"
    echo "  npm test                    # Run all tests"
    echo "  npm run test:unit          # Run unit tests only"
    echo "  npm run test:integration    # Run integration tests"
    echo "  npm run test:performance   # Run performance tests"
    echo "  npm run test:security      # Run security tests"
    echo "  npm run test:smoke         # Run smoke tests with Playwright"
    echo ""
    echo "🔧 Test coverage:"
    echo "  npm run test:coverage      # Run tests with coverage report"
else
    echo ""
    echo "❌ Test configuration verification failed!"
    echo "Please check the error messages above and fix any issues."
    exit 1
fi