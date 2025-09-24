# 上瘾式广告管理系统设计文档

## 概述

本设计文档基于需求文档中的18个核心需求，提供了完整的技术架构、组件设计、数据模型和实现方案。系统采用微服务架构，充分利用Google Cloud Platform的技术栈，实现高性能、可扩展的广告管理平台。

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Frontend)                        │
│                    Next.js + Firebase Hosting                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                      API网关层 (API Gateway)                    │
│                   Google Cloud API Gateway                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                     业务逻辑层 (Business Logic)                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │Offer管理服务│ │评估分析服务 │ │批量操作服务 │ │URL解析服务  ││
│  │             │ │             │ │             │ │(常驻服务)   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
│                        Google Cloud Run                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                     定时任务层 (Scheduled Tasks)                │
│  Cloud Scheduler → Pub/Sub → Cloud Functions → Cloud Run       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                      数据存储层 (Data Storage)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  Firestore  │ │ Cloud SQL   │ │Cloud Storage│ │Secret Mgr   ││
│  │配置/状态/缓存│ │历史/分析数据│ │文件/日志存储│ │密钥管理     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                     外部集成层 (External APIs)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │Google Ads   │ │SimilarWeb   │ │Firebase AI  │ │代理IP服务   ││
│  │    API      │ │    API      │ │   Logic     │ │             ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```## 
核心组件设计

### 1. Offer管理服务 (Offer Management Service)

**职责：** 管理Offer的完整生命周期，包括状态流转、数据存储、权限控制

**技术栈：** Go + Cloud Run + Firestore

**核心功能：**
- Offer CRUD操作
- 状态流转管理（机会池→评估中→仿真中→放大中→衰退期→归档）
- 批量录入和权限验证
- ROSC计算和历史记录

**API设计：**
```go
// Offer管理API
POST   /api/v1/offers                    // 创建Offer
GET    /api/v1/offers                    // 获取Offer列表
GET    /api/v1/offers/{id}               // 获取Offer详情
PUT    /api/v1/offers/{id}               // 更新Offer
DELETE /api/v1/offers/{id}               // 删除Offer
PUT    /api/v1/offers/{id}/status        // 更新Offer状态
POST   /api/v1/offers/batch              // 批量录入Offer
GET    /api/v1/offers/{id}/history       // 获取Offer历史记录
```

### 2. 智能评估分析服务 (Evaluation & Analysis Service)

**职责：** 提供Offer评估、市场分析、机会发现等智能分析功能

**技术栈：** Go + Cloud Run + Firebase AI Logic + SimilarWeb API

**核心功能：**
- URL解析和落地页分析
- 流量数据获取和分析
- 季节性波动分析
- 0-100分评分算法
- 相似机会发现

**API设计：**
```go
// 评估分析API
POST   /api/v1/evaluation/analyze        // 分析Offer URL
GET    /api/v1/evaluation/{id}/score     // 获取评估评分
POST   /api/v1/evaluation/similar        // 发现相似机会
GET    /api/v1/evaluation/market-trends  // 获取市场趋势
POST   /api/v1/evaluation/batch-analyze  // 批量分析
```

### 3. 批量操作服务 (Bulk Operations Service)

**职责：** 处理多账户批量操作，包括换链接、A/B测试、CPC调整等

**技术栈：** Go + Cloud Run + Google Ads API

**核心功能：**
- 以Offer为中心的批量操作界面
- 自动关联Offer下的所有Google Ads账户和广告组
- 智能筛选和操作预览
- 换链接定时任务
- A/B测试管理
- 操作历史和撤销

**API设计：**
```go
// 批量操作API
POST   /api/v1/bulk/operations           // 执行批量操作
GET    /api/v1/bulk/operations/{id}      // 获取操作状态
POST   /api/v1/bulk/preview              // 操作预览
POST   /api/v1/bulk/rollback/{id}        // 回滚操作
POST   /api/v1/bulk/link-rotation        // 配置换链接
GET    /api/v1/bulk/ab-tests             // 获取A/B测试列表
POST   /api/v1/bulk/ab-tests             // 创建A/B测试
```

### 4. URL解析服务 (URL Parsing Service) - 常驻服务

**职责：** 提供高性能的URL解析能力，处理多重重定向和反检测

**技术栈：** Go + Cloud Run (常驻) + Playwright + 代理IP池

**架构特点：**
- 常驻服务，维持最小1个实例
- 浏览器实例池管理
- 智能代理IP轮换
- 批量处理支持

**核心功能：**
- 多重重定向解析
- Final URL和suffix提取
- 智能代理IP复用策略
- 反检测策略
- 地域化配置（时区、语言、User-Agent）
- 批量解析优化

**API设计：**
```go
// URL解析API
POST   /api/v1/url-parser/parse          // 解析单个URL
POST   /api/v1/url-parser/batch-parse    // 批量解析URL
GET    /api/v1/url-parser/health         // 服务健康检查
POST   /api/v1/url-parser/proxy/rotate   // 轮换代理IP
GET    /api/v1/url-parser/stats          // 获取解析统计
```

**实例池管理：**
```go
type BrowserPool struct {
    browsers    []*playwright.Browser
    maxSize     int
    currentSize int
    mutex       sync.RWMutex
}

func (p *BrowserPool) GetBrowser() *playwright.Browser
func (p *BrowserPool) ReleaseBrowser(browser *playwright.Browser)
func (p *BrowserPool) HealthCheck() error

// 智能代理IP管理
type ProxyManager struct {
    countryPools map[string]*CountryProxyPool
    timeWindow   time.Duration // 5分钟复用窗口
}

type CountryProxyPool struct {
    currentIP    string
    usedByOffers map[string]bool // 记录已使用此IP的Offer URL
    lastRotation time.Time
    apiURL       string // 该国家的代理IP API URL
}

func (pm *ProxyManager) GetProxyForOffer(country, offerURL string) string
func (pm *ProxyManager) ConfigureCountryAPI(country, apiURL string) error
```

### 5. AI预警与优化服务 (AI Alert & Optimization Service)

**职责：** 提供智能预警、风险识别、优化建议等AI驱动功能

**技术栈：** Go + Cloud Run + Firebase AI Logic + 规则引擎

**核心功能：**
- 实时数据监控和自动状态转换（连续5天0曝光0点击→衰退期）
- 风险识别和预警
- Firebase AI Logic多场景应用：内容分析、优化建议、合规检查
- 效果跟踪反馈
- 规则引擎管理

**API设计：**
```go
// AI预警优化API
GET    /api/v1/ai/alerts                 // 获取预警列表
POST   /api/v1/ai/alerts/acknowledge     // 确认预警
GET    /api/v1/ai/suggestions            // 获取优化建议
POST   /api/v1/ai/suggestions/apply      // 应用建议
GET    /api/v1/ai/insights               // 获取AI洞察
POST   /api/v1/ai/rules                  // 配置预警规则
POST   /api/v1/ai/analyze-content        // Firebase AI内容分析
POST   /api/v1/ai/compliance-check       // Firebase AI合规检查
POST   /api/v1/ai/generate-suggestions   // Firebase AI优化建议
```

### 6. 数据同步服务 (Data Sync Service)

**职责：** 管理与Google Ads API的数据同步，提供全局数据视图

**技术栈：** Go + Cloud Run + Google Ads API + Cloud SQL

**核心功能：**
- 增量数据同步
- 多账户数据聚合
- 趋势数据计算
- API限制管理
- 数据质量监控

**API设计：**
```go
// 数据同步API
POST   /api/v1/sync/trigger              // 触发同步
GET    /api/v1/sync/status               // 获取同步状态
GET    /api/v1/sync/dashboard            // 获取仪表盘数据
GET    /api/v1/sync/trends               // 获取趋势数据
POST   /api/v1/sync/accounts/connect     // 连接Google Ads账户
```

### 7. 后台管理服务 (Admin Management Service)

**职责：** 提供完整的后台管理功能，包括仪表盘、用户管理、套餐管理、Token管理、动态配置

**技术栈：** Go + Cloud Run + Firestore + Cloud SQL

**核心功能：**
- 实时仪表盘数据聚合
- 用户生命周期管理
- 套餐和权限配置
- Token消耗监控和管理
- 动态配置热更新

**API设计：**
```go
// 仪表盘API
GET    /api/v1/admin/dashboard/stats     // 获取统计数据
GET    /api/v1/admin/dashboard/revenue   // 获取收入统计
GET    /api/v1/admin/dashboard/health    // 获取系统健康状态
GET    /api/v1/admin/dashboard/activity  // 获取用户活跃度

// 用户管理API
GET    /api/v1/admin/users               // 获取用户列表
GET    /api/v1/admin/users/{id}          // 获取用户详情
PUT    /api/v1/admin/users/{id}/status   // 更新用户状态
PUT    /api/v1/admin/users/{id}/plan     // 变更用户套餐
POST   /api/v1/admin/users/{id}/tokens   // 充值Token
GET    /api/v1/admin/users/{id}/logs     // 获取用户操作日志

// 套餐管理API
GET    /api/v1/admin/plans               // 获取套餐列表
POST   /api/v1/admin/plans               // 创建套餐
PUT    /api/v1/admin/plans/{id}          // 更新套餐
DELETE /api/v1/admin/plans/{id}          // 删除套餐
GET    /api/v1/admin/plans/{id}/users    // 获取套餐用户

// Token管理API
GET    /api/v1/admin/tokens/stats        // 获取Token统计
GET    /api/v1/admin/tokens/consumption  // 获取消耗规则
PUT    /api/v1/admin/tokens/rules        // 更新消耗规则
POST   /api/v1/admin/tokens/bulk-recharge // 批量充值
GET    /api/v1/admin/tokens/alerts       // 获取异常预警

