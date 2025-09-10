#!/bin/bash

# Container Environment Detection Script
# This script helps detect if we're running in a container environment

echo "🔍 Detecting container environment..."

# Check for Docker
if [ -f /.dockerenv ]; then
    echo "✅ Docker container detected"
    export DOCKERIZED=true
fi

# Check for container environment variables
if [ -n "$KUBERNETES_SERVICE_HOST" ]; then
    echo "✅ Kubernetes environment detected"
    export CONTAINERIZED=true
fi

# Check hostname pattern
if [[ "$HOSTNAME" == *"autoads-"* ]]; then
    echo "✅ AutoAds container hostname detected: $HOSTNAME"
    export CONTAINERIZED=true
fi

# Set container environment flag if any indicator is found
if [ "$DOCKERIZED" = "true" ] || [ "$CONTAINERIZED" = "true" ]; then
    echo "📦 Container environment detected, configuring authentication..."
    
    # Create container-specific .env file if it doesn't exist
    if [ ! -f .env.container ]; then
        echo "Creating container-specific environment file..."
        cat > .env.container << EOF
# Container-specific environment variables
DOCKERIZED=true
CONTAINERIZED=true
# Cookie settings for container environment
AUTH_COOKIE_DOMAIN=
AUTH_TRUST_HOST=true
EOF
    fi
    
    echo "✅ Container environment configured"
else
    echo "🖥️  Running in non-container environment"
fi
