#!/bin/bash

# Next.js配置切换脚本
# 用于在开发和生产环境之间切换配置

set -e

ENVIRONMENT=${1:-development}

echo "🔄 切换Next.js配置到: $ENVIRONMENT"

case $ENVIRONMENT in
  "development"|"dev")
    echo "📝 使用开发环境配置..."
    if [ -f "next.config.dev.js" ]; then
      cp next.config.dev.js next.config.js
      echo "✅ 已切换到开发环境配置"
    else
      echo "❌ 开发环境配置文件不存在"
      exit 1
    fi
    ;;
  "production"|"prod")
    echo "📝 使用生产环境配置..."
    if [ -f "next.config.prod.js" ]; then
      cp next.config.prod.js next.config.js
      echo "✅ 已切换到生产环境配置 (standalone模式)"
    else
      echo "❌ 生产环境配置文件不存在"
      exit 1
    fi
    ;;
  *)
    echo "❌ 未知环境: $ENVIRONMENT"
    echo "支持的环境: development, production"
    exit 1
    ;;
esac

echo "🎯 当前配置:"
head -5 next.config.js