// 动态配置API
GET    /api/v1/admin/configs             // 获取所有配置
GET    /api/v1/admin/configs/{section}   // 获取特定配置
PUT    /api/v1/admin/configs/{section}   // 更新配置
GET    /api/v1/admin/configs/history     // 获取配置历史
POST   /api/v1/admin/configs/rollback    // 回滚配置

// API监控管理API
GET    /api/v1/admin/api-monitor/stats   // 获取API调用统计
GET    /api/v1/admin/api-monitor/quota   // 获取配额使用情况
PUT    /api/v1/admin/api-monitor/limits  // 设置调用限制
GET    /api/v1/admin/api-monitor/alerts  // 获取API预警

// 点击优化分析API
GET    /api/v1/admin/click-analysis/stats // 获取点击分析统计
POST   /api/v1/admin/click-analysis/optimize // 执行AI优化分析
PUT    /api/v1/admin/click-analysis/strategy // 更新点击策略
POST   /api/v1/admin/click-analysis/deploy   // 部署优化策略到URL解析服务
```## 
数据模型设计

### Firestore 数据结构

#### 1. 用户相关集合

```javascript
// /users/{userId}
{
  profile: {
    email: string,
    displayName: string,
    createdAt: timestamp,
    lastLoginAt: timestamp
  },
  subscription: {
    plan: "Pro" | "Max" | "Elite",
    status: "active" | "expired" | "suspended",
    expiresAt: timestamp,
    tokensRemaining: number,
    features: string[]
  },
  settings: {
    defaultCountry: string,
    timezone: string,
    notifications: {
      email: boolean,
      push: boolean,
      alerts: boolean
    },
    ui: {
      theme: "light" | "dark",
      language: string,
      dashboardLayout: object
    }
  }
}

// /users/{userId}/notifications/{notificationId}
{
  type: "alert" | "suggestion" | "info",
  title: string,
  message: string,
  data: object,
  read: boolean,
  createdAt: timestamp,
  expiresAt: timestamp
}
```

#### 2. Offer相关集合

```javascript
// /offers/{offerId}
{
  basic: {
    url: string,
    finalUrl: string,
    finalUrlSuffix: string,
    country: string,
    status: "pool" | "evaluating" | "simulating" | "scaling" | "declining" | "archived",
    createdAt: timestamp,
    updatedAt: timestamp,
    userId: string
  },
  evaluation: {
    score: number, // 0-100
    dimensions: {
      trafficPotential: number,
      keywordRelevance: number,
      cpcCost: number,
      complianceRisk: number,
      seasonalOpportunity: number
    },
    analysis: {
      industry: string,
      productType: string,
      targetAudience: string,
      estimatedCpc: number,
      trafficVolume: number,
      competitionLevel: string
    },
    evaluatedAt: timestamp
  },
  simulation: {
    config: {
      dailyClicks: number,
      model: "workday" | "weekend" | "holiday" | "custom",
      customCurve: number[],
      referers: string[]
    },
    status: "running" | "paused" | "completed",
    progress: {
      totalClicks: number,
      successfulClicks: number,
      failedClicks: number,
      successRate: number
    },
    startedAt: timestamp,
    estimatedCompletionAt: timestamp
  },
  performance: {
    rosc: number,
    totalSpend: number,
    totalRevenue: number,
    impressions: number,
    clicks: number,
    ctr: number,
    avgCpc: number,
    qualityScore: number,
    lastUpdatedAt: timestamp
  }
}

// /offers/{offerId}/history/{historyId}
{
  action: "created" | "status_changed" | "evaluation_completed" | "simulation_started",
  fromStatus: string,
  toStatus: string,
  data: object,
  userId: string,
  timestamp: timestamp
}
```

#### 3. 系统配置集合

```javascript
// /configs/evaluation_standards
{
  scoring: {
    trafficPotential: {
      weights: object,
      thresholds: object
    },
    keywordRelevance: {
      weights: object,
      thresholds: object
    },
    // ... 其他维度配置
  },
  updatedAt: timestamp,
  updatedBy: string
}

// /configs/risk_rules
{
  rules: [
    {
      id: string,
      name: string,
      condition: string, // 规则表达式
      severity: "low" | "medium" | "high" | "critical",
      action: "alert" | "pause" | "stop",
      enabled: boolean
    }
  ],
  updatedAt: timestamp
}

// /configs/proxy_settings
{
  countryAPIs: {
    "US": "https://api.proxy-provider.com/us",
    "UK": "https://api.proxy-provider.com/uk",
    "CA": "https://api.proxy-provider.com/ca"
  },
  reuseWindow: 300, // 5分钟复用窗口
  providers: [
    {
      name: string,
      apiUrl: string,
      countries: string[],
      enabled: boolean,
      rateLimit: number
    }
  ],
  rotation: {
    strategy: "smart_reuse" | "round_robin" | "random",
    interval: number
  }
}
```

### Cloud SQL 数据结构

#### 1. 历史数据表

```sql
-- 广告账户表
CREATE TABLE ads_accounts (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status ENUM('active', 'suspended', 'cancelled') DEFAULT 'active',
    oauth_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id)
);

-- 广告数据历史表
CREATE TABLE ads_performance_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    offer_id VARCHAR(50) NOT NULL,
    account_id VARCHAR(50) NOT NULL,
    campaign_id VARCHAR(50),
    ad_group_id VARCHAR(50),
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    cost_micros BIGINT DEFAULT 0,
    conversions DECIMAL(10,2) DEFAULT 0,
    conversion_value_micros BIGINT DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,
    avg_cpc_micros BIGINT DEFAULT 0,
    quality_score DECIMAL(3,1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_performance (offer_id, account_id, campaign_id, ad_group_id, date),
    INDEX idx_offer_date (offer_id, date),
    INDEX idx_account_date (account_id, date)
);

-- 操作审计日志表
CREATE TABLE operation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    operation_type ENUM('bulk_update', 'link_rotation', 'ab_test', 'manual_update') NOT NULL,
    target_type ENUM('campaign', 'ad_group', 'ad', 'keyword') NOT NULL,
    target_ids JSON NOT NULL,
    operation_data JSON NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'rolled_back') DEFAULT 'pending',
    affected_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_status (status)
);

-- 财务记录表
CREATE TABLE financial_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    offer_id VARCHAR(50) NOT NULL,
    record_type ENUM('revenue', 'cost', 'adjustment') NOT NULL,
    amount_micros BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL,
    description TEXT,
    reference_id VARCHAR(100),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_offer (user_id, offer_id),
    INDEX idx_recorded_at (recorded_at)
);
```

#### 2. 分析数据表

```sql
-- Offer性能汇总表
CREATE TABLE offer_performance_summary (
    offer_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    total_spend_micros BIGINT DEFAULT 0,
    total_revenue_micros BIGINT DEFAULT 0,
    total_impressions BIGINT DEFAULT 0,
    total_clicks BIGINT DEFAULT 0,
    avg_ctr DECIMAL(5,4) DEFAULT 0,
    avg_cpc_micros BIGINT DEFAULT 0,
    rosc DECIMAL(8,4) DEFAULT 0,
    connected_accounts_count INT DEFAULT 0,
    first_activity_date DATE,
    last_activity_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_rosc (user_id, rosc),
    INDEX idx_last_activity (last_activity_date)
);

-- 市场趋势数据表
CREATE TABLE market_trends (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    industry VARCHAR(100) NOT NULL,
    country VARCHAR(2) NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    period_type ENUM('daily', 'weekly', 'monthly') NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_trend (industry, country, metric_name, period_start),
    INDEX idx_industry_country (industry, country),
    INDEX idx_period (period_start, period_end)
);
```

## 定时任务架构设计

### 定时任务流程图

```
Cloud Scheduler (定时触发)
    ↓
Pub/Sub Topics (消息分发)
    ↓
Cloud Functions (任务执行器)
    ↓
Cloud Run Services (业务处理)
```

### 1. 补点击任务流程

```yaml
# Cloud Scheduler Job: click-simulation-scheduler
schedule: "*/5 * * * *"  # 每5分钟检查一次
target:
  pubsub_target:
    topic_name: "click-simulation-topic"
    data: |
      {
        "action": "check_pending_simulations",
        "timestamp": "{{.timestamp}}"
      }
```

```go
// Cloud Function: click-simulation-handler
func HandleClickSimulation(ctx context.Context, m PubSubMessage) error {
    // 1. 查询需要执行的补点击任务
    tasks := getActiveTasks()
    
    // 2. 为每个任务调用URL解析服务
    for _, task := range tasks {
        go processClickTask(task)
    }
    
    return nil
}

func processClickTask(task ClickTask) {
    // 调用URL解析服务执行点击
    response := callURLParserService(task.OfferURL, task.Config)
    
    // 更新任务状态
    updateTaskProgress(task.ID, response)
}
```

### 2. 换链接任务流程

```yaml
# Cloud Scheduler Job: link-rotation-scheduler
schedule: "0 */1 * * *"  # 每小时检查一次
target:
  pubsub_target:
    topic_name: "link-rotation-topic"
    data: |
      {
        "action": "check_rotation_schedule",
        "timestamp": "{{.timestamp}}"
      }
```

```go
// Cloud Function: link-rotation-handler
func HandleLinkRotation(ctx context.Context, m PubSubMessage) error {
    // 1. 查询需要换链接的任务
    rotationTasks := getScheduledRotations()
    
    // 2. 处理每个换链接任务
    for _, task := range rotationTasks {
        go processLinkRotation(task)
    }
    
    return nil
}

