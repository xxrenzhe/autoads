#!/bin/bash

# 部署状态检查脚本
# 检查GitHub Actions构建状态和ClawCloud部署状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 检查部署状态...${NC}"
echo "时间: $(date)"
echo ""

# 1. 检查最新提交
echo -e "${BLUE}1. 最新提交信息:${NC}"
git log --oneline -3
echo ""

# 2. 检查当前分支
echo -e "${BLUE}2. 当前分支:${NC}"
current_branch=$(git branch --show-current)
echo "分支: $current_branch"

if [[ "$current_branch" == "main" ]]; then
    echo -e "  → 触发镜像: ${YELLOW}preview-latest${NC}"
elif [[ "$current_branch" == "production" ]]; then
    echo -e "  → 触发镜像: ${RED}prod-latest${NC}"
else
    echo -e "  → ${YELLOW}⚠️  非部署分支${NC}"
fi
echo ""

# 3. 检查GitHub Actions状态（需要gh CLI）
echo -e "${BLUE}3. GitHub Actions 状态:${NC}"
if command -v gh &> /dev/null; then
    echo "检查最新的workflow运行状态..."
    gh run list --limit 3 --json status,conclusion,headBranch,createdAt,workflowName | jq -r '.[] | "  \(.workflowName) (\(.headBranch)): \(.status) - \(.conclusion // "running") - \(.createdAt)"'
else
    echo -e "${YELLOW}⚠️  未安装 GitHub CLI (gh)，无法检查Actions状态${NC}"
    echo "请访问: https://github.com/xxrenzhe/url-batch-checker/actions"
fi
echo ""

# 4. 检查预发环境状态
echo -e "${BLUE}4. 预发环境状态检查:${NC}"
echo "域名: www.urlchecker.dev"

# 检查主页
echo -n "  主页访问: "
if curl -s -I https://www.urlchecker.dev/ | head -1 | grep -q "200 OK"; then
    echo -e "${GREEN}✅ 正常${NC}"
elif curl -s -I https://www.urlchecker.dev/ | head -1 | grep -q "308"; then
    echo -e "${RED}❌ 308重定向${NC}"
else
    echo -e "${YELLOW}⚠️  异常${NC}"
fi

# 检查API健康
echo -n "  API健康检查: "
if curl -s -I https://www.urlchecker.dev/api/health | head -1 | grep -q "200 OK"; then
    echo -e "${GREEN}✅ 正常${NC}"
else
    echo -e "${RED}❌ 异常${NC}"
fi

# 检查调试端点
echo -n "  调试端点: "
if curl -s -I https://www.urlchecker.dev/api/debug | head -1 | grep -q "200 OK"; then
    echo -e "${GREEN}✅ 正常${NC}"
    
    # 获取环境信息
    echo "  环境信息:"
    debug_info=$(curl -s https://www.urlchecker.dev/api/debug 2>/dev/null)
    if [[ -n "$debug_info" ]]; then
        echo "$debug_info" | jq -r '.environment | "    NODE_ENV: \(.NODE_ENV // "未设置")\n    DEPLOYMENT_ENV: \(.NEXT_PUBLIC_DEPLOYMENT_ENV // "未设置")\n    DOMAIN: \(.NEXT_PUBLIC_DOMAIN // "未设置")"' 2>/dev/null || echo "    无法解析环境信息"
    fi
else
    echo -e "${RED}❌ 异常${NC}"
fi
echo ""

# 5. 检查HSTS状态
echo -e "${BLUE}5. HSTS状态检查:${NC}"
hsts_header=$(curl -s -I https://www.urlchecker.dev/ | grep -i "strict-transport-security" || echo "未找到HSTS头部")
echo "  $hsts_header"

if echo "$hsts_header" | grep -q "max-age=0"; then
    echo -e "  ${GREEN}✅ HSTS已禁用${NC}"
elif echo "$hsts_header" | grep -q "max-age"; then
    echo -e "  ${RED}❌ HSTS仍然启用${NC}"
else
    echo -e "  ${YELLOW}⚠️  未设置HSTS头部${NC}"
fi
echo ""

# 6. 总结和建议
echo -e "${BLUE}6. 总结和建议:${NC}"

# 检查是否有308重定向
if curl -s -I https://www.urlchecker.dev/ | head -1 | grep -q "308"; then
    echo -e "${RED}❌ 仍然存在308重定向问题${NC}"
    echo ""
    echo "建议操作:"
    echo "1. 确认ClawCloud已部署最新镜像"
    echo "2. 检查环境变量配置"
    echo "3. 清除浏览器HSTS缓存"
    echo "4. 查看ClawCloud应用日志"
else
    echo -e "${GREEN}✅ 预发环境运行正常${NC}"
    echo ""
    echo "如果浏览器仍有问题，请清除HSTS缓存:"
    echo "Chrome: chrome://net-internals/#hsts"
fi

echo ""
echo -e "${BLUE}📋 相关链接:${NC}"
echo "  GitHub Actions: https://github.com/xxrenzhe/url-batch-checker/actions"
echo "  预发环境: https://www.urlchecker.dev/"
echo "  调试端点: https://www.urlchecker.dev/api/debug"