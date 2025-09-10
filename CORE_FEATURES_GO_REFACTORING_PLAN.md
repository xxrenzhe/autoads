# AutoAds 核心功能 Go 重构方案

## 1. 重构概述

### 1.1 重构目标
- 将3大核心功能（BatchGo、SiteRank、AdsCenter）从 Next.js/Node.js 重构为 Go 实现
- 保持现有业务逻辑和功能完整性
- 提升性能和并发处理能力
- 集成到 GoFly 框架中

### 1.2 重构原则
1. **API兼容性优先**：保持现有API接口不变，前端无需修改
2. **业务逻辑 preserved**：所有现有功能必须保留
3. **渐进式迁移**：支持新旧系统并行运行，平滑过渡
4. **数据一致性**：确保重构过程中数据不丢失

## 2. 现有功能分析

### 2.1 BatchGo (批量访问)
**现有实现**：
- API：`/api/batchopen/silent-start`
- 功能：批量URL访问，支持代理、Referer、并发控制
- 特点：HTTP/Puppeteer双模式，Token消耗，任务状态跟踪

**核心业务逻辑**：
```typescript
// 任务启动流程
1. 验证用户权限和Token余额
2. 解析请求参数（URLs、cycleCount、proxy等）
3. 创建任务实例
4. 异步执行批量访问
5. 实时更新任务状态
6. 保存执行结果
```

### 2.2 SiteRank (排名查询)
**现有实现**：
- API：`/api/siterank/batch`
- 功能：批量查询网站排名，集成SimilarWeb API
- 特点：批量处理、缓存机制、Token消耗

**核心业务逻辑**：
```typescript
// 查询流程
1. 接收域名列表
2. 检查缓存
3. 调用SimilarWeb API
4. 处理响应数据
5. 返回排名信息
6. 更新缓存
```

### 2.3 AdsCenter (自动化广告)
**现有实现**：
- API：多个管理接口
- 功能：Google Ads自动化管理，链接更新
- 特点：OAuth集成，定时任务，多平台支持

**核心业务逻辑**：
```typescript
// 自动化流程
1. Google Ads OAuth认证
2. 获取广告系列数据
3. 分析链接性能
4. 自动更新链接
5. 监控执行状态
```

## 3. Go 重构设计

### 3.1 架构设计

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js      │    │   GoFly API    │    │   Go Services  │
│   Frontend     │◄──►│   Gateway      │◄──►│   (BatchGo/    │
│   (保持不变)    │    │   (GoFly)      │    │   SiteRankGo/  │
└─────────────────┘    └─────────────────┘    │   AdsCenterGo)│
                              │               └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Token & Auth  │    │   Database &    │
                       │   Service      │    │   Cache         │
                       │   (GoFly)      │    │   (MySQL/Redis) │
                       └─────────────────┘    └─────────────────┘
```

### 3.2 API兼容层设计

**路由映射**：
```go
// GoFly 自动路由规则
/app/business/batchgo/Task/SilentStart → POST /business/batchgo/task/silent-start
/app/business/siterank/Query/Batch → POST /business/siterank/query/batch
/app/business/adscenter/Task/Execute → POST /business/adscenter/task/execute
```

**API结构保持**：
```go
// BatchGo 请求结构
type SilentStartRequest struct {
    TaskId                string   `json:"taskId"`
    Urls                  []string `json:"urls"`
    CycleCount            int      `json:"cycleCount"`
    OpenInterval          int      `json:"openInterval"`
    ProxyUrl              string   `json:"proxyUrl"`
    RefererOption         string   `json:"refererOption"`
    AccessMode            string   `json:"accessMode"`
    // ... 其他字段保持与现有API一致
}

// 响应结构保持兼容
type SilentStartResponse struct {
    TaskId             string `json:"taskId"`
    Status             string `json:"status"`
    EstimatedDuration  int    `json:"estimatedDuration"`
    TotalUrls          int    `json:"totalUrls"`
    // ... 其他字段保持与现有API一致
}
```

### 3.3 BatchGo Go实现

**核心组件**：
```go
// 任务管理器
type BatchTaskManager struct {
    tasks    sync.Map // map[string]*BatchTask
    queue    *TaskQueue
    pool     *WorkerPool
    storage  TaskStorage
}