func processLinkRotation(task LinkRotationTask) {
    // 1. 解析新的URL获取suffix
    newSuffix := parseOfferURL(task.OfferURL)
    
    // 2. 批量更新Google Ads
    updateAdGroupSuffixes(task.AdGroupIDs, newSuffix)
    
    // 3. 记录操作历史
    logRotationOperation(task, newSuffix)
}
```

### 3. 数据同步任务流程

```yaml
# Cloud Scheduler Job: data-sync-scheduler
schedule: "0 * * * *"  # 每小时同步一次
target:
  pubsub_target:
    topic_name: "ads-sync-topic"
    data: |
      {
        "action": "sync_ads_data",
        "timestamp": "{{.timestamp}}"
      }
```

```go
// Cloud Function: data-sync-handler
func HandleDataSync(ctx context.Context, m PubSubMessage) error {
    // 1. 获取所有活跃账户
    accounts := getActiveAdsAccounts()
    
    // 2. 并发同步数据
    var wg sync.WaitGroup
    for _, account := range accounts {
        wg.Add(1)
        go func(acc AdsAccount) {
            defer wg.Done()
            syncAccountData(acc)
        }(account)
    }
    wg.Wait()
    
    return nil
}

func syncAccountData(account AdsAccount) {
    // 1. 调用Google Ads API获取数据
    data := fetchAdsData(account)
    
    // 2. 存储到Cloud SQL
    storePerformanceData(data)
    
    // 3. 更新Firestore中的实时数据
    updateRealtimeMetrics(account.ID, data)
    
    // 4. 检查自动状态转换条件
    checkAutoStatusTransition(account.UserID, data)
}

func checkAutoStatusTransition(userID string, performanceData []*PerformanceData) {
    offers := getActiveOffers(userID)
    
    for _, offer := range offers {
        // 检查连续5天0曝光0点击
        if hasZeroPerformanceFor5Days(offer.ID, performanceData) {
            updateOfferStatus(offer.ID, "declining")
            sendStatusChangeNotification(userID, offer.ID, "自动转入衰退期：连续5天无曝光无点击")
        }
        
        // 检查ROSC连续下滑
        if hasROSCDeclineFor7Days(offer.ID, performanceData) {
            updateOfferStatus(offer.ID, "declining")
            sendStatusChangeNotification(userID, offer.ID, "自动转入衰退期：ROSC连续下滑")
        }
    }
}
```

## 前端架构设计

### 前端技术栈架构

#### 用户前端 (User Frontend)
- **框架：** Next.js 14 (App Router)
- **状态管理：** Zustand + React Query
- **UI组件：** Tailwind CSS + Headless UI
- **图表库：** Recharts
- **拖拽交互：** @dnd-kit/core
- **动画：** Framer Motion
- **实时通信：** Firebase SDK (Firestore实时监听)
- **部署：** Firebase Hosting

#### 后台管理 (Admin Backend)
- **框架：** Next.js 14 (App Router)
- **状态管理：** Zustand + React Query
- **UI组件：** Ant Design 5.x
- **图表库：** ECharts
- **表格组件：** Ant Design Table
- **表单组件：** Ant Design Form
- **布局：** Ant Design Pro Layout
- **部署：** Firebase Hosting (独立子域名)

### 页面结构设计

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证相关页面
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # 主要业务页面
│   │   ├── offers/               # Offer管理
│   │   │   ├── page.tsx          # Offer指挥中心
│   │   │   ├── [id]/             # Offer详情
│   │   │   └── evaluation/       # 评估页面
│   │   ├── dashboard/            # 全局仪表盘
│   │   ├── operations/           # 批量操作
│   │   ├── insights/             # AI洞察
│   │   └── settings/             # 设置页面
│   └── api/                      # API Routes (代理)
├── components/                   # 可复用组件
│   ├── ui/                       # 基础UI组件
│   ├── charts/                   # 图表组件
│   ├── forms/                    # 表单组件
│   └── layout/                   # 布局组件
├── hooks/                        # 自定义Hooks
├── stores/                       # Zustand状态管理
├── lib/                          # 工具函数
└── types/                        # TypeScript类型定义
```

### 核心组件设计

#### 1. Offer指挥中心组件

```tsx
// components/offers/OfferCommandCenter.tsx
interface OfferCommandCenterProps {
  userId: string;
}

export function OfferCommandCenter({ userId }: OfferCommandCenterProps) {
  const { offers, updateOfferStatus } = useOffers(userId);
  const { subscription } = useSubscription(userId);
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      updateOfferStatus(active.id as string, over.id as OfferStatus);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-6 gap-4">
        {OFFER_STAGES.map(stage => (
          <OfferStageColumn
            key={stage}
            stage={stage}
            offers={offers.filter(o => o.status === stage)}
            canDrop={subscription.plan !== 'Pro' || stage !== 'scaling'}
          />
        ))}
      </div>
    </DndContext>
  );
}
```

#### 2. 智能评估组件

```tsx
// components/evaluation/OfferEvaluator.tsx
interface OfferEvaluatorProps {
  onEvaluationComplete: (result: EvaluationResult) => void;
}

export function OfferEvaluator({ onEvaluationComplete }: OfferEvaluatorProps) {
  const [url, setUrl] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setProgress(0);

    try {
      // 实时进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 1000);

      const result = await evaluateOffer(url);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // 成功音效和动画
      if (result.score > 80) {
        playSuccessSound();
        showSuccessAnimation();
      }
      
      onEvaluationComplete(result);
    } catch (error) {
      handleEvaluationError(error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="evaluation-container">
      <URLInput 
        value={url} 
        onChange={setUrl}
        disabled={isEvaluating}
      />
      
      {isEvaluating && (
        <ProgressBar 
          progress={progress}
          message="正在分析Offer价值..."
        />
      )}
      
      <EvaluateButton 
        onClick={handleEvaluate}
        disabled={!url || isEvaluating}
      />
    </div>
  );
}
```

#### 3. 批量操作矩阵组件

```tsx
// components/operations/BulkOperationsMatrix.tsx
export function BulkOperationsMatrix() {
  const { campaigns, selectedCampaigns, setSelectedCampaigns } = useCampaigns();
  const { filters, setFilters } = useFilters();
  const [operation, setOperation] = useState<BulkOperation | null>(null);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      return applyFilters(campaign, filters);
    });
  }, [campaigns, filters]);

  const handleBulkOperation = async (op: BulkOperation) => {
    const preview = await previewBulkOperation(selectedCampaigns, op);
    
    if (await confirmOperation(preview)) {
      const result = await executeBulkOperation(selectedCampaigns, op);
      showOperationResult(result);
    }
  };

  return (
    <div className="bulk-operations-matrix">
      <FilterPanel 
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      <DataGrid
        data={filteredCampaigns}
        selectedRows={selectedCampaigns}
        onSelectionChange={setSelectedCampaigns}
        columns={CAMPAIGN_COLUMNS}
      />
      
      <OperationPanel
        selectedCount={selectedCampaigns.length}
        onOperation={handleBulkOperation}
      />
    </div>
  );
}
```

### 状态管理设计

#### 1. Offer状态管理

```typescript
// stores/offerStore.ts
interface OfferState {
  offers: Offer[];
  selectedOffer: Offer | null;
  loading: boolean;
  error: string | null;
}

interface OfferActions {
  fetchOffers: (userId: string) => Promise<void>;
  createOffer: (offer: CreateOfferRequest) => Promise<void>;
  updateOfferStatus: (offerId: string, status: OfferStatus) => Promise<void>;
  deleteOffer: (offerId: string) => Promise<void>;
  selectOffer: (offer: Offer) => void;
  clearError: () => void;
}

export const useOfferStore = create<OfferState & OfferActions>((set, get) => ({
  offers: [],
  selectedOffer: null,
  loading: false,
  error: null,

  fetchOffers: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const offers = await offerService.getOffers(userId);
      set({ offers, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  updateOfferStatus: async (offerId: string, status: OfferStatus) => {
    try {
      await offerService.updateStatus(offerId, status);
      
      // 乐观更新
      set(state => ({
        offers: state.offers.map(offer =>
          offer.id === offerId ? { ...offer, status } : offer
        )
      }));
      
      // 触发状态变更动画
      triggerStatusChangeAnimation(offerId, status);
    } catch (error) {
      set({ error: error.message });
    }
  },

  // ... 其他actions
}));
```

#### 2. 实时数据同步

```typescript
// hooks/useRealtimeOffers.ts
export function useRealtimeOffers(userId: string) {
  const { offers, setOffers } = useOfferStore();
  
  useEffect(() => {
    // Firestore实时监听
    const unsubscribe = onSnapshot(
      collection(db, 'offers').where('userId', '==', userId),
      (snapshot) => {
        const updatedOffers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Offer[];
        
        setOffers(updatedOffers);
        
        // 检查状态变更并触发动画
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const offer = change.doc.data() as Offer;
            triggerOfferUpdateAnimation(offer.id);
          }
        });
      }
    );
    
    return unsubscribe;
  }, [userId]);
  
  return offers;
}
```

### 上瘾体验实现

#### 1. 即时反馈系统

```typescript
// lib/feedback.ts
export class FeedbackSystem {
  static showSuccess(message: string, data?: any) {
    // 成功动画
    toast.success(message, {
      icon: '🎉',
      duration: 3000,
      style: {
        background: '#10B981',
        color: 'white',
      }
    });
    
    // 成功音效
    if (data?.playSound) {
      playSound('/sounds/success.mp3');
    }
    
    // 粒子效果
    if (data?.showParticles) {
      triggerParticleEffect();
    }
  }
  
  static showProgress(progress: number, message: string) {
    // 进度条动画
    updateProgressBar(progress, message);
    
    // 阶段性反馈
    if (progress === 25) {
      showMilestone('URL解析完成');
    } else if (progress === 50) {
      showMilestone('数据分析中');
    } else if (progress === 75) {
      showMilestone('生成评分');
    }
  }
}
```

