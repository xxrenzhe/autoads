#!/bin/bash

# 彻底从 Git 历史中移除敏感信息
# 警告：这将重写 Git 历史，需要强制推送

set -e

echo "⚠️  警告：这将重写 Git 历史并需要强制推送！"
echo "确保所有协作者知道这个操作。"
echo ""
read -p "继续吗？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 1. 检查是否安装了 BFG
if ! command -v bfg &> /dev/null; then
    echo "安装 BFG Repo-Cleaner..."
    brew install bfg
fi

# 2. 创建敏感信息替换文件
echo "创建敏感信息替换文件..."
cat > sensitive-info-replacements.txt << EOF
w8mhnnqh==>[DATABASE_PASSWORD]
9xdjb8nf==>[REDIS_PASSWORD]
85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834==>[AUTH_SECRET]
1007142410985-4945m48srrp056kp0q5n0e5he8omrdol==>[GOOGLE_OAUTH_ID]
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==>[GOOGLE_OAUTH_SECRET]
postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404==>postgresql://postgres:[DATABASE_PASSWORD]@dbprovider.sg-members-1.clawcloudrun.com:32404
redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284==>redis://default:[REDIS_PASSWORD]@dbprovider.sg-members-1.clawcloudrun.com:32284
EOF

# 3. 运行 BFG 清理
echo "运行 BFG Repo-Cleaner..."
bfg --replace-text sensitive-info-replacements.txt --no-blob-protection

# 4. 清理 Git 历史
echo "清理 Git 历史..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. 检查文件大小
echo "检查仓库大小..."
du -sh .git

echo ""
echo "✅ 清理完成！"
echo ""
echo "下一步："
echo "1. 运行 'git log --oneline -p' 检查敏感信息是否已清理"
echo "2. 确认无误后，运行 'git push origin main --force'"
echo "3. 通知所有协成员重新克隆仓库"
echo ""
echo "⚠️  重要：这会重写历史，所有协作者需要："
echo "   - 备份当前工作"
echo "   - 重新克隆仓库"
echo "   - 重新应用任何未提交的更改"