// 任务执行器
type TaskExecutor struct {
    httpClient   *http.Client
    proxyPool    *ProxyPool
    rateLimiter  *rate.Limiter
}

// 并发控制
type ConcurrencyController struct {
    maxConcurrentTasks int
    semaphore        chan struct{}
    activeTasks      map[string]bool
}
```

**实现要点**：
1. 使用goroutine池管理并发任务
2. 实现智能代理轮转机制
3. 支持HTTP和Puppeteer模式
4. 实时任务状态更新
5. 结果持久化存储

### 3.4 SiteRankGo实现

**核心组件**：
```go
// 查询服务
type SiteRankService struct {
    similarWebClient *SimilarWebClient
    cache           *RedisCache
    queue           *QueryQueue
}

// 批量处理器
type BatchProcessor struct {
    workers    int
    batchSize  int
    timeout    time.Duration
}

// 缓存管理
type CacheManager struct {
    redis      *redis.Client
    ttl        time.Duration
    keyPrefix  string
}
```

**实现要点**：
1. 集成SimilarWeb官方Go SDK
2. 实现智能缓存策略
3. 批量查询优化
4. 错误重试机制
5. 结果格式兼容

### 3.5 AdsCenterGo实现

**核心组件**：
```go
// Google Ads客户端
type GoogleAdsClient struct {
    config      *googleads.Config
    oauth       *oauth2.Config
    tokenSource oauth2.TokenSource
}

// 自动化引擎
type AutomationEngine struct {
    scheduler   *Scheduler
    executor    *TaskExecutor
    monitor     *Monitor
}

// 任务调度器
type Scheduler struct {
    cron       *cron.Cron
    tasks      map[string]*ScheduledTask
    storage    TaskStorage
}
```

**实现要点**：
1. 使用Google Ads API Go客户端
2. 实现安全的OAuth流程
3. 定时任务调度
4. 执行监控和告警
5. 数据备份恢复

## 4. 直接替换迁移策略

### 4.1 阶段1：准备阶段（1周）
1. 部署GoFly框架
2. 搭建Go服务开发环境
3. 数据库表结构准备
4. API接口文档整理

### 4.2 阶段2：BatchGo实现（3周）
1. 完整实现BatchGo Go服务
2. 单元测试和集成测试
3. 数据迁移脚本准备
4. 部署脚本准备

### 4.3 阶段3：BatchGo上线（1天）
1. 停机维护窗口（建议5分钟）
2. 部署Go服务
3. 验证功能完整性
4. 切换API到Go服务
5. 监控运行状态

### 4.4 阶段4：SiteRankGo实现（2周）
1. 完整实现SiteRankGo服务
2. 单元测试和集成测试
3. 缓存数据迁移方案

### 4.5 阶段5：SiteRankGo上线（1天）
1. 停机维护窗口（建议3分钟）
2. 部署SiteRankGo服务
3. 验证查询功能
4. 监控API性能

### 4.6 阶段6：AdsCenterGo实现（3周）
1. 完整实现AdsCenterGo服务
2. OAuth流程实现
3. 定时任务迁移
4. 数据迁移脚本

### 4.7 阶段7：AdsCenterGo上线（1天）
1. 停机维护窗口（建议5分钟）
2. 部署AdsCenterGo服务
3. 验证自动化功能
4. 监控运行状态

### 4.8 阶段8：清理优化（1周）
1. 移除Next.js后端代码
2. 更新部署配置
3. 性能调优
4. 文档更新

## 5. 数据库设计

### 5.1 数据库表设计
由于无需迁移历史数据，直接使用GoFly标准表结构：

```sql
-- BatchGo相关表
CREATE TABLE batchgo_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(100) UNIQUE NOT NULL,
    urls JSON NOT NULL,
    cycle_count INT DEFAULT 1,
    status ENUM('pending', 'running', 'completed', 'failed', 'terminated') DEFAULT 'pending',
    progress INT DEFAULT 0,
    total INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_task_id (task_id),
    INDEX idx_status (status)
);

