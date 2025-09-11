# Google Ads API 接入手册

## 1. 概述

AdsCenterGo模块已经集成了Google Ads API，提供了完整的广告账户管理、数据同步和统计分析功能。

## 2. 准备工作

### 2.1 创建Google Cloud项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用Google Ads API

### 2.2 配置OAuth 2.0凭据

1. 在Google Cloud Console中，导航到"API和服务" > "凭据"
2. 点击"创建凭据" > "OAuth客户端ID"
3. 应用类型选择"Web应用"
4. 设置授权的重定向URI：`http://localhost:3000/api/auth/google-ads/callback`
5. 记录生成的"客户端ID"和"客户端密钥"

### 2.3 获取开发者令牌

1. 访问 [Google Ads API Center](https://ads.google.com/home/api/)
2. 创建或登录Google Ads账户
3. 请求开发者令牌（可能需要批准）
4. 记录开发者令牌

### 2.4 获取测试账户

1. 在Google Ads界面中创建测试广告账户
2. 记录客户ID（格式：123-456-7890）

## 3. 环境配置

### 3.1 环境变量设置

```bash
# Google Ads API配置
export GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"
export GOOGLE_ADS_CLIENT_ID="your-client-id"
export GOOGLE_ADS_CLIENT_SECRET="your-client-secret"
export GOOGLE_ADS_LOGIN_CUSTOMER_ID=""  # 可选：MCC账户ID

# 数据库和Redis配置
export DATABASE_URL="mysql://user:password@localhost:3306/autoads_gofly"
export REDIS_URL="redis://localhost:6379"
```

### 3.2 数据库迁移

确保执行数据库迁移，创建必要的表：

```bash
# 创建数据库表
mysql -u root -p autoads_gofly < database/migrations/adscentergo.sql
```

## 4. API使用指南

### 4.1 创建广告账户

#### 请求示例

```bash
curl -X POST "http://localhost:8080/api/v1/adscentergo/accounts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "platform": "google-ads",
    "account_id": "123-456-7890",
    "account_name": "My Test Account",
    "email": "test@example.com",
    "currency": "USD",
    "timezone": "America/New_York",
    "access_token": "ya29.a0AfH6SM...",
    "refresh_token": "1//0abcdef...",
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "developer_token": "your-developer-token"
  }'
```

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "account-uuid",
    "user_id": "user-uuid",
    "platform": "google-ads",
    "account_id": "123-456-7890",
    "account_name": "My Test Account",
    "status": "pending",
    "is_active": false,
    "created_at": "2024-01-15T10:30:00Z",
    "config": {
      "auto_sync": true,
      "sync_interval": 60,
      "data_retention": 90
    }
  }
}
```

### 4.2 验证账户凭据

```bash
curl -X POST "http://localhost:8080/api/v1/adscentergo/accounts/{account_id}/validate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4.3 创建同步任务

```bash
curl -X POST "http://localhost:8080/api/v1/adscentergo/accounts/{account_id}/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "task_type": "full",
    "include_stats": true,
    "date_range": ["2024-01-01T00:00:00Z", "2024-01-31T23:59:59Z"]
  }'
```

### 4.4 获取账户统计数据

```bash
curl -X GET "http://localhost:8080/api/v1/adscentergo/accounts/{account_id}/stats?date_range=LAST_30_DAYS" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4.5 获取广告系列列表

```bash
curl -X GET "http://localhost:8080/api/v1/adscentergo/accounts/{account_id}/campaigns" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 5. OAuth 2.0 授权流程

### 5.1 获取授权URL

```bash
curl -X GET "http://localhost:8080/api/v1/adscentergo/oauth/url?redirect_uri=YOUR_REDIRECT_URI" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5.2 交换授权码

```bash
curl -X POST "http://localhost:8080/api/v1/adscentergo/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization-code",
    "redirect_uri": "YOUR_REDIRECT_URI",
    "client_id": "your-client-id",
    "client_secret": "your-client-secret"
  }'
```

## 6. 前端集成示例

### 6.1 React组件示例

```javascript
import { useState, useEffect } from 'react';

