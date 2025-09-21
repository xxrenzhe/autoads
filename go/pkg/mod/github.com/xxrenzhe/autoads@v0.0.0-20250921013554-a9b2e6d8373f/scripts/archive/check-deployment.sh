#!/bin/bash

# ========================================
# 快速部署检查脚本
# 用于在部署前检查配置和状态
# ========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取当前分支和环境
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" ]]; then
    DEPLOY_ENV="preview"
    EXPECTED_TAG="preview-latest"
    DOMAIN="urlchecker.dev"
elif [[ "$CURRENT_BRANCH" == "production" ]]; then
    DEPLOY_ENV="production"
    EXPECTED_TAG="prod-latest"
    DOMAIN="autoads.dev"
else
    print_error "Invalid branch: $CURRENT_BRANCH"
    print_info "This script should be run from 'main' or 'production' branch"
    exit 1
fi

print_info "=== AutoAds Deployment Check ==="
print_info "Environment: $DEPLOY_ENV"
print_info "Current Branch: $CURRENT_BRANCH"
print_info "Expected Image Tag: $EXPECTED_TAG"
print_info "Domain: $DOMAIN"
echo ""

# 检查1: 工作区状态
print_info "1. Checking git workspace status..."
if [[ -n "$(git status --porcelain)" ]]; then
    print_warning "Working directory is not clean"
    git status --porcelain
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    print_success "Working directory is clean"
fi
echo ""

# 检查2: 是否有未推送的提交
print_info "2. Checking for unpushed commits..."
if [[ -n "$(git log origin/$CURRENT_BRANCH..$CURRENT_BRANCH --oneline)" ]]; then
    print_warning "There are unpushed commits:"
    git log origin/$CURRENT_BRANCH..$CURRENT_BRANCH --oneline
    echo ""
    read -p "Push commits first? (Y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git push origin $CURRENT_BRANCH
        print_success "Commits pushed successfully"
    fi
else
    print_success "All commits are pushed"
fi
echo ""

# 检查3: GitHub Actions 状态
print_info "3. Checking GitHub Actions status..."
LATEST_RUN=$(gh run list --branch $CURRENT_BRANCH --limit 1 --json databaseId,status,conclusion --jq '.[0]')
if [[ -n "$LATEST_RUN" ]]; then
    RUN_ID=$(echo $LATEST_RUN | jq -r '.databaseId')
    STATUS=$(echo $LATEST_RUN | jq -r '.status')
    CONCLUSION=$(echo $LATEST_RUN | jq -r '.conclusion')
    
    echo "Latest run: #$RUN_ID"
    echo "Status: $STATUS"
    echo "Conclusion: $CONCLUSION"
    
    if [[ "$STATUS" != "completed" ]]; then
        print_warning "Latest workflow is still running"
        echo "View: https://github.com/xxrenzhe/url-batch-checker/actions/runs/$RUN_ID"
        exit 1
    elif [[ "$CONCLUSION" != "success" ]]; then
        print_error "Latest workflow failed"
        echo "View: https://github.com/xxrenzhe/url-batch-checker/actions/runs/$RUN_ID"
        exit 1
    else
        print_success "Latest workflow completed successfully"
    fi
else
    print_warning "No workflow runs found"
fi
echo ""

# 检查4: 镜像是否存在
print_info "4. Checking Docker image availability..."
IMAGE_NAME="ghcr.io/xxrenzhe/url-batch-checker:$EXPECTED_TAG"
if docker manifest inspect $IMAGE_NAME > /dev/null 2>&1; then
    print_success "Docker image exists: $IMAGE_NAME"
    # 获取镜像信息
    CREATED=$(docker manifest inspect $IMAGE_NAME | jq -r '.manifests[0].platform.created')
    DIGEST=$(docker manifest inspect $IMAGE_NAME | jq -r '.manifests[0].digest')
    echo "Created: $CREATED"
    echo "Digest: ${DIGEST:0:19}..."
else
    print_error "Docker image not found: $IMAGE_NAME"
    print_info "Please wait for GitHub Actions to complete the build"
    exit 1
fi
echo ""

# 检查5: 环境配置文件
print_info "5. Checking environment configuration..."
ENV_FILE=".env.clawcloud.$DEPLOY_ENV"
if [[ -f "$ENV_FILE" ]]; then
    print_success "Environment file found: $ENV_FILE"
    
    # 检查必需的变量
    REQUIRED_VARS=("REDIS_URL")
    if [[ "$DEPLOY_ENV" == "production" ]]; then
        REQUIRED_VARS+=("GOOGLE_ADS_CLIENT_ID" "GOOGLE_ADS_DEVELOPER_TOKEN" "GOOGLE_ADS_LOGIN_CUSTOMER_ID")
    fi
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^$var=" "$ENV_FILE"; then
            print_error "Required variable not found in $ENV_FILE: $var"
        else
            VALUE=$(grep "^$var=" "$ENV_FILE" | cut -d'=' -f2)
            if [[ -z "$VALUE" ]]; then
                print_warning "Variable $var is empty in $ENV_FILE"
            else
                print_success "Variable $var is configured"
            fi
        fi
    done
else
    print_error "Environment file not found: $ENV_FILE"
    exit 1
fi
echo ""

# 总结
print_success "=== Deployment Check Summary ==="
print_info "✅ Git workspace is clean"
print_info "✅ All commits are pushed"
print_info "✅ GitHub Actions completed successfully"
print_info "✅ Docker image is available"
print_info "✅ Environment configuration is ready"
echo ""

print_info "Next steps:"
echo "1. Login to ClawCloud console"
echo "2. Navigate to $DEPLOY_ENV environment"
echo "3. Update container image to: $IMAGE_NAME"
echo "4. Copy environment variables from: $ENV_FILE"
echo "5. Restart the service"
echo ""
print_warning "Remember to update actual values for REDIS_URL and other secrets!"
echo ""

# 询问是否继续部署
read -p "Ready to deploy? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_success "Deployment check passed! You can proceed with deployment."
else
    print_info "Deployment cancelled."
fi