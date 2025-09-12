#!/bin/bash

# 等待部署更新的简单脚本
echo "⏳ Waiting for deployment to update..."
echo "This will check every 30 seconds for the /api/config endpoint"
echo "Press Ctrl+C to stop waiting"
echo ""

while true; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://www.autoads.dev/api/config")
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "\n✅ Deployment updated! /api/config is now available"
        
        # 获取配置
        echo -e "\n📋 Runtime Configuration:"
        curl -s "https://www.autoads.dev/api/config" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('  GA_ID:', data.get('GA_ID', 'NOT_SET'))
    print('  API_BASE_URL:', data.get('API_BASE_URL', 'NOT_SET'))
    print('  DEPLOYMENT_ENV:', data.get('DEPLOYMENT_ENV', 'NOT_SET'))
    print('  Timestamp:', data.get('timestamp', 'NOT_SET'))
except:
    print('  Could not parse configuration')
"
        
        break
    else
        echo -n "."
        sleep 30
    fi
done

echo -e "\n🎉 All set! Your runtime configuration is now live."