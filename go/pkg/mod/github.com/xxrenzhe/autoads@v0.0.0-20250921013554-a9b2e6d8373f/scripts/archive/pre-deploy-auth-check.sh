#!/bin/bash

echo "🚀 部署前认证配置检查"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_env_var() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -n "$var_value" ]; then
        echo -e "${GREEN}✅ $var_name${NC}: ${var_value:0:20}..."
        return 0
    else
        echo -e "${RED}❌ $var_name${NC}: 未设置"
        return 1
    fi
}

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo -e "${GREEN}✅ 已加载.env文件${NC}"
else
    echo -e "${RED}❌ 未找到.env文件${NC}"
    exit 1
fi

echo ""
echo "📋 环境变量检查:"

# 检查必需的环境变量
REQUIRED_VARS=(
    "NEXT_PUBLIC_DEPLOYMENT_ENV"
    "NEXT_PUBLIC_DOMAIN" 
    "AUTH_SECRET"
    "AUTH_GOOGLE_ID"
    "AUTH_GOOGLE_SECRET"
)

MISSING_VARS=0
for var in "${REQUIRED_VARS[@]}"; do
    if ! check_env_var "$var"; then
        ((MISSING_VARS++))
    fi
done

echo ""
echo "🔍 配置验证:"

# 验证环境配置
case "$NEXT_PUBLIC_DEPLOYMENT_ENV" in
    "development")
        EXPECTED_DOMAIN="localhost:3000"
        EXPECTED_PROTOCOL="http"
        ;;
    "preview")
        EXPECTED_DOMAIN="urlchecker.dev"
        EXPECTED_PROTOCOL="https"
        ;;
    "production")
        EXPECTED_DOMAIN="autoads.dev"
        EXPECTED_PROTOCOL="https"
        ;;
    *)
        echo -e "${RED}❌ 未知的部署环境: $NEXT_PUBLIC_DEPLOYMENT_ENV${NC}"
        EXPECTED_DOMAIN="unknown"
        EXPECTED_PROTOCOL="unknown"
        ;;
esac

# 检查域名配置
if [ "$NEXT_PUBLIC_DOMAIN" = "$EXPECTED_DOMAIN" ]; then
    echo -e "${GREEN}✅ 域名配置正确${NC}: $NEXT_PUBLIC_DOMAIN"
else
    echo -e "${YELLOW}⚠️ 域名配置可能不匹配${NC}"
    echo "   期望: $EXPECTED_DOMAIN"
    echo "   实际: $NEXT_PUBLIC_DOMAIN"
fi

# 生成重定向URI
REDIRECT_URI="${EXPECTED_PROTOCOL}://${NEXT_PUBLIC_DOMAIN}/api/auth/callback/google"
echo -e "${GREEN}📍 当前环境重定向URI${NC}: $REDIRECT_URI"

echo ""
echo "🔧 Google Console配置检查清单:"
echo "确保在Google Cloud Console中配置了以下重定向URI:"
echo "  ✓ http://localhost:3000/api/auth/callback/google"
echo "  ✓ https://urlchecker.dev/api/auth/callback/google"
echo "  ✓ https://autoads.dev/api/auth/callback/google"

echo ""
echo "🧪 NextAuth配置文件检查:"

# 检查配置文件是否存在
CONFIG_FILES=(
    "src/lib/auth/v5-config.ts"
    "src/lib/auth/auth-config.ts"
    "middleware.ts"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC} 存在"
    else
        echo -e "${RED}❌ $file${NC} 不存在"
    fi
done

echo ""
echo "🔐 安全配置检查:"

# 检查AUTH_SECRET长度
if [ ${#AUTH_SECRET} -ge 32 ]; then
    echo -e "${GREEN}✅ AUTH_SECRET长度充足${NC} (${#AUTH_SECRET} 字符)"
else
    echo -e "${YELLOW}⚠️ AUTH_SECRET可能过短${NC} (${#AUTH_SECRET} 字符，建议至少32字符)"
fi

# 检查Google OAuth ID格式
if [[ $AUTH_GOOGLE_ID == *".apps.googleusercontent.com" ]]; then
    echo -e "${GREEN}✅ Google Client ID格式正确${NC}"
else
    echo -e "${RED}❌ Google Client ID格式可能不正确${NC}"
fi

# 检查Google Secret格式
if [[ $AUTH_GOOGLE_SECRET == "GOCSPX-"* ]]; then
    echo -e "${GREEN}✅ Google Client Secret格式正确${NC}"
else
    echo -e "${RED}❌ Google Client Secret格式可能不正确${NC}"
fi

echo ""
echo "📊 检查总结:"

if [ $MISSING_VARS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有必需环境变量已设置${NC}"
else
    echo -e "${RED}❌ 缺少 $MISSING_VARS 个必需环境变量${NC}"
fi

echo ""
echo "🚀 部署建议:"

if [ $MISSING_VARS -eq 0 ] && [ "$NEXT_PUBLIC_DOMAIN" = "$EXPECTED_DOMAIN" ]; then
    echo -e "${GREEN}✅ 配置检查通过，可以部署${NC}"
    echo ""
    echo "部署后请执行以下测试:"
    echo "1. 访问应用主页"
    echo "2. 点击Google登录按钮"
    echo "3. 完成OAuth流程"
    echo "4. 验证登录状态"
else
    echo -e "${YELLOW}⚠️ 发现配置问题，建议修复后再部署${NC}"
    echo ""
    echo "修复建议:"
    if [ $MISSING_VARS -gt 0 ]; then
        echo "- 设置缺少的环境变量"
    fi
    if [ "$NEXT_PUBLIC_DOMAIN" != "$EXPECTED_DOMAIN" ]; then
        echo "- 检查域名配置是否与部署环境匹配"
    fi
fi

echo ""
echo "🔗 相关文档:"
echo "- CSRF_TOKEN_FIX_COMPLETE_GUIDE.md"
echo "- docs/google-oauth-setup-guide.md"
echo "- docs/deployment-env-guide.md"