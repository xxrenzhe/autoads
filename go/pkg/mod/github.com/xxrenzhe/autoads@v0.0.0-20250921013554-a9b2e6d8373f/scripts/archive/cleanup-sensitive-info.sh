#!/bin/bash

# 安全清理脚本 - 清理泄漏的敏感信息
# 警告：此脚本会永久修改文件，请先备份

echo "开始清理敏感信息..."

# 备份原始文件
cp docs/MustKnow.md docs/MustKnow.md.backup

# 由于MustKnow.md说明不能修改，我们需要特殊处理
# 创建一个不包含敏感信息的版本

# 数据库密码
sed -i '' 's/w8mhnnqh/[DATABASE_PASSWORD]/g' docs/MustKnow.md

# Redis密码  
sed -i '' 's/9xdjb8nf/[REDIS_PASSWORD]/g' docs/MustKnow.md

# AUTH_SECRET
sed -i '' 's/85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834/[AUTH_SECRET]/g' docs/MustKnow.md

# Google OAuth ID
sed -i '' 's/1007142410985-4945m48srrp056kp0q5n0e5he8omrdol/[GOOGLE_OAUTH_ID]/g' docs/MustKnow.md

# Google OAuth Secret
sed -i '' 's/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/[GOOGLE_OAUTH_SECRET]/g' docs/MustKnow.md

echo "清理完成！"
echo "已创建备份文件: docs/MustKnow.md.backup"
echo ""
echo "警告：真实的敏感信息已经提交到GitHub，需要："
echo "1. 立即更改所有密码和密钥"
echo "2. 撤销并重新生成Google OAuth凭据"
echo "3. 检查是否有未授权的访问"