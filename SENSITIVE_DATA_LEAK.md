# 敏感信息泄漏应急处理方案

## 🚨 严重安全事件

预发环境和生产环境的敏感信息已泄漏到 GitHub 公开仓库，包括：

- 数据库密码
- Redis 密码  
- NextAuth Secret
- Google OAuth 凭据

## 立即行动项

### 1. 从 Git 历史中彻底移除敏感信息

```bash
# 1. 安装 BFG Repo-Cleaner
brew install bfg

# 2. 创建清理脚本
cat > clean-sensitive-data.txt << EOF
w8mhnnqh==>[DATABASE_PASSWORD]
9xdjb8nf==>[REDIS_PASSWORD]
85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834==>[AUTH_SECRET]
1007142410985-4945m48srrp056kp0q5n0e5he8omrdol==>[GOOGLE_OAUTH_ID]
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==>[GOOGLE_OAUTH_SECRET]
EOF

# 3. 运行清理
bfg --replace-text clean-sensitive-data.txt --no-blob-protection

# 4. 清理 reflog
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# 5. 强制推送（警告：会重写历史）
git push origin main --force
```

### 2. 立即更改所有凭据

```bash
# 数据库
ALTER USER postgres WITH PASSWORD 'new_strong_password_here';

# Redis
CONFIG SET requirepass 'new_strong_redis_password'

# NextAuth - 生成新的 secret
openssl rand -hex 64

# Google OAuth - 立即撤销现有凭据并创建新的
```

### 3. 更新环境变量

在 ClawCloud 控制台中更新：
- DATABASE_URL
- REDIS_URL  
- AUTH_SECRET
- AUTH_GOOGLE_ID
- AUTH_GOOGLE_SECRET

### 4. 检查是否被滥用

检查日志中的异常活动：
- 数据库访问日志
- Redis 访问日志
- Google OAuth 使用日志
- 认证日志

## 防止再次发生

### 1. 安装防护工具

```bash
# 安装 git-secrets
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets && make install

# 配置规则
git secrets --register-aws
git secrets --add "DATABASE_URL=postgresql://"
git secrets --add "REDIS_URL=redis://"
git secrets --add "AUTH_SECRET=[a-f0-9]{64}"
git secrets --add --global 'allowed_patterns "DATABASE_URL=postgresql://postgres:\*\*@localhost"'

# 安装到所有仓库
git secrets --install ~/.git-templates/git-secrets
git config --global init.templateDir ~/.git-templates/git-secrets
```

### 2. 设置 Pre-commit Hook

```bash
# 复制 pre-commit 钩子
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 3. 使用环境变量管理

考虑使用专门的密钥管理服务：
- [Doppler](https://doppler.com/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

### 4. 代码审查清单

添加到代码审查清单：
- [ ] 硬编码的密码或密钥
- [ ] 环境变量文件
- [ ] 配置文件中的敏感信息
- [ ] 注释中的临时凭据
- [ ] 调试代码中的敏感信息

## 已完成的清理工作

✅ 清理 `.env.example` 中的敏感信息  
✅ 创建 pre-commit 钩子防止未来泄漏  
✅ 创建安全事件响应文档  
✅ docs/MustKnow.md 已在 .gitignore 中  
⏳ 需要从 Git 历史中彻底移除  

## 紧急联系

如果需要立即帮助：
- 查看完整的安全事件响应文档：`SECURITY_INCIDENT_RESPONSE.md`
- 使用清理脚本：`scripts/clean-all-sensitive-info.sh`

---

**注意：这是一个严重的安全事件，需要立即处理！**