#### 2. 拖拽交互实现

```typescript
// components/offers/DraggableOfferCard.tsx
export function DraggableOfferCard({ offer }: { offer: Offer }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useDraggable({
    id: offer.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`offer-card ${getStatusColor(offer.status)} ${
        isDragging ? 'dragging' : ''
      }`}
    >
      <OfferCardContent offer={offer} />
      
      {/* 拖拽时的视觉反馈 */}
      {isDragging && (
        <div className="drag-overlay">
          <ArrowIcon className="animate-bounce" />
        </div>
      )}
    </div>
  );
}
```

#### 3. 数据可视化组件

```typescript
// components/charts/ROSCTrendChart.tsx
export function ROSCTrendChart({ data }: { data: TrendData[] }) {
  const chartRef = useRef<Chart | null>(null);
  
  useEffect(() => {
    // 动画配置
    const config = {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [{
          label: 'ROSC',
          data: data.map(d => d.rosc),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8,
        }]
      },
      options: {
        responsive: true,
        animation: {
          duration: 2000,
          easing: 'easeInOutQuart'
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                const color = value > 2 ? '🟢' : value > 1 ? '🟡' : '🔴';
                return `${color} ROSC: ${value.toFixed(2)}`;
              }
            }
          }
        }
      }
    };
    
    chartRef.current = new Chart(canvasRef.current, config);
    
    return () => chartRef.current?.destroy();
  }, [data]);
  
  return <canvas ref={canvasRef} />;
}
```

## 安全性设计

### 1. 认证与授权

```typescript
// lib/auth.ts
export class AuthService {
  // Firebase Authentication集成
  static async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // 创建用户会话
    await this.createUserSession(result.user);
    
    return result.user;
  }
  
  // JWT Token验证
  static async verifyToken(token: string): Promise<DecodedToken> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      throw new AuthError('Invalid token');
    }
  }
  
  // 权限检查
  static async checkPermission(userId: string, action: string): Promise<boolean> {
    const user = await getUserSubscription(userId);
    return hasPermission(user.plan, action);
  }
}

// middleware/auth.ts
export async function authMiddleware(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const decodedToken = await AuthService.verifyToken(token);
    req.user = decodedToken;
    return NextResponse.next();
  } catch (error) {
    return new Response('Invalid token', { status: 401 });
  }
}
```

### 2. 数据加密

```go
// internal/security/encryption.go
package security

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "io"
)

type EncryptionService struct {
    gcm cipher.AEAD
}

func NewEncryptionService(key []byte) (*EncryptionService, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    return &EncryptionService{gcm: gcm}, nil
}

func (e *EncryptionService) Encrypt(plaintext string) (string, error) {
    nonce := make([]byte, e.gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    ciphertext := e.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (e *EncryptionService) Decrypt(ciphertext string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }
    
    nonceSize := e.gcm.NonceSize()
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    
    plaintext, err := e.gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    
    return string(plaintext), nil
}
```

### 3. API安全

```go
// internal/middleware/security.go
func SecurityMiddleware() gin.HandlerFunc {
    return gin.HandlerFunc(func(c *gin.Context) {
        // CORS设置
        c.Header("Access-Control-Allow-Origin", getAllowedOrigins())
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        // 安全头设置
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        
        // 限流
        if !rateLimiter.Allow(c.ClientIP()) {
            c.JSON(429, gin.H{"error": "Rate limit exceeded"})
            c.Abort()
            return
        }
        
        c.Next()
    })
}

// API密钥验证
func APIKeyMiddleware() gin.HandlerFunc {
    return gin.HandlerFunc(func(c *gin.Context) {
        apiKey := c.GetHeader("X-API-Key")
        if apiKey == "" {
            c.JSON(401, gin.H{"error": "API key required"})
            c.Abort()
            return
        }
        
        if !validateAPIKey(apiKey) {
            c.JSON(401, gin.H{"error": "Invalid API key"})
            c.Abort()
            return
        }
        
        c.Next()
    })
}
```

## 性能优化设计

### 1. 缓存策略

```go
// internal/cache/redis.go
type CacheService struct {
    client *redis.Client
}

func (c *CacheService) GetOfferEvaluation(url string) (*EvaluationResult, error) {
    key := fmt.Sprintf("evaluation:%s", hashURL(url))
    
    cached, err := c.client.Get(context.Background(), key).Result()
    if err == redis.Nil {
        return nil, nil // 缓存未命中
    } else if err != nil {
        return nil, err
    }
    
    var result EvaluationResult
    if err := json.Unmarshal([]byte(cached), &result); err != nil {
        return nil, err
    }
    
    return &result, nil
}

func (c *CacheService) SetOfferEvaluation(url string, result *EvaluationResult, ttl time.Duration) error {
    key := fmt.Sprintf("evaluation:%s", hashURL(url))
    
    data, err := json.Marshal(result)
    if err != nil {
        return err
    }
    
    return c.client.Set(context.Background(), key, data, ttl).Err()
}
```

### 2. 数据库优化

```sql
-- 索引优化
CREATE INDEX idx_offers_user_status ON offers(user_id, status);
CREATE INDEX idx_performance_offer_date ON ads_performance_history(offer_id, date DESC);
CREATE INDEX idx_logs_user_created ON operation_logs(user_id, created_at DESC);

-- 分区表（按月分区）
CREATE TABLE ads_performance_history_202401 PARTITION OF ads_performance_history
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- 查询优化
EXPLAIN ANALYZE 
SELECT offer_id, SUM(cost_micros) as total_cost, SUM(conversions) as total_conversions
FROM ads_performance_history 
WHERE date >= '2024-01-01' AND date < '2024-02-01'
GROUP BY offer_id;
```

### 3. 前端性能优化

```typescript
// 代码分割和懒加载
const OfferEvaluator = lazy(() => import('../components/evaluation/OfferEvaluator'));
const BulkOperations = lazy(() => import('../components/operations/BulkOperations'));

// 虚拟滚动（大数据列表）
import { FixedSizeList as List } from 'react-window';

function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <CampaignRow campaign={campaigns[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={campaigns.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}

// 数据预加载
function useOfferPreloader() {
  const queryClient = useQueryClient();
  
  const preloadOffer = useCallback((offerId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['offer', offerId],
      queryFn: () => offerService.getOffer(offerId),
      staleTime: 5 * 60 * 1000, // 5分钟
    });
  }, [queryClient]);
  
  return { preloadOffer };
}
```

## 错误处理与监控

### 1. 错误处理策略

```go
// internal/errors/errors.go
type AppError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
    TraceID string `json:"trace_id"`
}

func (e *AppError) Error() string {
    return fmt.Sprintf("[%s] %s: %s", e.Code, e.Message, e.Details)
}

// 错误类型定义
var (
    ErrOfferNotFound     = &AppError{Code: "OFFER_NOT_FOUND", Message: "Offer not found"}
    ErrInvalidURL        = &AppError{Code: "INVALID_URL", Message: "Invalid offer URL"}
    ErrEvaluationFailed  = &AppError{Code: "EVALUATION_FAILED", Message: "Offer evaluation failed"}
    ErrInsufficientPerm  = &AppError{Code: "INSUFFICIENT_PERMISSION", Message: "Insufficient permission"}
    ErrRateLimitExceeded = &AppError{Code: "RATE_LIMIT_EXCEEDED", Message: "Rate limit exceeded"}
)

// 错误处理中间件
func ErrorHandlerMiddleware() gin.HandlerFunc {
    return gin.HandlerFunc(func(c *gin.Context) {
        c.Next()
        
        if len(c.Errors) > 0 {
            err := c.Errors.Last().Err
            
            var appErr *AppError
            if errors.As(err, &appErr) {
                c.JSON(getHTTPStatus(appErr.Code), appErr)
            } else {
                // 未知错误
                traceID := generateTraceID()
                logError(err, traceID)
                
                c.JSON(500, &AppError{
                    Code:    "INTERNAL_ERROR",
                    Message: "Internal server error",
                    TraceID: traceID,
                })
            }
        }
    })
}
```

### 2. Firebase AI Logic集成设计

```go
// internal/ai/firebase_ai.go
type FirebaseAIService struct {
    client *genai.Client
}

// 内容分析
func (ai *FirebaseAIService) AnalyzeContent(content string) (*ContentAnalysis, error) {
    prompt := fmt.Sprintf(`
    分析以下网页内容，提取关键信息：
    1. 产品类型和行业分类
    2. 目标客群特征  
    3. 预估客单价范围
    4. 季节性特征
    5. 合规风险评估
    
    网页内容：%s
    
    请以JSON格式返回结果。
    `, content)
    
    response, err := ai.client.GenerateContent(context.Background(), prompt)
    if err != nil {
        return nil, err
    }
    
    var analysis ContentAnalysis
    if err := json.Unmarshal([]byte(response.Text), &analysis); err != nil {
        return nil, err
    }
    
    return &analysis, nil
}

// 优化建议生成
func (ai *FirebaseAIService) GenerateOptimizationSuggestions(offerData *Offer, performanceHistory []*PerformanceData) (*OptimizationSuggestions, error) {
    prompt := fmt.Sprintf(`
    基于以下数据，提供3个具体的优化建议：
    Offer数据：%s
    性能历史：%s
    
    请提供：
    1. 问题诊断
    2. 具体优化方案
    3. 预期效果
    
    以JSON格式返回。
    `, toJSON(offerData), toJSON(performanceHistory))
    
    response, err := ai.client.GenerateContent(context.Background(), prompt)
    if err != nil {
        return nil, err
    }
    
    var suggestions OptimizationSuggestions
    if err := json.Unmarshal([]byte(response.Text), &suggestions); err != nil {
        return nil, err
    }
    
    return &suggestions, nil
}

// 合规性检查
func (ai *FirebaseAIService) CheckCompliance(adContent, landingPageContent string) (*ComplianceCheck, error) {
    prompt := fmt.Sprintf(`
    检查以下广告内容和落地页的合规性：
    广告内容：%s
    落地页内容：%s
    
    检查项目：
    1. 是否涉及违禁产品（药品、烟草、赌博等）
    2. 虚假宣传风险
    3. 年龄限制内容
    4. 地域限制
    
    返回风险等级和具体问题。
    `, adContent, landingPageContent)
    
    response, err := ai.client.GenerateContent(context.Background(), prompt)
    if err != nil {
        return nil, err
    }
    
    var compliance ComplianceCheck
    if err := json.Unmarshal([]byte(response.Text), &compliance); err != nil {
        return nil, err
    }
    
    return &compliance, nil
}
```

