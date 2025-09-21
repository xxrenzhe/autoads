#!/bin/bash

# Build and test the Puppeteer Docker image
echo "🏗️ Building test Docker image with Chrome..."

# Build the test image
docker build -f Dockerfile.puppeteer-test -t puppeteer-test . 

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    echo "🧪 Running Puppeteer test..."
    docker run --rm puppeteer-test
    
    if [ $? -eq 0 ]; then
        echo "✅ Puppeteer test passed!"
        echo "🚀 Now rebuilding the main application..."
        
        # Rebuild the main application
        docker build -f Dockerfile.standalone -t url-batch-checker:chrome-fixed .
        
        if [ $? -eq 0 ]; then
            echo "✅ Main application rebuilt with Chrome support!"
        else
            echo "❌ Main application build failed"
            exit 1
        fi
    else
        echo "❌ Puppeteer test failed"
        exit 1
    fi
else
    echo "❌ Docker build failed"
    exit 1
fi