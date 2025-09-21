#!/bin/bash

# 配置验证工具
# 检查环境变量配置是否正确和完整

set -e

echo "🔍 环境配置验证工具"
echo "==================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 验证结果统计
ERRORS=0
WARNINGS=0
SUCCESS=0

# 验证函数
validate_required() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name${NC}: 未设置 - $description"
        ((ERRORS++))
        return 1
    else
        echo -e "${GREEN}✅ $var_name${NC}: 已设置"
        ((SUCCESS++))
        return 0
    fi
}

validate_optional() {
    local var_name=$1
    local var_value=${!var_name}
    local description=$2
    
    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  $var_name${NC}: 未设置 - $description"
        ((WARNINGS++))
        return 1
    else
        echo -e "${GREEN}✅ $var_name${NC}: 已设置"
        ((SUCCESS++))
        return 0
    fi
}

validate_format() {
    local var_name=$1
    local var_value=${!var_name}
    local pattern=$2
    local description=$3
    
    if [ -n "$var_value" ] && [[ ! $var_value =~ $pattern ]]; then
        echo -e "${RED}❌ $var_name${NC}: 格式错误 - $description"
        echo -e "   当前值: $var_value"
        ((ERRORS++))
        return 1
    elif [ -n "$var_value" ]; then
        echo -e "${GREEN}✅ $var_name${NC}: 格式正确"
        ((SUCCESS++))
        return 0
    fi
}

echo ""
echo -e "${BLUE}📋 核心环境变量检查${NC}"
echo "========================"

# 检查核心环境变量
validate_required "NEXT_PUBLIC_DOMAIN" "应用域名，用于自动适配所有URL配置"
validate_required "NEXT_PUBLIC_DEPLOYMENT_ENV" "部署环境标识 (development/preview/production/test)"

# 检查NEXT_PUBLIC_DEPLOYMENT_ENV值是否有效
if [ -n "$NEXT_PUBLIC_DEPLOYMENT_ENV" ]; then
    case "$NEXT_PUBLIC_DEPLOYMENT_ENV" in
        "development"|"preview"|"production"|"test")
            echo -e "${GREEN}✅ NEXT_PUBLIC_DEPLOYMENT_ENV${NC}: 值有效 ($NEXT_PUBLIC_DEPLOYMENT_ENV)"
            ((SUCCESS++))
            ;;
        *)
            echo -e "${RED}❌ NEXT_PUBLIC_DEPLOYMENT_ENV${NC}: 无效值 '$NEXT_PUBLIC_DEPLOYMENT_ENV'"
            echo -e "   支持的值: development, preview, production, test"
            ((ERRORS++))
            ;;
    esac
fi
validate_required "AUTH_SECRET" "NextAuth密钥，至少32字符"

# 检查AUTH_SECRET长度
if [ -n "$AUTH_SECRET" ]; then
    if [ ${#AUTH_SECRET} -lt 32 ]; then
        echo -e "${RED}❌ AUTH_SECRET${NC}: 长度不足 (${#AUTH_SECRET} < 32字符)"
        ((ERRORS++))
    elif [ ${#AUTH_SECRET} -ge 64 ]; then
        echo -e "${GREEN}✅ AUTH_SECRET${NC}: 长度优秀 (${#AUTH_SECRET}字符)"
        ((SUCCESS++))
    else
        echo -e "${YELLOW}⚠️  AUTH_SECRET${NC}: 长度可接受但建议64字符 (当前${#AUTH_SECRET}字符)"
        ((WARNINGS++))
    fi
fi

echo ""
echo -e "${BLUE}🔐 Google OAuth配置检查${NC}"
echo "=========================="

validate_required "AUTH_GOOGLE_ID" "Google OAuth客户端ID"
validate_required "AUTH_GOOGLE_SECRET" "Google OAuth客户端密钥"

# 检查Google OAuth ID格式
validate_format "AUTH_GOOGLE_ID" ".*\.apps\.googleusercontent\.com$" "应以.apps.googleusercontent.com结尾"

echo ""
echo -e "${BLUE}🗄️  数据库配置检查${NC}"
echo "======================"

validate_required "DATABASE_URL" "数据库连接字符串"
validate_optional "REDIS_URL" "Redis连接字符串（推荐设置）"

# 检查DATABASE_URL格式
validate_format "DATABASE_URL" "^postgresql://.*" "应以postgresql://开头"

echo ""
echo -e "${BLUE}🚀 自动适配配置预览${NC}"
echo "========================"

if [ -n "$NEXT_PUBLIC_DOMAIN" ]; then
    # 预测自动适配的配置
    if [ "$NODE_ENV" = "production" ] || [ "$NEXT_PUBLIC_DEPLOYMENT_ENV" = "production" ] || [ "$NEXT_PUBLIC_DEPLOYMENT_ENV" = "preview" ]; then
        PREDICTED_AUTH_URL="https://$NEXT_PUBLIC_DOMAIN"
        PREDICTED_API_URL="https://$NEXT_PUBLIC_DOMAIN/api"
        PROTOCOL="https"
    else
        PREDICTED_AUTH_URL="http://$NEXT_PUBLIC_DOMAIN"
        PREDICTED_API_URL="http://$NEXT_PUBLIC_DOMAIN/api"
        PROTOCOL="http"
    fi
    
    echo -e "${GREEN}🎯 预测的自动适配配置:${NC}"
    echo "   AUTH_URL: $PREDICTED_AUTH_URL"
    echo "   JWT issuer/audience: $NEXT_PUBLIC_DOMAIN"
    echo "   Cookie domain: $NEXT_PUBLIC_DOMAIN"
    echo "   API base URL: $PREDICTED_API_URL"
    echo "   安全Cookies: $([ "$PROTOCOL" = "https" ] && echo "启用" || echo "禁用")"
fi

echo ""
echo -e "${BLUE}🔗 Google OAuth配置建议${NC}"
echo "=========================="

if [ -n "$NEXT_PUBLIC_DOMAIN" ]; then
    echo "在Google Console中配置以下重定向URI:"
    echo "   $PREDICTED_AUTH_URL/api/auth/callback/google"
    echo ""
    echo "授权域名设置:"
    echo "   $NEXT_PUBLIC_DOMAIN"
fi

echo ""
echo -e "${BLUE}📊 验证结果统计${NC}"
echo "=================="

echo -e "${GREEN}✅ 成功: $SUCCESS 项${NC}"
echo -e "${YELLOW}⚠️  警告: $WARNINGS 项${NC}"
echo -e "${RED}❌ 错误: $ERRORS 项${NC}"

echo ""
if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 配置完美！所有检查都通过了。${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  配置基本正确，但有一些建议优化的地方。${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ 配置有错误，请修复后重新验证。${NC}"
    echo ""
    echo "💡 修复建议:"
    echo "1. 运行配置生成器: ./scripts/generate-env-config.sh <environment>"
    echo "2. 检查环境变量是否正确设置"
    echo "3. 确保AUTH_SECRET使用强随机生成的值"
    exit 1
fi