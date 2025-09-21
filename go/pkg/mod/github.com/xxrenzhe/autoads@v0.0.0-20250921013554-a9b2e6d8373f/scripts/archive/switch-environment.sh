#!/bin/bash

# 环境切换脚本
# 用于在本地开发时快速切换不同环境的配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示使用说明
show_usage() {
    echo -e "${BLUE}环境切换脚本${NC}"
    echo ""
    echo "用法: $0 [环境]"
    echo ""
    echo "支持的环境:"
    echo -e "  ${GREEN}dev${NC}        - 本地开发环境 (localhost)"
    echo -e "  ${YELLOW}preview${NC}    - 预发环境 (urlchecker.dev)"
    echo -e "  ${RED}production${NC} - 生产环境 (autoads.dev)"
    echo ""
    echo "示例:"
    echo "  $0 dev        # 切换到开发环境"
    echo "  $0 preview    # 切换到预发环境"
    echo "  $0 production # 切换到生产环境"
}

# 创建环境配置文件
create_env_file() {
    local env=$1
    local env_file="$PROJECT_ROOT/.env.local"
    
    echo -e "${BLUE}创建 $env 环境配置...${NC}"
    
    case $env in
        "dev")
            cat > "$env_file" << EOF
# 本地开发环境配置
NODE_ENV=development
NEXT_PUBLIC_DEPLOYMENT_ENV=development
NEXT_PUBLIC_APP_NAME=AutoAds
NEXT_PUBLIC_APP_VERSION=2.3.0

# 域名配置
NEXT_PUBLIC_DOMAIN=localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Redis配置 - 已移除，使用混合队列替代

# 其他配置
NEXT_PUBLIC_DEBUG_MODE=true
LOG_LEVEL=info

# 浏览器配置
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
DOCKER_ENV=false

# 启用混合队列（替代Redis FIFO）
USE_HYBRID_QUEUE=true

# 代理API配置
PROXY_API_URL=https://api.iprocket.io/api?username=com49692430&password=ApL72Exh03L0tgTLcb12&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt

# Redis配置（如果使用Redis）
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
EOF
            echo -e "${GREEN}✅ 开发环境配置已创建${NC}"
            ;;
            
        "preview")
            cat > "$env_file" << EOF
# 预发环境配置（本地测试用）
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
NEXT_PUBLIC_APP_NAME=URLChecker
NEXT_PUBLIC_APP_VERSION=2.3.0

# 域名配置
NEXT_PUBLIC_DOMAIN=www.urlchecker.dev
NEXT_PUBLIC_BASE_URL=https://www.urlchecker.dev

# 其他配置
NEXT_PUBLIC_DEBUG_MODE=true
LOG_LEVEL=info

# 浏览器配置
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
DOCKER_ENV=false

# 启用混合队列
USE_HYBRID_QUEUE=true

# 代理API配置
PROXY_API_URL=https://api.iprocket.io/api?username=com49692430&password=ApL72Exh03L0tgTLcb12&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt

# Redis配置
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
EOF
            echo -e "${YELLOW}✅ 预发环境配置已创建${NC}"
            ;;
            
        "production")
            cat > "$env_file" << EOF
# 生产环境配置（本地测试用）
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=production
NEXT_PUBLIC_APP_NAME=AutoAds
NEXT_PUBLIC_APP_VERSION=2.3.0

# 域名配置
NEXT_PUBLIC_DOMAIN=www.autoads.dev
NEXT_PUBLIC_BASE_URL=https://www.autoads.dev

# 其他配置
NEXT_PUBLIC_DEBUG_MODE=false
LOG_LEVEL=warn

# 浏览器配置
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
DOCKER_ENV=false

# 启用混合队列
USE_HYBRID_QUEUE=true

# 代理API配置
PROXY_API_URL=https://api.iprocket.io/api?username=com49692430&password=ApL72Exh03L0tgTLcb12&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt

# Redis配置
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
EOF
            echo -e "${RED}✅ 生产环境配置已创建${NC}"
            ;;
            
        *)
            echo -e "${RED}❌ 不支持的环境: $env${NC}"
            show_usage
            exit 1
            ;;
    esac
}

# 显示当前环境状态
show_current_env() {
    local env_file="$PROJECT_ROOT/.env.local"
    
    if [[ -f "$env_file" ]]; then
        echo -e "${BLUE}当前环境配置:${NC}"
        echo ""
        
        local deployment_env=$(grep "NEXT_PUBLIC_DEPLOYMENT_ENV" "$env_file" | cut -d'=' -f2)
        local domain=$(grep "NEXT_PUBLIC_DOMAIN" "$env_file" | cut -d'=' -f2)
        local base_url=$(grep "NEXT_PUBLIC_BASE_URL" "$env_file" | cut -d'=' -f2)
        
        case $deployment_env in
            "development")
                echo -e "  环境: ${GREEN}开发环境${NC}"
                ;;
            "preview")
                echo -e "  环境: ${YELLOW}预发环境${NC}"
                ;;
            "production")
                echo -e "  环境: ${RED}生产环境${NC}"
                ;;
            *)
                echo -e "  环境: ${NC}未知${NC}"
                ;;
        esac
        
        echo "  域名: $domain"
        echo "  基础URL: $base_url"
    else
        echo -e "${YELLOW}⚠️  未找到环境配置文件${NC}"
    fi
}

# 主函数
main() {
    cd "$PROJECT_ROOT"
    
    if [[ $# -eq 0 ]]; then
        show_current_env
        echo ""
        show_usage
        exit 0
    fi
    
    local env=$1
    
    case $env in
        "dev"|"development")
            create_env_file "dev"
            ;;
        "preview"|"staging")
            create_env_file "preview"
            ;;
        "prod"|"production")
            create_env_file "production"
            ;;
        "status"|"current")
            show_current_env
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            echo -e "${RED}❌ 不支持的环境: $env${NC}"
            show_usage
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}🚀 环境切换完成！${NC}"
    echo ""
    echo "接下来可以运行:"
    echo "  npm run dev    # 启动开发服务器"
    echo "  npm run build  # 构建应用"
    echo "  npm start      # 启动生产服务器"
}

main "$@"