### 3. 多用户数据隔离设计

```go
// internal/middleware/isolation.go
func DataIsolationMiddleware() gin.HandlerFunc {
    return gin.HandlerFunc(func(c *gin.Context) {
        userID := getUserIDFromToken(c.GetHeader("Authorization"))
        if userID == "" {
            c.JSON(401, gin.H{"error": "Unauthorized"})
            c.Abort()
            return
        }
        
        // 将用户ID注入到上下文中
        c.Set("user_id", userID)
        c.Next()
    })
}

// 数据访问层强制隔离
type OfferRepository struct {
    db *sql.DB
}

func (r *OfferRepository) GetOffersByUserID(userID string) ([]*Offer, error) {
    query := `
        SELECT id, url, status, created_at, updated_at 
        FROM offers 
        WHERE user_id = ? 
        ORDER BY created_at DESC
    `
    
    rows, err := r.db.Query(query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var offers []*Offer
    for rows.Next() {
        var offer Offer
        if err := rows.Scan(&offer.ID, &offer.URL, &offer.Status, &offer.CreatedAt, &offer.UpdatedAt); err != nil {
            return nil, err
        }
        offer.UserID = userID // 确保用户ID正确
        offers = append(offers, &offer)
    }
    
    return offers, nil
}

// Firestore安全规则
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用户只能访问自己的Offer数据
    match /offers/{offerId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // 用户只能访问自己的通知
    match /users/{userId}/notifications/{notificationId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // 系统配置只有管理员可以修改
    match /configs/{configId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
  }
}
*/
```

### 4. 测试策略设计

#### 单元测试

```go
// internal/services/offer_service_test.go
func TestOfferService_CreateOffer(t *testing.T) {
    tests := []struct {
        name    string
        request *CreateOfferRequest
        want    *Offer
        wantErr bool
    }{
        {
            name: "valid offer creation",
            request: &CreateOfferRequest{
                URL:     "https://example.com/offer",
                Country: "US",
                UserID:  "user123",
            },
            want: &Offer{
                URL:     "https://example.com/offer",
                Country: "US",
                Status:  "pool",
                UserID:  "user123",
            },
            wantErr: false,
        },
        {
            name: "invalid URL",
            request: &CreateOfferRequest{
                URL:     "invalid-url",
                Country: "US",
                UserID:  "user123",
            },
            want:    nil,
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            service := NewOfferService(mockRepo, mockValidator)
            got, err := service.CreateOffer(context.Background(), tt.request)
            
            if (err != nil) != tt.wantErr {
                t.Errorf("CreateOffer() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            
            if !tt.wantErr && !reflect.DeepEqual(got.URL, tt.want.URL) {
                t.Errorf("CreateOffer() = %v, want %v", got, tt.want)
            }
        })
    }
}

// 性能测试
func BenchmarkOfferService_GetOffers(b *testing.B) {
    service := NewOfferService(mockRepo, mockValidator)
    userID := "user123"
    
    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := service.GetOffers(context.Background(), userID)
        if err != nil {
            b.Fatal(err)
        }
    }
}
```

#### 端到端测试

```typescript
// e2e/offer-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Offer Management Flow', () => {
  test('complete offer lifecycle', async ({ page }) => {
    // 1. 登录
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password');
    await page.click('[data-testid=login-button]');
    
    // 2. 创建Offer
    await page.goto('/offers');
    await page.click('[data-testid=create-offer]');
    await page.fill('[data-testid=offer-url]', 'https://example.com/test-offer');
    await page.selectOption('[data-testid=country]', 'US');
    await page.click('[data-testid=submit]');
    
    // 3. 验证Offer出现在机会池
    await expect(page.locator('[data-testid=offer-card]')).toBeVisible();
    await expect(page.locator('[data-testid=offer-status]')).toHaveText('机会池');
    
    // 4. 评估Offer
    await page.click('[data-testid=evaluate-offer]');
    await expect(page.locator('[data-testid=evaluation-progress]')).toBeVisible();
    
    // 5. 等待评估完成
    await page.waitForSelector('[data-testid=evaluation-score]', { timeout: 15000 });
    const score = await page.textContent('[data-testid=evaluation-score]');
    expect(parseInt(score)).toBeGreaterThan(0);
    
    // 6. 拖拽到仿真阶段
    await page.dragAndDrop('[data-testid=offer-card]', '[data-testid=simulation-column]');
    await expect(page.locator('[data-testid=offer-status]')).toHaveText('仿真中');
  });

  test('bulk operations', async ({ page }) => {
    await page.goto('/operations');
    
    // 选择多个Offer
    await page.check('[data-testid=offer-checkbox-1]');
    await page.check('[data-testid=offer-checkbox-2]');
    
    // 执行批量操作
    await page.selectOption('[data-testid=bulk-operation]', 'adjust-cpc');
    await page.fill('[data-testid=cpc-value]', '1.50');
    await page.click('[data-testid=preview-operation]');
    
    // 确认预览
    await expect(page.locator('[data-testid=affected-count]')).toHaveText('2个Offer');
    await page.click('[data-testid=confirm-operation]');
    
    // 验证操作结果
    await expect(page.locator('[data-testid=operation-success]')).toBeVisible();
  });
});
```

#### 性能测试

```yaml
# k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // 2分钟内增加到100用户
    { duration: '5m', target: 100 }, // 保持100用户5分钟
    { duration: '2m', target: 200 }, // 2分钟内增加到200用户
    { duration: '5m', target: 200 }, // 保持200用户5分钟
    { duration: '2m', target: 0 },   // 2分钟内降到0用户
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%的请求在500ms内完成
    http_req_failed: ['rate<0.1'],    // 错误率低于10%
  },
};

export default function () {
  // 测试获取Offer列表
  let response = http.get('https://api.autoads.dev/api/v1/offers', {
    headers: {
      'Authorization': 'Bearer ' + __ENV.API_TOKEN,
    },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'offers returned': (r) => JSON.parse(r.body).length > 0,
  });
  
  sleep(1);
}
```

### 5. 动态配置管理设计

#### 配置热更新架构

```go
// internal/config/manager.go
type ConfigManager struct {
    client    *firestore.Client
    cache     map[string]interface{}
    listeners map[string][]ConfigListener
    mutex     sync.RWMutex
}

type ConfigListener interface {
    OnConfigChange(key string, value interface{})
}

func (cm *ConfigManager) StartWatching() {
    // 监听Firestore配置变更
    iter := cm.client.Collection("configs").Snapshots(context.Background())
    
    go func() {
        for {
            snap, err := iter.Next()
            if err != nil {
                log.Printf("Config watch error: %v", err)
                continue
            }
            
            for _, change := range snap.Changes {
                switch change.Kind {
                case firestore.DocumentAdded, firestore.DocumentModified:
                    cm.handleConfigChange(change.Doc)
                }
            }
        }
    }()
}

func (cm *ConfigManager) handleConfigChange(doc *firestore.DocumentSnapshot) {
    cm.mutex.Lock()
    defer cm.mutex.Unlock()
    
    configKey := doc.Ref.ID
    configValue := doc.Data()
    
    // 更新缓存
    cm.cache[configKey] = configValue
    
    // 通知监听者
    if listeners, exists := cm.listeners[configKey]; exists {
        for _, listener := range listeners {
            go listener.OnConfigChange(configKey, configValue)
        }
    }
    
    log.Printf("Config updated: %s", configKey)
}

// 评估标准配置监听器
type EvaluationConfigListener struct {
    evaluationService *EvaluationService
}

func (ecl *EvaluationConfigListener) OnConfigChange(key string, value interface{}) {
    if key == "evaluation_standards" {
        standards := value.(map[string]interface{})
        ecl.evaluationService.UpdateStandards(standards)
        log.Printf("Evaluation standards updated")
    }
}
```

#### Firestore配置结构扩展

