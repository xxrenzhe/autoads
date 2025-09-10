# 安全事件响应：敏感信息泄漏

## 事件摘要

**严重程度**: 🔴 严重  
**发现时间**: $(date)  
**影响范围**: 预发环境和生产环境的凭据已泄漏

## 泄漏的敏感信息

以下敏感信息已提交到 GitHub 公开仓库：

### 1. 数据库凭据
- **主机**: dbprovider.sg-members-1.clawcloudrun.com:32404
- **用户名**: postgres
- **密码**: `w8mhnnqh`

### 2. Redis 凭据
- **主机**: dbprovider.sg-members-1.clawcloudrun.com:32284
- **密码**: `9xdjb8nf`

### 3. 认证密钥
- **NextAuth Secret**: `85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834`

### 4. Google OAuth 凭据
- **Client ID**: `1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com`
- **Client Secret**: `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`

## 立即行动项

### 🔥 紧急（1小时内完成）

1. **更改数据库密码**
   ```bash
   ALTER USER postgres WITH PASSWORD 'new_strong_password';
   ```

2. **更改 Redis 密码**
   ```bash
   # 在 Redis CLI 中
   CONFIG SET requirepass new_strong_password
   ```

3. **撤销 Google OAuth 凭据**
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 立即撤销现有的 OAuth 客户端 ID
   - 创建新的 OAuth 凭据

4. **更新环境变量**
   - ClawCloud 控制台更新所有环境变量
   - 重启所有服务

### ⚠️ 高优先级（24小时内完成）

1. **检查访问日志**
   - 检查数据库和 Redis 的访问日志
   - 查找可疑的访问模式

2. **审计 GitHub 访问**
   - 检查谁访问了包含敏感信息的提交
   - 检查是否有 fork 包含敏感信息

3. **通知相关人员**
   - 通知开发团队
   - 通知安全团队（如果有）

### 📋 中优先级（一周内完成）

1. **建立防止再次发生的机制**
   - 添加 pre-commit 钩子检查敏感信息
   - 使用 git-secrets 工具
   - 定期扫描代码库

2. **安全培训**
   - 对开发人员进行安全培训
   - 制定敏感信息处理规范

## 清理步骤

已执行的清理操作：

1. ✅ 清理 `.env.example` 中的敏感信息
2. ⏳ 等待确认是否修改 `docs/MustKnow.md`（文件说明禁止修改）
3. ⏳ 需要创建安全检查机制

## 预防措施

### 1. 技术措施

```bash
# 安装 git-secrets
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install

# 配置 git-secrets
git secrets --install
git secrets --add 'DATABASE_URL=.*'
git secrets --add 'REDIS_URL=.*'
git secrets --add 'AUTH_SECRET=.*'
git secrets --add 'AUTH_GOOGLE_ID=.*'
git secrets --add 'AUTH_GOOGLE_SECRET=.*'
```

### 2. Pre-commit 钩子

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash
# 检查敏感信息
if git diff --cached | grep -q -E '(DATABASE_URL|REDIS_URL|AUTH_SECRET|AUTH_GOOGLE_ID|AUTH_GOOGLE_SECRET)'; then
    echo "错误：提交包含可能的敏感信息！"
    echo "请检查并移除敏感信息后重试。"
    exit 1
fi
```

### 3. 环境变量管理

- 使用环境变量管理服务（如 Doppler、Vault）
- 所有敏感信息必须通过环境变量注入
- 禁止在代码中硬编码敏感信息

## 联系信息

- 安全负责人: [指定人员]
- 紧急联系: [联系方式]

---

*本文档创建于 $(date)*  
*最后更新: $(date)*