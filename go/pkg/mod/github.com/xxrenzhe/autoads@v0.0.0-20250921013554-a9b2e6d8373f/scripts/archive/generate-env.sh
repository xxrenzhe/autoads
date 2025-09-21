#!/bin/bash

# 环境变量生成脚本
# 用于快速生成不同环境的环境变量配置

echo "🔧 环境变量配置生成器"
echo ""

# 选择环境
echo "请选择部署环境:"
echo "1) 预发环境 (urlchecker.dev)"
echo "2) 生产环境 (autoads.dev)"
echo "3) 开发环境 (localhost)"
read -p "请输入选项 (1-3): " env_choice

case $env_choice in
    1)
        env="preview"
        domain="urlchecker.dev"
        auth_url="https://www.urlchecker.dev"
        ;;
    2)
        env="production"
        domain="autoads.dev"
        auth_url="https://www.autoads.dev"
        ;;
    3)
        env="development"
        domain="localhost:3000"
        auth_url="http://localhost:3000"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

echo ""
echo "📋 生成 $env 环境配置..."
echo ""

# 生成环境变量文件
cat > .env.generated << EOF
# ===== 核心配置 =====
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=$env
NEXT_PUBLIC_DOMAIN=$domain

# ===== 数据库配置 =====
DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/?directConnection=true
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284

# ===== 认证配置 =====
AUTH_SECRET=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-64)
AUTH_URL=$auth_url
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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

EOF

echo "✅ 已生成 .env.generated 文件"
echo ""

# 显示配置摘要
echo "📊 配置摘要:"
echo "   环境: $env"
echo "   域名: $domain"
echo "   认证URL: $auth_url"
echo "   数据库: 已配置"
echo "   Redis: 已配置"
echo ""

# 提示下一步
echo "🚀 下一步操作:"
echo "1. 复制 .env.generated 到 .env: cp .env.generated .env"
echo "2. 根据需要修改可选功能配置"
echo "3. 确保在ClawCloud中设置正确的环境变量"
echo "4. 提交代码并触发构建"
echo ""

# 询问是否配置可选功能
read -p "是否要配置可选功能？(y/N): " config_optional

if [[ $config_optional =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔧 可选功能配置:"
    echo ""
    
    # Stripe配置
    read -p "是否配置Stripe支付？(y/N): " config_stripe
    if [[ $config_stripe =~ ^[Yy]$ ]]; then
        echo "# ===== 支付配置 =====" >> .env.generated
        read -p "请输入Stripe公钥: " stripe_pk
        read -p "请输入Stripe私钥: " stripe_sk
        read -p "请输入Stripe Webhook密钥: " stripe_webhook
        
        cat >> .env.generated << EOF

# ===== 支付配置 =====
STRIPE_PUBLISHABLE_KEY=$stripe_pk
STRIPE_SECRET_KEY=$stripe_sk
STRIPE_WEBHOOK_SECRET=$stripe_webhook
EOF
    fi
    
    # 邮件配置
    read -p "是否配置邮件服务？(y/N): " config_email
    if [[ $config_email =~ ^[Yy]$ ]]; then
        echo "# ===== 邮件配置 =====" >> .env.generated
        read -p "SMTP服务器地址: " smtp_host
        read -p "SMTP端口 (587): " smtp_port
        smtp_port=${smtp_port:-587}
        read -p "SMTP用户名: " smtp_user
        read -s -p "SMTP密码: " smtp_pass
        
        cat >> .env.generated << EOF

# ===== 邮件配置 =====
EMAIL_PROVIDER=smtp
SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_USER=$smtp_user
SMTP_PASS=$smtp_pass
EOF
        echo ""
    fi
    
    # Google Analytics配置
    read -p "是否配置Google Analytics？(y/N): " config_ga
    if [[ $config_ga =~ ^[Yy]$ ]]; then
        read -p "请输入GA ID (如 G-XXXXXXXXXX): " ga_id
        
        cat >> .env.generated << EOF

# ===== 分析配置 =====
NEXT_PUBLIC_GA_ID=$ga_id
NEXT_PUBLIC_ENABLE_ANALYTICS=true
EOF
    fi
    
    echo "✅ 可选功能配置已添加到 .env.generated"
fi

echo ""
echo "🎉 环境变量配置完成！"
echo ""
echo "📝 重要提醒:"
echo "1. 请妥善保管 .env 文件，不要提交到版本控制"
echo "2. 生产环境请使用强密码和真实的OAuth密钥"
echo "3. 定期更新密钥和密码"
echo ""