```javascript
// /configs/dynamic_settings
{
  evaluation: {
    standards: {
      trafficPotential: {
        weights: { volume: 0.4, growth: 0.3, competition: 0.3 },
        thresholds: { high: 100000, medium: 10000, low: 1000 }
      },
      keywordRelevance: {
        weights: { match: 0.5, intent: 0.3, competition: 0.2 },
        thresholds: { high: 0.8, medium: 0.6, low: 0.4 }
      }
    },
    aiPrompts: {
      contentAnalysis: "分析以下网页内容...",
      complianceCheck: "检查以下内容的合规性...",
      optimizationSuggestion: "基于数据提供优化建议..."
    }
  },
  
  riskManagement: {
    autoTriggers: {
      zeroPerformanceDays: 5,
      roscDeclineThreshold: 0.2,
      roscDeclineDays: 7,
      lowBudgetThreshold: 20
    },
    businessRisks: {
      accountSuspended: { level: "critical", actions: ["notify", "pause_all"] },
      advertiserVerification: { level: "high", actions: ["notify", "manual_review"] },
      adDisapproved: { level: "medium", actions: ["notify", "suggest_fix"] },
      adLimited: { level: "medium", actions: ["notify", "analyze_cause"] },
      lowBudget: { level: "low", actions: ["notify", "suggest_recharge"] }
    },
    systemRisks: {
      urlParsingFailed: { level: "high", actions: ["retry", "switch_proxy", "notify"] },
      clickSimulationFailed: { level: "medium", actions: ["pause_simulation", "analyze_cause"] },
      linkRotationFailed: { level: "medium", actions: ["retry", "manual_intervention"] },
      clickPatternDeviation: { level: "low", actions: ["adjust_pattern", "notify"] }
    },
    alertLevels: {
      low: { color: "yellow", actions: ["notify"] },
      medium: { color: "orange", actions: ["notify", "suggest"] },
      high: { color: "red", actions: ["notify", "suggest", "pause"] },
      critical: { color: "red", actions: ["notify", "auto_pause"] }
    }
  },
  
  subscriptionPlans: {
    Pro: {
      name: "Pro套餐",
      description: "适合个人用户尝鲜使用",
      price: { monthly: 99, yearly: 999 },
      features: ["basic_evaluation", "manual_operations"],
      limits: {
        tokenLimit: 1000,
        offerLimit: 10,
        accountLimit: 5,
        apiCallsPerDay: 1000
      },
      permissions: [
        "offer:create", "offer:evaluate", "offer:manual_operations"
      ]
    },
    Max: {
      name: "Max套餐", 
      description: "适合专业用户日常使用",
      price: { monthly: 299, yearly: 2999 },
      features: ["advanced_evaluation", "bulk_operations", "ab_testing"],
      limits: {
        tokenLimit: 5000,
        offerLimit: 50,
        accountLimit: 25,
        apiCallsPerDay: 10000
      },
      permissions: [
        "offer:*", "bulk:*", "ab_testing:*"
      ]
    },
    Elite: {
      name: "Elite套餐",
      description: "适合企业用户深度使用", 
      price: { monthly: 999, yearly: 9999 },
      features: ["all_features", "priority_support", "custom_ai"],
      limits: {
        tokenLimit: -1,
        offerLimit: -1,
        accountLimit: -1,
        apiCallsPerDay: -1
      },
      permissions: ["*"]
    }
  },
  
  tokenConsumption: {
    rules: {
      "offer:evaluate": 10,
      "offer:simulate": 50,
      "bulk:operation": 5,
      "ai:analysis": 20,
      "url:parse": 2
    },
    multipliers: {
      "batch_operation": 0.8, // 批量操作8折
      "premium_user": 0.5     // 高级用户5折
    }
  },
  
  proxySettings: {
    countryAPIs: {
      "US": { url: "https://api.proxy-us.com", weight: 1 },
      "UK": { url: "https://api.proxy-uk.com", weight: 1 },
      "CA": { url: "https://api.proxy-ca.com", weight: 0.8 }
    },
    reuseWindow: 300,
    maxRetries: 3,
    timeout: 10000
  },
  
  featureFlags: {
    enableABTesting: true,
    enableAdvancedAI: true,
    enableBulkOperations: true,
    enableRealTimeSync: true,
    maintenanceMode: false
  },
  
  apiMonitoring: {
    googleAdsAPI: {
      dailyLimit: 15000,
      currentUsage: 8500,
      warningThreshold: 12000,
      criticalThreshold: 14000,
      callsPerService: {
        "data-sync": 5000,
        "bulk-operations": 2000,
        "offer-management": 1500
      }
    },
    rateLimiting: {
      enabled: true,
      strategy: "adaptive", // adaptive, fixed, burst
      maxCallsPerMinute: 25,
      burstAllowance: 50
    }
  },
  
  clickOptimization: {
    analysisEnabled: true,
    patterns: {
      workday: {
        peakHours: [9, 11, 14, 16, 20],
        distribution: "normal",
        variance: 0.2
      },
      weekend: {
        peakHours: [10, 15, 19, 21],
        distribution: "uniform",
        variance: 0.3
      }
    },
    realityScore: {
      threshold: 0.85,
      factors: ["timing", "frequency", "pattern", "geolocation"]
    }
  },
  
  updatedAt: "2024-01-15T10:30:00Z",
  updatedBy: "admin@autoads.dev",
  version: "1.2.3"
}

// /admin/dashboard_stats (实时统计数据)
{
  users: {
    total: 1250,
    active: 890,
    new: 45,
    churn: 12
  },
  revenue: {
    monthly: 125000,
    daily: 4200,
    growth: 0.15
  },
  system: {
    health: "healthy",
    uptime: 0.999,
    apiCalls: 45000,
    errorRate: 0.002
  },
  offers: {
    total: 8500,
    active: 6200,
    evaluating: 1200,
    simulating: 800
  }
}

// /admin/users/{userId}/profile (用户详情)
{
  basic: {
    id: "user123",
    email: "user@example.com",
    displayName: "张三",
    createdAt: "2024-01-01T00:00:00Z",
    lastLoginAt: "2024-01-15T10:30:00Z",
    status: "active"
  },
  subscription: {
    plan: "Max",
    status: "active",
    expiresAt: "2024-12-31T23:59:59Z",
    autoRenew: true
  },
  tokens: {
    balance: 3500,
    consumed: 1500,
    rechargeHistory: [
      {
        amount: 5000,
        reason: "套餐充值",
        timestamp: "2024-01-01T00:00:00Z"
      }
    ]
  },
  usage: {
    offersCreated: 25,
    evaluationsRun: 150,
    bulkOperations: 45,
    lastActivity: "2024-01-15T09:45:00Z"
  },
  limits: {
    offers: { used: 25, limit: 50 },
    accounts: { used: 8, limit: 25 },
    apiCalls: { used: 2500, limit: 10000, resetAt: "2024-01-16T00:00:00Z" }
  }
}
```

#### 后台管理系统前端设计