-- SiteRankGo相关表
CREATE TABLE siterank_queries (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    global_rank BIGINT,
    monthly_visits BIGINT,
    category VARCHAR(100),
    country VARCHAR(10),
    status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
    error_message TEXT,
    cached_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_domain (domain),
    INDEX idx_cached_at (cached_at)
);

-- AdsCenterGo相关表
CREATE TABLE adscenter_accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    status ENUM('active', 'inactive', 'expired') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_platform (platform)
);

CREATE TABLE adscenter_tasks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    config JSON,
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_status (status)
);
```

## 6. 风险控制

### 6.1 回滚机制
由于无需数据迁移，回滚非常简单：

1. **快速回滚方案**
   - 保留Next.js版本部署包
   - 准备回滚脚本
   - 5分钟内完成回滚

2. **回滚步骤**
   ```bash
   # 1. 停止Go服务
   systemctl stop gofly-service
   
   # 2. 切换回Next.js路由
   nginx -s reload
   
   # 3. 启动Next.js服务
   systemctl start nextjs-service
   ```

3. **版本管理**
   - 每次部署前打标签
   - 保留最近3个版本
   - 一键回滚到指定版本

```go
// 回滚控制器
type RollbackController struct {
    versionManager *VersionManager
    serviceManager *ServiceManager
}

// 执行回滚
func (r *RollbackController) Rollback(version string) error {
    log.Info("开始回滚到版本: " + version)
    
    // 1. 停止当前服务
    if err := r.serviceManager.StopGoServices(); err != nil {
        return err
    }
    
    // 2. 切换版本
    if err := r.versionManager.SwitchTo(version); err != nil {
        return err
    }
    
    // 3. 启动Next.js服务
    if err := r.serviceManager.StartNextJSServices(); err != nil {
        return err
    }
    
    log.Info("回滚完成")
    return nil
}
```

### 6.2 监控指标
1. API响应时间
2. 错误率统计
3. 资源使用率
4. 数据一致性检查

## 7. 测试策略

### 7.1 兼容性测试
```go
// API兼容性测试
func TestAPICompatibility(t *testing.T) {
    tests := []APITestCase{
        {
            Name:     "BatchGo Silent Start",
            Endpoint: "/api/batchopen/silent-start",
            Method:   "POST",
            Payload:  testPayload,
            Expected: expectedResponse,
        },
        // 更多测试用例...
    }
    
    for _, tc := range tests {
        // 测试旧系统
        oldResponse := callNextJSEndpoint(tc)
        
        // 测试新系统
        newResponse := callGoEndpoint(tc)
        
        // 验证响应一致性
        assertResponsesEqual(t, oldResponse, newResponse)
    }
}
```

### 7.2 性能测试
1. 并发性能对比
2. 内存使用测试
3. 长时间稳定性
4. 极限压力测试

## 8. 实施时间表

| 阶段 | 任务 | 时间 | 负责人 | 停机时间 |
|------|------|------|--------|----------|
| 1 | 准备工作 | 1周 | 架构师 | 无 |
| 2 | BatchGo实现 | 3周 | 后端团队 | 无 |
| 3 | BatchGo上线 | 1天 | 运维团队 | 5分钟 |
| 4 | SiteRankGo实现 | 2周 | 后端团队 | 无 |
| 5 | SiteRankGo上线 | 1天 | 运维团队 | 3分钟 |
| 6 | AdsCenterGo实现 | 3周 | 后端团队 | 无 |
| 7 | AdsCenterGo上线 | 1天 | 运维团队 | 5分钟 |
| 8 | 清理优化 | 1周 | 全体团队 | 无 |

**总计：11周**
**总停机时间：13分钟**

## 9. 成功标准

1. **功能完整性**：所有现有功能在Go版本中正常工作
2. **性能提升**：响应时间提升50%以上，并发处理能力提升3倍
3. **稳定性**：错误率低于0.1%，系统可用性99.9%
4. **兼容性**：前端无需任何修改即可切换到新后端
5. **平滑切换**：每次上线停机时间不超过5分钟

## 10. 后续优化

1. **微服务拆分**：根据业务发展进一步拆分服务
2. **容器化部署**：Docker + Kubernetes部署
3. **监控完善**：APM性能监控，业务指标监控
4. **自动化运维**：CI/CD流水线，自动扩缩容