function GoogleAdsIntegration() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // 创建账户
  const createAccount = async (accountData) => {
    try {
      const response = await fetch('/api/v1/adscentergo/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(accountData),
      });
      
      const result = await response.json();
      if (result.code === 0) {
        // 账户创建成功
        setAccounts(prev => [...prev, result.data]);
      }
    } catch (error) {
      console.error('创建账户失败:', error);
    }
  };

  // 同步数据
  const syncAccount = async (accountId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/adscentergo/accounts/${accountId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          task_type: 'full',
          include_stats: true,
        }),
      });
      
      const result = await response.json();
      if (result.code === 0) {
        // 同步任务创建成功
        console.log('同步任务ID:', result.data.id);
      }
    } catch (error) {
      console.error('同步失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Google Ads账户管理</h2>
      {/* 账户列表 */}
      {accounts.map(account => (
        <div key={account.id}>
          <h3>{account.account_name}</h3>
          <p>状态: {account.status}</p>
          <button 
            onClick={() => syncAccount(account.id)}
            disabled={loading}
          >
            同步数据
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 6.2 OAuth授权组件

```javascript
function GoogleAdsOAuth() {
  const [authUrl, setAuthUrl] = useState('');

  // 获取授权URL
  useEffect(() => {
    const getAuthUrl = async () => {
      const response = await fetch('/api/v1/adscentergo/oauth/url', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const result = await response.json();
      if (result.code === 0) {
        setAuthUrl(result.data.auth_url);
      }
    };
    getAuthUrl();
  }, []);

  return (
    <div>
      <h2>连接Google Ads账户</h2>
      <a href={authUrl} target="_blank" rel="noopener noreferrer">
        授权Google Ads访问
      </a>
    </div>
  );
}
```

## 7. 错误处理

### 7.1 常见错误代码

| 错误代码 | 说明 | 解决方案 |
|---------|------|----------|
| 401 | 未授权 | 检查JWT令牌是否有效 |
| 403 | 权限不足 | 检查用户权限和Token余额 |
| 404 | 账户不存在 | 确认账户ID正确 |
| 422 | 验证失败 | 检查请求参数 |
| 500 | 服务器错误 | 查看服务器日志 |

### 7.2 Google Ads API错误

```json
{
  "code": 500,
  "message": "Google Ads API error: Quota exceeded"
}
```

## 8. 性能优化建议

### 8.1 缓存策略

- 启用Redis缓存减少API调用
- 合理设置同步间隔（建议最少1小时）
- 使用增量同步减少数据量

### 8.2 并发控制

- 同一账户同时只能有一个同步任务
- 根据API限制设置合理的并发数
- 实现任务队列避免资源竞争

### 8.3 数据同步

- 避免频繁的全量同步
- 使用时间戳同步增量数据
- 定期清理历史数据

## 9. 监控和日志

### 9.1 关键指标

- API调用成功率
- 同步任务完成时间
- Token消耗统计
- 错误率监控

### 9.2 日志级别

```bash
# 查看同步成功日志
grep "ads_sync_completed" runtime/log/*.log

# 查看同步失败日志
grep "ads_sync_failed" runtime/log/*.log

# 查看API调用日志
grep "googleads_api" runtime/log/*.log
```

## 10. 安全最佳实践

### 10.1 凭据管理

- 使用环境变量存储敏感信息
- 定期刷新访问令牌
- 实现凭据轮换机制

### 10.2 权限控制

- 严格限制API访问权限
- 实现细粒度的用户权限控制
- 记录所有敏感操作日志

### 10.3 数据保护

- 加密存储令牌信息
- 使用HTTPS传输数据
- 实现数据访问审计

## 11. 故障排除

### 11.1 连接问题

1. 检查网络连接
2. 验证API凭据
3. 确认防火墙设置

### 11.2 同步失败

1. 检查Google Ads API状态
2. 验证账户权限
3. 查看详细错误日志

### 11.3 性能问题

1. 优化数据库查询
2. 增加缓存层
3. 调整并发设置

## 12. 扩展功能

### 12.1 自动化任务

- 设置定时同步
- 实现告警通知
- 自动化报表生成

### 12.2 高级分析

- ROI分析
- 竞品分析
- 趋势预测

### 12.3 多平台支持

- Meta Ads集成
- TikTok Ads集成
- 微信广告集成

---

## 附录A：数据库表结构

```sql
-- 广告账户表
CREATE TABLE ads_accounts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  account_id VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  client_id VARCHAR(255),
  client_secret VARCHAR(255),
  developer_token VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  is_active BOOLEAN DEFAULT FALSE,
  last_sync_at DATETIME,
  total_spend DECIMAL(20,2) DEFAULT 0,
  campaign_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  INDEX idx_user_id (user_id),
  INDEX idx_platform (platform),
  INDEX idx_status (status)
);

-- 广告系列表
CREATE TABLE ads_campaigns (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  campaign_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  budget_type VARCHAR(50),
  budget_amount DECIMAL(20,2),
  start_date DATE,
  end_date DATE,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(20,2) DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  ctr DECIMAL(10,4) DEFAULT 0,
  cpc DECIMAL(20,2) DEFAULT 0,
  cpa DECIMAL(20,2) DEFAULT 0,
  last_sync_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_id (account_id),
  INDEX idx_campaign_id (campaign_id)
);

-- 广告组表
CREATE TABLE ads_adgroups (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  ad_group_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  type VARCHAR(50),
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(20,2) DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_id (account_id)
);

-- 广告表
CREATE TABLE ads_ads (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  ad_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  type VARCHAR(50),
  headlines TEXT,
  descriptions TEXT,
  final_url VARCHAR(1000),
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(20,2) DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_id (account_id)
);

-- 关键词表
CREATE TABLE ads_keywords (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  keyword_id VARCHAR(100) NOT NULL,
  text VARCHAR(255) NOT NULL,
  match_type VARCHAR(20),
  status VARCHAR(50),
  max_cpc DECIMAL(20,2) DEFAULT 0,
  quality_score INT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(20,2) DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_id (account_id)
);

-- 同步任务表
CREATE TABLE ads_sync_tasks (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  task_type VARCHAR(20) DEFAULT 'full',
  date_range TEXT,
  include_stats BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'pending',
  progress INT DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME,
  duration BIGINT COMMENT '执行时长(毫秒)',
  records_synced INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_code VARCHAR(50),
  error_message TEXT,
  token_cost INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_id (account_id),
  INDEX idx_status (status)
);
```

## 附录B：依赖包

```go
// Google Ads API
require (
    google.golang.org/api/ads/v15 v15.0.0
    google.golang.org/api/option v0.0.0
    golang.org/x/oauth2 v0.15.0
)
```

---

通过本手册，您可以成功集成Google Ads API到您的应用程序中。如有任何问题，请参考故障排除部分或联系技术支持。