```typescript
// components/admin/AdminDashboard.tsx
export function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminService.getDashboardStats(),
    refetchInterval: 30000 // 30秒刷新
  });

  return (
    <div className="admin-dashboard">
      <DashboardHeader />
      
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="总用户数"
          value={stats?.users.total}
          change={stats?.users.new}
          icon={<UsersIcon />}
        />
        <StatCard
          title="月收入"
          value={formatCurrency(stats?.revenue.monthly)}
          change={stats?.revenue.growth}
          icon={<RevenueIcon />}
        />
        <StatCard
          title="系统健康度"
          value={`${(stats?.system.uptime * 100).toFixed(2)}%`}
          status={stats?.system.health}
          icon={<HealthIcon />}
        />
        <StatCard
          title="活跃Offer"
          value={stats?.offers.active}
          total={stats?.offers.total}
          icon={<OffersIcon />}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <RevenueChart data={stats?.revenue.trends} />
        <UserActivityChart data={stats?.users.activity} />
      </div>
    </div>
  );
}

// components/admin/UserManagement.tsx
export function UserManagement() {
  const [filters, setFilters] = useState({
    plan: 'all',
    status: 'all',
    search: ''
  });
  
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: () => adminService.getUsers(filters)
  });

  const handleUserAction = async (userId: string, action: string, data?: any) => {
    try {
      await adminService.updateUser(userId, action, data);
      toast.success('操作成功');
      queryClient.invalidateQueries(['admin', 'users']);
    } catch (error) {
      toast.error('操作失败');
    }
  };

  return (
    <div className="user-management">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <UserFilters filters={filters} onChange={setFilters} />
      </div>
      
      <UserTable
        users={users}
        loading={isLoading}
        onAction={handleUserAction}
      />
      
      <UserDetailModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdate={handleUserAction}
      />
    </div>
  );
}

// components/admin/PlanManagement.tsx
export function PlanManagement() {
  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminService.getPlans()
  });

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const handleSavePlan = async (planData: PlanData) => {
    try {
      if (editingPlan) {
        await adminService.updatePlan(editingPlan.id, planData);
      } else {
        await adminService.createPlan(planData);
      }
      
      toast.success('套餐保存成功');
      queryClient.invalidateQueries(['admin', 'plans']);
      setEditingPlan(null);
    } catch (error) {
      toast.error('套餐保存失败');
    }
  };

  return (
    <div className="plan-management">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">套餐管理</h1>
        <button
          onClick={() => setEditingPlan({} as Plan)}
          className="btn btn-primary"
        >
          创建套餐
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-6">
        {plans?.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={() => setEditingPlan(plan)}
            onDelete={() => handleDeletePlan(plan.id)}
          />
        ))}
      </div>
      
      <PlanEditor
        plan={editingPlan}
        onSave={handleSavePlan}
        onCancel={() => setEditingPlan(null)}
      />
    </div>
  );
}

// components/admin/TokenManagement.tsx
export function TokenManagement() {
  const { data: tokenStats } = useQuery({
    queryKey: ['admin', 'tokens', 'stats'],
    queryFn: () => adminService.getTokenStats()
  });

  const [consumptionRules, setConsumptionRules] = useState({});

  const handleUpdateRules = async (rules: ConsumptionRules) => {
    try {
      await adminService.updateTokenRules(rules);
      toast.success('消耗规则更新成功');
    } catch (error) {
      toast.error('更新失败');
    }
  };

  const handleBulkRecharge = async (rechargeData: BulkRechargeData) => {
    try {
      await adminService.bulkRecharge(rechargeData);
      toast.success('批量充值成功');
      queryClient.invalidateQueries(['admin', 'tokens']);
    } catch (error) {
      toast.error('批量充值失败');
    }
  };

  return (
    <div className="token-management">
      <div className="grid grid-cols-3 gap-6 mb-8">
        <TokenStatCard
          title="总消耗Token"
          value={tokenStats?.totalConsumed}
          trend={tokenStats?.consumptionTrend}
        />
        <TokenStatCard
          title="平均每用户消耗"
          value={tokenStats?.avgPerUser}
          comparison={tokenStats?.avgComparison}
        />
        <TokenStatCard
          title="异常消耗用户"
          value={tokenStats?.abnormalUsers}
          alerts={tokenStats?.alerts}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <ConsumptionRulesEditor
          rules={consumptionRules}
          onUpdate={handleUpdateRules}
        />
        
        <BulkRechargePanel
          onRecharge={handleBulkRecharge}
        />
      </div>
      
      <TokenConsumptionChart data={tokenStats?.consumptionHistory} />
    </div>
  );
}

// components/admin/ConfigManager.tsx
export function ConfigManager() {
  const [configs, setConfigs] = useState<ConfigData>({});
  const [selectedSection, setSelectedSection] = useState('evaluation');
  const [pendingChanges, setPendingChanges] = useState({});
  
  // 实时监听配置变更
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'configs', 'dynamic_settings'),
      (doc) => {
        if (doc.exists()) {
          setConfigs(doc.data() as ConfigData);
        }
      }
    );
    
    return unsubscribe;
  }, []);
  
  const updateConfig = async (section: string, key: string, value: any) => {
    try {
      await updateDoc(doc(db, 'configs', 'dynamic_settings'), {
        [`${section}.${key}`]: value,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email
      });
      
      toast.success('配置更新成功');
      setPendingChanges({});
    } catch (error) {
      toast.error('配置更新失败');
    }
  };
  
  return (
    <div className="config-manager">
      <div className="flex h-screen">
        <ConfigSidebar 
          sections={CONFIG_SECTIONS}
          selected={selectedSection}
          onSelect={setSelectedSection}
        />
        
        <div className="flex-1 flex">
          <ConfigEditor
            section={selectedSection}
            data={configs[selectedSection]}
            onChange={(key, value) => {
              setPendingChanges(prev => ({
                ...prev,
                [`${selectedSection}.${key}`]: value
              }));
            }}
          />
          
          <ConfigPreview
            changes={pendingChanges}
            onApply={() => applyChanges(pendingChanges)}
            onRevert={() => setPendingChanges({})}
          />
        </div>
      </div>
    </div>
  );
}

// 配置编辑器组件
const CONFIG_SECTIONS = [
  { id: 'evaluation', name: '评估标准', icon: <EvaluationIcon /> },
  { id: 'riskManagement', name: '风险管理', icon: <RiskIcon /> },
  { id: 'subscriptionPlans', name: '套餐配置', icon: <PlansIcon /> },
  { id: 'tokenConsumption', name: 'Token规则', icon: <TokenIcon /> },
  { id: 'proxySettings', name: '代理设置', icon: <ProxyIcon /> },
  { id: 'featureFlags', name: '功能开关', icon: <FlagsIcon /> }
];
```
```

#### 后台管理服务实现

```go
// internal/admin/dashboard_service.go
type DashboardService struct {
    userRepo    UserRepository
    offerRepo   OfferRepository
    revenueRepo RevenueRepository
    systemRepo  SystemRepository
}

func (ds *DashboardService) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
    var stats DashboardStats
    
    // 并发获取各项统计数据
    var wg sync.WaitGroup
    var mu sync.Mutex
    
    wg.Add(4)
    
    // 用户统计
    go func() {
        defer wg.Done()
        userStats, err := ds.userRepo.GetUserStats(ctx)
        if err == nil {
            mu.Lock()
            stats.Users = userStats
            mu.Unlock()
        }
    }()
    
    // 收入统计
    go func() {
        defer wg.Done()
        revenueStats, err := ds.revenueRepo.GetRevenueStats(ctx)
        if err == nil {
            mu.Lock()
            stats.Revenue = revenueStats
            mu.Unlock()
        }
    }()
    
    // 系统统计
    go func() {
        defer wg.Done()
        systemStats, err := ds.systemRepo.GetSystemStats(ctx)
        if err == nil {
            mu.Lock()
            stats.System = systemStats
            mu.Unlock()
        }
    }()
    
    // Offer统计
    go func() {
        defer wg.Done()
        offerStats, err := ds.offerRepo.GetOfferStats(ctx)
        if err == nil {
            mu.Lock()
            stats.Offers = offerStats
            mu.Unlock()
        }
    }()
    
    wg.Wait()
    return &stats, nil
}

// internal/admin/user_service.go
type UserService struct {
    userRepo UserRepository
    tokenRepo TokenRepository
    auditRepo AuditRepository
}

func (us *UserService) GetUsers(ctx context.Context, filters UserFilters) ([]*UserSummary, error) {
    users, err := us.userRepo.GetUsersWithFilters(ctx, filters)
    if err != nil {
        return nil, err
    }
    
    // 批量获取用户的Token余额和使用统计
    userIDs := make([]string, len(users))
    for i, user := range users {
        userIDs[i] = user.ID
    }
    
    tokenBalances, _ := us.tokenRepo.GetBalancesByUserIDs(ctx, userIDs)
    usageStats, _ := us.auditRepo.GetUsageStatsByUserIDs(ctx, userIDs)
    
    // 组装用户摘要信息
    summaries := make([]*UserSummary, len(users))
    for i, user := range users {
        summaries[i] = &UserSummary{
            User: user,
            TokenBalance: tokenBalances[user.ID],
            UsageStats: usageStats[user.ID],
        }
    }
    
    return summaries, nil
}

func (us *UserService) UpdateUserStatus(ctx context.Context, userID string, status UserStatus) error {
    // 更新用户状态
    if err := us.userRepo.UpdateStatus(ctx, userID, status); err != nil {
        return err
    }
    
    // 记录操作日志
    audit := &AuditLog{
        UserID: userID,
        Action: "status_change",
        Details: map[string]interface{}{
            "new_status": status,
        },
        Timestamp: time.Now(),
    }
    
    return us.auditRepo.CreateAuditLog(ctx, audit)
}

// internal/admin/plan_service.go
type PlanService struct {
    configManager *ConfigManager
    userRepo      UserRepository
}

func (ps *PlanService) CreatePlan(ctx context.Context, planData *PlanData) error {
    // 验证套餐数据
    if err := ps.validatePlanData(planData); err != nil {
        return err
    }
    
    // 更新Firestore配置
    planConfig := map[string]interface{}{
        fmt.Sprintf("subscriptionPlans.%s", planData.ID): planData,
        "updatedAt": time.Now().UTC(),
        "updatedBy": getUserEmail(ctx),
    }
    
    return ps.configManager.UpdateConfig(ctx, planConfig)
}

func (ps *PlanService) GetPlanUsers(ctx context.Context, planID string) ([]*User, error) {
    return ps.userRepo.GetUsersByPlan(ctx, planID)
}

// internal/admin/token_service.go
type TokenService struct {
    tokenRepo     TokenRepository
    configManager *ConfigManager
    userRepo      UserRepository
}

func (ts *TokenService) GetTokenStats(ctx context.Context) (*TokenStats, error) {
    stats := &TokenStats{}
    
    // 获取总消耗统计
    totalConsumed, err := ts.tokenRepo.GetTotalConsumed(ctx)
    if err != nil {
        return nil, err
    }
    stats.TotalConsumed = totalConsumed
    
    // 获取平均消耗
    avgPerUser, err := ts.tokenRepo.GetAverageConsumptionPerUser(ctx)
    if err != nil {
        return nil, err
    }
    stats.AvgPerUser = avgPerUser
    
    // 检测异常消耗用户
    abnormalUsers, err := ts.detectAbnormalConsumption(ctx)
    if err != nil {
        return nil, err
    }
    stats.AbnormalUsers = len(abnormalUsers)
    
    return stats, nil
}

func (ts *TokenService) BulkRecharge(ctx context.Context, rechargeData *BulkRechargeData) error {
    // 批量充值Token
    for _, userID := range rechargeData.UserIDs {
        if err := ts.tokenRepo.AddTokens(ctx, userID, rechargeData.Amount); err != nil {
            log.Printf("Failed to recharge tokens for user %s: %v", userID, err)
            continue
        }
        
        // 记录充值历史
        rechargeRecord := &TokenRecharge{
            UserID: userID,
            Amount: rechargeData.Amount,
            Reason: rechargeData.Reason,
            AdminID: getUserID(ctx),
            Timestamp: time.Now(),
        }
        
        ts.tokenRepo.RecordRecharge(ctx, rechargeRecord)
    }
    
    return nil
}

func (ts *TokenService) UpdateConsumptionRules(ctx context.Context, rules *ConsumptionRules) error {
    configUpdate := map[string]interface{}{
        "tokenConsumption.rules": rules.Rules,
        "tokenConsumption.multipliers": rules.Multipliers,
        "updatedAt": time.Now().UTC(),
        "updatedBy": getUserEmail(ctx),
    }
    
    return ts.configManager.UpdateConfig(ctx, configUpdate)
}

// internal/admin/api_monitor_service.go
type APIMonitorService struct {
    metricsRepo   MetricsRepository
    configManager *ConfigManager
    alertService  *AlertService
}

