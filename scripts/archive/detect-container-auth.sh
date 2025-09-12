#!/bin/bash

# Enhanced container environment detection for NextAuth

echo "🔍 Enhanced container environment detection..."

# Check various container indicators
CONTAINER_INDICATORS=0

# Docker
if [ -f /.dockerenv ]; then
    echo "✅ Docker container detected"
    CONTAINER_INDICATORS=1
fi

# Kubernetes
if [ -n "$KUBERNETES_SERVICE_HOST" ]; then
    echo "✅ Kubernetes environment detected"
    CONTAINER_INDICATORS=1
fi

# Container hostname patterns
if [[ "$HOSTNAME" == *"autoads-preview-"* ]] || [[ "$HOSTNAME" == *"autoads-prod-"* ]]; then
    echo "✅ AutoAds container hostname detected: $HOSTNAME"
    CONTAINER_INDICATORS=1
fi

# Check if we're in a container
if [ $CONTAINER_INDICATORS -eq 1 ]; then
    echo "📦 Container environment confirmed"
    
    # Set environment variables for NextAuth
    export DOCKERIZED=true
    export CONTAINERIZED=true
    export NEXT_PUBLIC_CONTAINERIZED=true
    
    # Special handling for auth in containers
    export AUTH_COOKIE_DOMAIN=
    export AUTH_SKIP_DOMAIN_CHECK=true
    
    echo "✅ Container environment variables set"
    
    # Create .env.container with auth-specific settings
    cat > .env.container-auth << EOF
# Container-specific auth settings
DOCKERIZED=true
CONTAINERIZED=true
NEXT_PUBLIC_CONTAINERIZED=true
AUTH_COOKIE_DOMAIN=
AUTH_SKIP_DOMAIN_CHECK=true
AUTH_TRUST_HOST=true
EOF
    
    echo "✅ Created container auth environment file"
else
    echo "🖥️  Non-container environment detected"
fi

echo "🚀 Environment detection complete"