func (ams *APIMonitorService) GetAPIStats(ctx context.Context) (*APIStats, error) {
    stats := &APIStats{}
    
    // 获取Google Ads API调用统计
    dailyUsage, err := ams.metricsRepo.GetDailyAPIUsage(ctx, "google_ads")
    if err != nil {
        return nil, err
    }
    
    stats.GoogleAdsAPI = &GoogleAdsAPIStats{
        DailyUsage:    dailyUsage.Total,
        DailyLimit:    15000,
        UsagePercent:  float64(dailyUsage.Total) / 15000.0,
        CallsByService: dailyUsage.ByService,
    }
    
    // 检查是否接近限制
    if dailyUsage.Total > 12000 {
        ams.alertService.SendAlert(ctx, &Alert{
            Type:    "api_quota_warning",
            Message: fmt.Sprintf("Google Ads API usage: %d/15000", dailyUsage.Total),
            Level:   "warning",
        })
    }
    
    return stats, nil
}

func (ams *APIMonitorService) UpdateRateLimit(ctx context.Context, limits *RateLimitConfig) error {
    configUpdate := map[string]interface{}{
        "apiMonitoring.rateLimiting": limits,
        "updatedAt": time.Now().UTC(),
        "updatedBy": getUserEmail(ctx),
    }
    
    return ams.configManager.UpdateConfig(ctx, configUpdate)
}

// internal/admin/click_analysis_service.go
type ClickAnalysisService struct {
    clickRepo     ClickRepository
    aiService     *FirebaseAIService
    configManager *ConfigManager
    urlParserAPI  URLParserAPIClient
}

func (cas *ClickAnalysisService) AnalyzeClickReality(ctx context.Context, offerID string) (*ClickAnalysisResult, error) {
    // 获取点击数据
    clickData, err := cas.clickRepo.GetClickData(ctx, offerID)
    if err != nil {
        return nil, err
    }
    
    // 使用Firebase AI分析点击模式
    prompt := fmt.Sprintf(`
    分析以下点击数据的真实性：
    点击时间分布：%s
    点击频率：%s
    地理位置分布：%s
    
    请评估：
    1. 真实性评分 (0-1)
    2. 异常模式识别
    3. 优化建议
    `, 
        toJSON(clickData.TimeDistribution),
        toJSON(clickData.Frequency),
        toJSON(clickData.GeoDistribution),
    )
    
    aiResult, err := cas.aiService.AnalyzeContent(prompt)
    if err != nil {
        return nil, err
    }
    
    result := &ClickAnalysisResult{
        OfferID:      offerID,
        RealityScore: aiResult.RealityScore,
        Anomalies:    aiResult.Anomalies,
        Suggestions:  aiResult.Suggestions,
        AnalyzedAt:   time.Now(),
    }
    
    return result, nil
}

func (cas *ClickAnalysisService) OptimizeClickStrategy(ctx context.Context, analysisResult *ClickAnalysisResult) (*OptimizedStrategy, error) {
    // 基于分析结果生成优化策略
    strategy := &OptimizedStrategy{
        OfferID: analysisResult.OfferID,
        Patterns: make(map[string]interface{}),
    }
    
    // 根据AI建议调整点击模式
    for _, suggestion := range analysisResult.Suggestions {
        switch suggestion.Type {
        case "timing_adjustment":
            strategy.Patterns["timing"] = suggestion.Value
        case "frequency_adjustment":
            strategy.Patterns["frequency"] = suggestion.Value
        case "geo_distribution":
            strategy.Patterns["geo"] = suggestion.Value
        }
    }
    
    return strategy, nil
}

func (cas *ClickAnalysisService) DeployStrategy(ctx context.Context, strategy *OptimizedStrategy) error {
    // 将优化策略推送到URL解析服务
    deployRequest := &StrategyDeployRequest{
        OfferID:  strategy.OfferID,
        Patterns: strategy.Patterns,
        Version:  time.Now().Unix(),
    }
    
    return cas.urlParserAPI.UpdateClickStrategy(ctx, deployRequest)
}
```

### 7. 监控和日志

```go
// internal/monitoring/logger.go
type Logger struct {
    logger *logrus.Logger
}

func NewLogger() *Logger {
    logger := logrus.New()
    logger.SetFormatter(&logrus.JSONFormatter{})
    logger.SetLevel(logrus.InfoLevel)
    
    return &Logger{logger: logger}
}

func (l *Logger) LogOperation(ctx context.Context, operation string, data interface{}) {
    l.logger.WithFields(logrus.Fields{
        "operation": operation,
        "user_id":   getUserID(ctx),
        "trace_id":  getTraceID(ctx),
        "data":      data,
        "timestamp": time.Now().UTC(),
    }).Info("Operation executed")
}

func (l *Logger) LogError(ctx context.Context, err error, details map[string]interface{}) {
    l.logger.WithFields(logrus.Fields{
        "error":     err.Error(),
        "user_id":   getUserID(ctx),
        "trace_id":  getTraceID(ctx),
        "details":   details,
        "timestamp": time.Now().UTC(),
    }).Error("Error occurred")
}

// 性能监控
func (l *Logger) LogPerformance(ctx context.Context, operation string, duration time.Duration) {
    l.logger.WithFields(logrus.Fields{
        "operation": operation,
        "duration":  duration.Milliseconds(),
        "user_id":   getUserID(ctx),
        "trace_id":  getTraceID(ctx),
    }).Info("Performance metric")
}
```

### 3. 健康检查

```go
// internal/health/checker.go
type HealthChecker struct {
    checks map[string]HealthCheck
}

type HealthCheck interface {
    Check(ctx context.Context) error
    Name() string
}

type DatabaseHealthCheck struct {
    db *sql.DB
}

func (d *DatabaseHealthCheck) Check(ctx context.Context) error {
    return d.db.PingContext(ctx)
}

func (d *DatabaseHealthCheck) Name() string {
    return "database"
}

type FirestoreHealthCheck struct {
    client *firestore.Client
}

func (f *FirestoreHealthCheck) Check(ctx context.Context) error {
    _, err := f.client.Collection("health").Doc("test").Get(ctx)
    if err != nil && status.Code(err) != codes.NotFound {
        return err
    }
    return nil
}

func (f *FirestoreHealthCheck) Name() string {
    return "firestore"
}

// 健康检查端点
func (h *HealthChecker) HandleHealthCheck(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
    defer cancel()
    
    results := make(map[string]interface{})
    allHealthy := true
    
    for name, check := range h.checks {
        if err := check.Check(ctx); err != nil {
            results[name] = map[string]interface{}{
                "status": "unhealthy",
                "error":  err.Error(),
            }
            allHealthy = false
        } else {
            results[name] = map[string]interface{}{
                "status": "healthy",
            }
        }
    }
    
    status := "healthy"
    httpStatus := 200
    if !allHealthy {
        status = "unhealthy"
        httpStatus = 503
    }
    
    c.JSON(httpStatus, gin.H{
        "status": status,
        "checks": results,
        "timestamp": time.Now().UTC(),
    })
}
```

## 部署架构

### 1. Cloud Run服务配置

```yaml
# deploy/offer-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: offer-service
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "100"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "512Mi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containerConcurrency: 80
      containers:
      - image: gcr.io/gen-lang-client-0944935873/offer-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: PROJECT_ID
          value: "gen-lang-client-0944935873"
        - name: FIRESTORE_DB
          value: "firestoredb"
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
```

### 2. URL解析服务配置（常驻服务）

```yaml
# deploy/url-parser-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: url-parser-service
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"  # 常驻实例
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"       # 更大内存支持浏览器实例
        run.googleapis.com/cpu: "2000m"       # 更多CPU资源
    spec:
      containerConcurrency: 20  # 降低并发以保证性能
      containers:
      - image: gcr.io/gen-lang-client-0944935873/url-parser-service:latest
        ports:
        - containerPort: 8080
        env:
        - name: BROWSER_POOL_SIZE
          value: "5"
        - name: PROXY_API_URL
          valueFrom:
            secretKeyRef:
              name: proxy-config
              key: api_url
        resources:
          limits:
            cpu: 2000m
            memory: 1Gi
```

### 3. 部署要求

**服务部署顺序：**
1. URL解析服务（常驻服务，其他服务依赖）
2. 数据同步服务
3. Offer管理服务
4. 批量操作服务
5. AI预警服务

**关键配置：**
- 环境变量和密钥通过Secret Manager管理
- 数据库迁移脚本需在服务部署前执行
- 服务间依赖关系通过健康检查确保

## 总结

本设计文档提供了上瘾式广告管理系统的完整技术架构和实现方案，包括：

1. **微服务架构：** 基于Cloud Run的可扩展微服务设计
2. **数据存储：** Firestore + Cloud SQL的混合存储策略
3. **定时任务：** Cloud Scheduler + Pub/Sub + Functions的可靠任务调度
4. **前端体验：** Next.js + 实时交互的上瘾式用户体验
5. **安全性：** 完整的认证、授权、加密和监控体系
6. **性能优化：** 缓存、数据库优化、前端性能优化策略
7. **AI集成：** Firebase AI Logic的多场景深度应用
8. **数据隔离：** 多用户SaaS的严格数据安全保障
9. **测试体系：** 单元测试、端到端测试、性能测试的完整覆盖
10. **动态配置：** 基于Firestore的热更新配置管理系统

该设计充分利用了Google Cloud Platform的技术栈，实现了高性能、可扩展、安全可靠的广告管理平台，为用户提供"上瘾"的使用体验，同时确保了系统的可维护性、可测试性和可扩展性。