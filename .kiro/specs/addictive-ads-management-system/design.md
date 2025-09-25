# 上瘾式广告管理系统设计文档

## 概述

本设计文档基于专家评审建议，采用企业级事件驱动微服务架构。遵循"好品味、KISS与实用主义、一次成型"的设计原则，实现契约先行、事件为核的高可扩展性广告管理平台。

## 设计原则

### 好品味
- 用数据与流程消除特例
- 统一模型、统一错误体、统一鉴权
- 保持架构的一致性和优雅性

### KISS与实用主义  
- 契约先行、事件为核、大任务入队
- 少即是多，避免过度设计
- 专注核心业务价值

### 一次成型
- 不保留旧端点/旧头/旧路径
- 最终形态直达（无需历史迁移）
- 避免技术债务积累

## 系统架构

## 架构总览

### 技术形态
- **Cloud Run微服务** + **Cloud SQL PostgreSQL**（主库：事件与读模型）
- **Pub/Sub**（事件总线/任务队列） + **Cloud Functions**（投影器）  
- **Secret Manager**（密钥） + **API Gateway**（统一入口）
- **Firestore**（UI级缓存）

### 解耦策略
- **命令→事件→投影→读模型**
- **长耗时/高配额动作**（浏览器执行/批量Ads操作/AI分析）统一入队

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│              API Gateway + Identity (统一入口)                  │
│    OpenAPI契约 + Firebase Auth直连 + pkg/auth中间件            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                   微服务层 (Cloud Run)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │billing   │ │offer     │ │siterank  │ │batch     │ │ads     │ │
│  │          │ │          │ │+ai-alerts│ │open      │ │center  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │notifications│ │console │ │frontend  │                       │
│  │            │ │        │ │          │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│              执行器服务 (独立Cloud Run)                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           browser-exec (Node.js 22 + Playwright)           │ │
│  │              常驻服务，专业浏览器自动化                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                   事件总线 (Pub/Sub)                            │
│              domain-events + 任务队列 + 投影触发                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│              投影器 (Cloud Functions)                           │
│                事件 → 读模型 + UI缓存                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                   数据存储层                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │PostgreSQL   │ │  Firestore  │ │Cloud Storage│ │Secret Mgr   ││
│  │事件存储+读模型│ │UI实时缓存   │ │文件/日志    │ │密钥管理     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 共享底座设计

### pkg/auth - Firebase认证中间件
```go
// Firebase Auth + PostgreSQL RLS集成
type AuthMiddleware struct {
    firebaseAuth *auth.Client
    db          *sql.DB
}

func (am *AuthMiddleware) ValidateToken(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. 验证Firebase Token
        token := extractBearerToken(r)
        decodedToken, err := am.firebaseAuth.VerifyIDToken(r.Context(), token)
        if err != nil {
            writeErrorResponse(w, "UNAUTHORIZED", "Invalid token", nil)
            return
        }
        
        // 2. 设置PostgreSQL RLS上下文
        _, err = am.db.Exec("SET app.user_id = $1", decodedToken.UID)
        if err != nil {
            writeErrorResponse(w, "INTERNAL_ERROR", "Failed to set user context", nil)
            return
        }
        
        // 3. 注入用户上下文
        ctx := context.WithValue(r.Context(), "user_id", decodedToken.UID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### pkg/outbox - Outbox模式实现
```go
// Outbox轮询发布器
type OutboxPublisher struct {
    db     *sql.DB
    pubsub *pubsub.Client
}

func (op *OutboxPublisher) PublishPendingEvents() error {
    // 1. 查询待发布事件
    rows, err := op.db.Query(`
        SELECT id, event_id, topic, payload 
        FROM outbox 
        WHERE status = 'pending' 
        ORDER BY created_at 
        LIMIT 100
    `)
    
    // 2. 批量发布到Pub/Sub
    for rows.Next() {
        var outboxEvent OutboxEvent
        rows.Scan(&outboxEvent.ID, &outboxEvent.EventID, &outboxEvent.Topic, &outboxEvent.Payload)
        
        // 发布事件（带去重键）
        result := op.pubsub.Topic(outboxEvent.Topic).Publish(ctx, &pubsub.Message{
            Data: outboxEvent.Payload,
            Attributes: map[string]string{
                "event_id": outboxEvent.EventID, // 去重键
            },
        })
        
        // 3. 更新发布状态
        if _, err := result.Get(ctx); err == nil {
            op.db.Exec("UPDATE outbox SET status = 'published', published_at = NOW() WHERE id = $1", outboxEvent.ID)
        }
    }
}
```

### pkg/http - 统一错误处理
```go
// 统一错误体
type ErrorResponse struct {
    Code    string      `json:"code"`
    Message string      `json:"message"`
    Details interface{} `json:"details,omitempty"`
    TraceID string      `json:"traceId"`
}

// 错误码映射表
var ErrorCodeMap = map[string]int{
    "VALIDATION_ERROR":   400,
    "UNAUTHORIZED":       401,
    "FORBIDDEN":          403,
    "NOT_FOUND":          404,
    "CONFLICT":           409,
    "INTERNAL_ERROR":     500,
    "SERVICE_UNAVAILABLE": 503,
}

func writeErrorResponse(w http.ResponseWriter, code, message string, details interface{}) {
    traceID := getTraceIDFromContext(r.Context())
    statusCode := ErrorCodeMap[code]
    
    response := ErrorResponse{
        Code:    code,
        Message: message,
        Details: details,
        TraceID: traceID,
    }
    
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    json.NewEncoder(w).Encode(response)
}
```

## 核心组件设计

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

### 4. 高并发浏览器执行服务 (Browser-Exec Service) - 企业级优化

**职责：** 支持数百用户并发的企业级浏览器自动化服务，采用Cloud Tasks队列和代理池熔断机制

**技术栈：** Node.js 22 + Playwright + Cloud Run + Cloud Tasks + 代理池管理

**企业级高并发架构设计：**

#### 优化架构图
```
┌─────────────────────────────────────────┐
│           API Gateway Layer             │
│     (统一入口 + 认证 + 路由)             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Cloud Tasks Queue               │
│  (按type-country分队列 + 优先级调度)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│       Browser Pool Manager             │
│ (按国家+优先级分池 + 代理池熔断隔离)     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│    Browser Worker Instances             │
│ (min-instances>0预热 + 并发/内存护栏)    │
└─────────────────────────────────────────┘
```

#### 容量规划
- **单实例配置**：4-8GB内存，2-4vCPU，8-12个浏览器实例
- **集群规模**：最小2个实例（预热），正常5-10个，峰值20-50个
- **处理能力**：单实例100-200任务/分钟，集群2000-10000任务/分钟
- **并发支持**：数百用户同时使用，数千任务排队处理

**核心功能模块：**

#### 任务调度与队列管理
- **智能调度器**：按任务类型、优先级、地理位置分配
- **队列管理**：Redis多队列，支持优先级和批量处理
- **负载均衡**：实时监控实例负载，动态分配任务
- **故障转移**：实例故障自动转移，任务重试机制

#### 浏览器池管理
- **实例池管理**：每个Worker维护多个浏览器实例
- **上下文隔离**：BrowserContext隔离，避免任务间污染
- **资源回收**：定期回收长时间运行的实例
- **预热策略**：保持最小实例数，减少冷启动时间

#### 业务处理能力
- **URL解析模块**：多重重定向处理，Final URL和suffix提取
- **品牌识别模块**：智能域名品牌提取（nike.com→nike）
- **可用性探测**：落地页健康检测和异常识别
- **点击仿真模块**：真实用户行为模拟和反检测
- **批量处理**：相同类型任务批量执行优化

**高并发API设计：**
```typescript
// 任务提交API (异步处理)
POST   /api/v1/browser/tasks             // 提交任务 (返回202 + taskId)
POST   /api/v1/browser/tasks/batch       // 批量提交任务
GET    /api/v1/browser/tasks/{taskId}    // 查询任务状态和结果
DELETE /api/v1/browser/tasks/{taskId}    // 取消任务
GET    /api/v1/browser/tasks             // 查询任务列表 (支持分页)

// 实时状态API
GET    /api/v1/browser/health            // 服务健康检查
GET    /api/v1/browser/stats             // 获取执行统计
GET    /api/v1/browser/capacity          // 获取容量信息
GET    /api/v1/browser/instances         // 获取实例状态

// 管理API
PUT    /api/v1/browser/config            // 更新配置
POST   /api/v1/browser/scale             // 手动扩缩容
POST   /api/v1/browser/maintenance       // 维护模式切换

// WebSocket实时通知
WS     /api/v1/browser/notifications     // 任务状态实时推送
```

**高并发核心实现：**
```typescript
// 浏览器池管理器 (支持多池管理)
class BrowserPoolManager {
    private pools: Map<string, BrowserPool> = new Map();
    private maxInstancesPerPool = 12; // 每个池最大实例数
    private maxPoolsPerWorker = 5;    // 每个Worker最大池数
    
    async getBrowser(country: string, priority: 'high' | 'normal' = 'normal'): Promise<BrowserContext> {
        const poolKey = `${country}-${priority}`;
        let pool = this.pools.get(poolKey);
        
        if (!pool) {
            pool = new BrowserPool({
                maxSize: this.maxInstancesPerPool,
                country: country,
                priority: priority
            });
            this.pools.set(poolKey, pool);
        }
        
        return await pool.acquire();
    }
    
    async getPoolStats(): Promise<PoolStats[]> {
        return Array.from(this.pools.entries()).map(([key, pool]) => ({
            poolKey: key,
            activeInstances: pool.getActiveCount(),
            queuedTasks: pool.getQueuedCount(),
            avgResponseTime: pool.getAvgResponseTime()
        }));
    }
}

// 智能任务调度器
class TaskScheduler {
    private queues: Map<string, Queue> = new Map();
    private loadBalancer: LoadBalancer;
    
    async scheduleTask(task: BrowserTask): Promise<string> {
        // 根据任务类型和优先级选择队列
        const queueName = this.selectQueue(task);
        const taskId = generateTaskId();
        
        await this.queues.get(queueName)?.add(taskId, task, {
            priority: this.calculatePriority(task),
            delay: task.delay || 0,
            attempts: 3,
            backoff: 'exponential'
        });
        
        return taskId;
    }
    
    private selectQueue(task: BrowserTask): string {
        // 评估任务 -> 高优先级队列 (eval-{country})
        // 仿真任务 -> 普通队列 (sim-{country})
        // 检测任务 -> 低优先级队列 (check-{country})
        return `${task.type}-${task.country}`;
    }
    
    private calculatePriority(task: BrowserTask): number {
        const priorities = {
            'url-parse': 100,      // 最高优先级
            'evaluation': 90,      // 高优先级
            'simulation': 50,      // 普通优先级
            'availability': 20     // 低优先级
        };
        return priorities[task.type] || 50;
    }
}

// 负载均衡器
class LoadBalancer {
    private instances: WorkerInstance[] = [];
    private healthChecker: HealthChecker;
    
    async selectInstance(task: BrowserTask): Promise<WorkerInstance> {
        // 1. 过滤健康实例
        const healthyInstances = this.instances.filter(i => i.isHealthy());
        
        // 2. 按地理位置就近选择
        const nearbyInstances = healthyInstances.filter(i => 
            i.supportsCountry(task.country)
        );
        
        // 3. 按负载选择最优实例
        const candidates = nearbyInstances
            .filter(i => i.currentLoad < i.maxCapacity * 0.8)
            .sort((a, b) => a.currentLoad - b.currentLoad);
            
        if (candidates.length > 0) {
            return candidates[0];
        }
        
        // 4. 触发扩容
        return await this.scaleUp(task.country);
    }
    
    async scaleUp(country: string): Promise<WorkerInstance> {
        // 触发Cloud Run自动扩容
        const newInstance = await this.createInstance({
            country: country,
            memory: '8Gi',
            cpu: '4',
            minInstances: 1,
            maxInstances: 1
        });
        
        this.instances.push(newInstance);
        return newInstance;
    }
}

// 批量任务处理器
class BatchTaskProcessor {
    async processBatch(tasks: BrowserTask[]): Promise<TaskResult[]> {
        // 按类型分组批处理
        const groups = this.groupByType(tasks);
        const results: TaskResult[] = [];
        
        for (const [type, groupTasks] of groups) {
            switch (type) {
                case 'url-parse':
                    // URL解析可以批量处理
                    results.push(...await this.batchParseUrls(groupTasks));
                    break;
                case 'availability-check':
                    // 可用性检测并行处理
                    results.push(...await this.parallelAvailabilityCheck(groupTasks));
                    break;
                case 'click-simulation':
                    // 点击仿真需要串行处理（避免检测）
                    results.push(...await this.serialClickSimulation(groupTasks));
                    break;
            }
        }
        
        return results;
    }
    
    private async batchParseUrls(tasks: BrowserTask[]): Promise<TaskResult[]> {
        // 使用单个浏览器实例批量解析多个URL
        const browser = await this.poolManager.getBrowser(tasks[0].country);
        const results: TaskResult[] = [];
        
        try {
            for (const task of tasks) {
                const page = await browser.newPage();
                try {
                    const result = await this.parseUrl(page, task.url);
                    results.push({ taskId: task.id, success: true, data: result });
                } catch (error) {
                    results.push({ taskId: task.id, success: false, error: error.message });
                } finally {
                    await page.close();
                }
            }
        } finally {
            await this.poolManager.releaseBrowser(browser);
        }
        
        return results;
    }
}

// 监控和指标收集
class MetricsCollector {
    private metrics: Map<string, Metric> = new Map();
    
    recordTaskExecution(task: BrowserTask, duration: number, success: boolean): void {
        const key = `${task.type}_${task.country}`;
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, new Metric(key));
        }
        
        const metric = this.metrics.get(key)!;
        metric.recordExecution(duration, success);
    }
    
    getMetrics(): MetricsSummary {
        return {
            totalTasks: this.getTotalTasks(),
            successRate: this.getSuccessRate(),
            avgResponseTime: this.getAvgResponseTime(),
            instanceUtilization: this.getInstanceUtilization(),
            queueDepth: this.getQueueDepth()
        };
    }
}
```

### 5. API Gateway + Identity中间件 (统一认证)

**职责：** 统一入口、Firebase Auth直连、身份认证中间件

**技术栈：** API Gateway + pkg/auth中间件 + Firebase Auth

**架构优势：**
- **减少一跳**：去掉独立Identity服务，降低冷启动和跨服务失败点
- **直连Firebase**：API Gateway直接集成Firebase Auth，性能更优
- **中间件承载**：pkg/auth中间件处理认证/鉴权逻辑，复用性强

**API设计：**
```go
// Identity API (由API Gateway + pkg/auth实现)
POST   /api/v1/identity/register         // 用户注册 (直连Firebase)
POST   /api/v1/identity/login           // 用户登录 (直连Firebase)
POST   /api/v1/identity/refresh         // 刷新Token (直连Firebase)
DELETE /api/v1/identity/logout          // 用户登出 (直连Firebase)
GET    /api/v1/identity/profile         // 获取用户信息 (中间件处理)
PUT    /api/v1/identity/profile         // 更新用户信息 (中间件处理)
```

**pkg/auth中间件实现：**
```go
// Firebase Auth中间件
type AuthMiddleware struct {
    firebaseAuth *auth.Client
}

func (am *AuthMiddleware) ValidateToken(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. 提取Bearer Token
        token := extractBearerToken(r)
        if token == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        
        // 2. 验证Firebase Token
        decodedToken, err := am.firebaseAuth.VerifyIDToken(r.Context(), token)
        if err != nil {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }
        
        // 3. 注入用户上下文
        ctx := context.WithValue(r.Context(), "user_id", decodedToken.UID)
        ctx = context.WithValue(ctx, "user_email", decodedToken.Claims["email"])
        
        // 4. 设置PostgreSQL RLS上下文
        if db := getDBFromContext(ctx); db != nil {
            db.Exec("SET app.user_id = $1", decodedToken.UID)
        }
        
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// API Gateway路由配置
func setupGatewayRoutes() {
    // Identity路由直接处理
    http.HandleFunc("/api/v1/identity/register", handleFirebaseRegister)
    http.HandleFunc("/api/v1/identity/login", handleFirebaseLogin)
    http.HandleFunc("/api/v1/identity/profile", authMiddleware.ValidateToken(handleUserProfile))
    
    // 其他服务路由转发
    http.HandleFunc("/api/v1/offers/", authMiddleware.ValidateToken(proxyToOfferService))
    http.HandleFunc("/api/v1/billing/", authMiddleware.ValidateToken(proxyToBillingService))
}
```

### 6. Billing服务 (计费管理)

**职责：** 原子化Token管理和计费处理

**技术栈：** Go + Cloud Run + PostgreSQL

**核心特性：**
- **双分录账本**：balance/hold/expense分离
- **原子操作**：reserve → commit/release机制
- **事务保障**：outbox模式确保一致性

**API设计：**
```go
// 计费管理API
GET    /api/v1/billing/balance          // 查询账户余额
POST   /api/v1/billing/reserve          // 预留Token
POST   /api/v1/billing/commit           // 确认扣费
POST   /api/v1/billing/release          // 释放预留
GET    /api/v1/billing/transactions     // 查询交易记录
POST   /api/v1/billing/recharge         // Token充值
```

**账本模型：**
```go
type Account struct {
    UserID          string `json:"user_id"`
    AvailableBalance int   `json:"available_balance"`
    ReservedBalance  int   `json:"reserved_balance"`
    TotalExpense     int   `json:"total_expense"`
}

type Transaction struct {
    ID          string    `json:"id"`
    UserID      string    `json:"user_id"`
    Type        string    `json:"type"` // reserve/commit/release/recharge
    Amount      int       `json:"amount"`
    RequestID   string    `json:"request_id"`
    Description string    `json:"description"`
    CreatedAt   time.Time `json:"created_at"`
}
```

### 7. Offer服务 (Offer管理)

**职责：** Offer生命周期管理和状态流转

**技术栈：** Go + Cloud Run + Firestore

**API设计：**
```go
// Offer管理API
POST   /api/v1/offers                   // 创建Offer
GET    /api/v1/offers                   // 获取Offer列表
GET    /api/v1/offers/{id}              // 获取Offer详情
PUT    /api/v1/offers/{id}/status       // 更新Offer状态
DELETE /api/v1/offers/{id}              // 删除Offer
POST   /api/v1/offers/batch             // 批量创建Offer
GET    /api/v1/offers/{id}/history      // 获取状态历史
```

### 8. Siterank服务 (评估分析 + AI预警)

**职责：** Offer智能评估、市场分析、风险识别和智能预警

**技术栈：** Go + Cloud Run + SimilarWeb API + Firebase AI Logic + 规则引擎

**核心特性：**
- **10秒SLO**：分阶段返回结果，支持降级
- **并行处理**：域名解析、SimilarWeb、AI分析并行
- **缓存策略**：评估结果缓存，避免重复计算
- **集成AI预警**：风险识别、智能建议、相似机会发现

**API设计：**
```go
// 评估分析API
POST   /api/v1/siterank/evaluate        // 启动评估 (返回202 + analysisId)
GET    /api/v1/siterank/analysis/{id}   // 查询评估进度和结果
GET    /api/v1/siterank/similar/{id}    // 获取相似机会
POST   /api/v1/siterank/batch-evaluate  // 批量评估

// 集成AI预警API
GET    /api/v1/siterank/alerts          // 获取预警列表
POST   /api/v1/siterank/alerts/acknowledge // 确认预警
GET    /api/v1/siterank/suggestions     // 获取优化建议
POST   /api/v1/siterank/suggestions/apply // 应用建议
GET    /api/v1/siterank/insights        // 获取AI洞察
POST   /api/v1/siterank/analyze-content // Firebase AI内容分析
POST   /api/v1/siterank/compliance-check // Firebase AI合规检查
```

**集成AI预警功能实现：**
```go
// AI预警模块
type AIAlertsModule struct {
    ruleEngine    *RiskRuleEngine
    aiClient      *FirebaseAIClient
    similarWeb    *SimilarWebClient
}

type RiskRuleEngine struct {
    rules map[string]*RiskRule
}

type RiskRule struct {
    ID         string                 `json:"id"`
    Name       string                 `json:"name"`
    Conditions map[string]interface{} `json:"conditions"`
    Severity   string                 `json:"severity"` // low, medium, high, critical
    Action     string                 `json:"action"`   // alert, pause, stop
    Enabled    bool                   `json:"enabled"`
}

// 风险检测实现
func (ai *AIAlertsModule) DetectRisks(offer *Offer) ([]*RiskAlert, error) {
    var alerts []*RiskAlert
    
    // 1. 落地页可用性检测
    if availability, err := ai.checkLandingPageAvailability(offer.URL); err != nil || !availability.Available {
        alerts = append(alerts, &RiskAlert{
            Type:     "landing_page_unavailable",
            Severity: "high",
            Message:  "落地页无法访问或加载异常",
            Details:  availability,
        })
    }
    
    // 2. 合规风险分析
    if compliance, err := ai.aiClient.CheckCompliance(offer.URL); err == nil && compliance.HasRisk {
        alerts = append(alerts, &RiskAlert{
            Type:     "compliance_risk",
            Severity: compliance.Severity,
            Message:  compliance.Message,
            Details:  compliance.Details,
        })
    }
    
    // 3. 季节性波动预警
    if seasonal, err := ai.analyzeSeasonal(offer); err == nil && seasonal.HasRisk {
        alerts = append(alerts, &RiskAlert{
            Type:     "seasonal_risk",
            Severity: "medium",
            Message:  "检测到季节性流量下降趋势",
            Details:  seasonal,
        })
    }
    
    return alerts, nil
}

// 相似机会发现
func (ai *AIAlertsModule) FindSimilarOpportunities(offer *Offer) ([]*SimilarOpportunity, error) {
    // 基于成功Offer特征分析
    if offer.ROSC <= 2.0 {
        return nil, nil // 仅为高价值Offer推荐相似机会
    }
    
    // 使用SimilarWeb API获取相似域名
    similar, err := ai.similarWeb.GetSimilarDomains(offer.Domain, offer.Country)
    if err != nil {
        return nil, err
    }
    
    var opportunities []*SimilarOpportunity
    for _, domain := range similar.Domains {
        // 快速评估相似域名
        score, err := ai.quickEvaluate(domain, offer.Country)
        if err != nil {
            continue
        }
        
        if score >= 70 { // 仅推荐高分机会
            opportunities = append(opportunities, &SimilarOpportunity{
                Domain:      domain,
                Score:       score,
                Similarity:  domain.Similarity,
                Reason:      fmt.Sprintf("与成功Offer %s 相似度 %.1f%%", offer.Name, domain.Similarity*100),
                ActionURL:   fmt.Sprintf("/offers/create?url=%s", domain.URL),
            })
        }
    }
    
    return opportunities, nil
}
```

### 9. Batchopen服务 (批量操作)

**职责：** 批量操作编排和执行

**技术栈：** Go + Cloud Run + Google Ads API

**核心特性：**
- **变更计划**：干跑预览 → 执行确认
- **分级重试**：失败任务自动重试和局部回滚
- **审计快照**：操作前后状态对比

**API设计：**
```go
// 批量操作API
POST   /api/v1/batch/plan               // 创建变更计划
POST   /api/v1/batch/validate           // 干跑验证
POST   /api/v1/batch/execute            // 执行变更
GET    /api/v1/batch/operations/{id}    // 查询操作状态
POST   /api/v1/batch/rollback/{id}      // 回滚操作
GET    /api/v1/batch/audit/{id}         // 获取审计快照
```

### 10. Adscenter服务 (广告中心 + 数据同步)

**职责：** Google Ads集成、Pre-flight检查、批量操作和数据同步

**技术栈：** Go + Cloud Run + Google Ads API + Cloud SQL + Cloud Scheduler

**核心特性：**
- **Live/Stub分离**：build tag控制真实/模拟模式
- **OAuth治理**：AES-GCM加密 + 状态机管理
- **配额管理**：QPS限制 + 并发控制
- **集成数据同步**：增量同步 + 多账户聚合 + 实时仪表盘

**API设计：**
```go
// 广告中心API
POST   /api/v1/adscenter/connect        // 连接Ads账户
GET    /api/v1/adscenter/accounts       // 获取账户列表
POST   /api/v1/adscenter/preflight      // Pre-flight检查
POST   /api/v1/adscenter/bulk-actions   // 批量操作
GET    /api/v1/adscenter/oauth/url      // OAuth授权URL
POST   /api/v1/adscenter/oauth/callback // OAuth回调

// 集成数据同步API
POST   /api/v1/adscenter/sync/trigger   // 触发数据同步
GET    /api/v1/adscenter/sync/status    // 获取同步状态
GET    /api/v1/adscenter/sync/dashboard // 获取仪表盘数据
GET    /api/v1/adscenter/sync/trends    // 获取趋势数据
POST   /api/v1/adscenter/sync/accounts/connect // 连接Google Ads账户
GET    /api/v1/adscenter/sync/quota     // 获取API配额使用情况
```

**集成数据同步功能实现：**
```go
// 数据同步模块
type DataSyncModule struct {
    adsClient     *GoogleAdsClient
    db           *sql.DB
    scheduler    *CloudScheduler
    quotaManager *QuotaManager
}

type SyncTask struct {
    ID          string    `json:"id"`
    Type        string    `json:"type"`        // incremental, full
    AccountIDs  []string  `json:"account_ids"`
    Status      string    `json:"status"`      // pending, running, completed, failed
    Progress    int       `json:"progress"`    // 0-100
    StartedAt   time.Time `json:"started_at"`
    CompletedAt *time.Time `json:"completed_at,omitempty"`
    ErrorMsg    string    `json:"error_msg,omitempty"`
}

// 增量数据同步
func (ds *DataSyncModule) IncrementalSync(accountIDs []string) (*SyncTask, error) {
    task := &SyncTask{
        ID:         generateTaskID(),
        Type:       "incremental",
        AccountIDs: accountIDs,
        Status:     "pending",
        StartedAt:  time.Now(),
    }
    
    // 异步执行同步任务
    go ds.executeSyncTask(task)
    
    return task, nil
}

// 执行同步任务
func (ds *DataSyncModule) executeSyncTask(task *SyncTask) {
    task.Status = "running"
    ds.updateTaskStatus(task)
    
    totalAccounts := len(task.AccountIDs)
    for i, accountID := range task.AccountIDs {
        // 检查配额限制
        if !ds.quotaManager.CanMakeRequest() {
            // 等待配额恢复或调整调用频率
            ds.quotaManager.WaitForQuota()
        }
        
        // 同步单个账户数据
        if err := ds.syncAccountData(accountID); err != nil {
            task.ErrorMsg = err.Error()
            task.Status = "failed"
            ds.updateTaskStatus(task)
            return
        }
        
        // 更新进度
        task.Progress = (i + 1) * 100 / totalAccounts
        ds.updateTaskStatus(task)
    }
    
    task.Status = "completed"
    completedAt := time.Now()
    task.CompletedAt = &completedAt
    ds.updateTaskStatus(task)
}

// 多账户数据聚合
func (ds *DataSyncModule) GetAggregatedDashboard(userID string) (*DashboardData, error) {
    // 按Offer维度聚合多账户数据
    query := `
        SELECT 
            o.id as offer_id,
            o.name as offer_name,
            SUM(p.impressions) as total_impressions,
            SUM(p.clicks) as total_clicks,
            SUM(p.cost_micros) as total_cost,
            COUNT(DISTINCT p.account_id) as account_count,
            AVG(p.ctr) as avg_ctr,
            AVG(p.avg_cpc_micros) as avg_cpc
        FROM offers o
        LEFT JOIN ads_performance_history p ON o.id = p.offer_id
        WHERE o.user_id = $1 
        AND p.date >= $2
        GROUP BY o.id, o.name
        ORDER BY total_cost DESC
    `
    
    rows, err := ds.db.Query(query, userID, time.Now().AddDate(0, 0, -30))
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var offers []*OfferPerformance
    for rows.Next() {
        var offer OfferPerformance
        err := rows.Scan(&offer.OfferID, &offer.OfferName, &offer.TotalImpressions,
            &offer.TotalClicks, &offer.TotalCost, &offer.AccountCount,
            &offer.AvgCTR, &offer.AvgCPC)
        if err != nil {
            return nil, err
        }
        offers = append(offers, &offer)
    }
    
    return &DashboardData{
        Offers:      offers,
        LastUpdated: time.Now(),
        Summary:     ds.calculateSummary(offers),
    }, nil
}

// 配额管理器
type QuotaManager struct {
    dailyLimit    int
    currentUsage  int
    resetTime     time.Time
    rateLimiter   *rate.Limiter
}

func (qm *QuotaManager) CanMakeRequest() bool {
    // 检查每日配额
    if qm.currentUsage >= qm.dailyLimit {
        return false
    }
    
    // 检查速率限制
    return qm.rateLimiter.Allow()
}

func (qm *QuotaManager) WaitForQuota() {
    // 智能等待策略
    if qm.currentUsage >= qm.dailyLimit {
        // 等待到第二天重置
        time.Sleep(time.Until(qm.resetTime))
    } else {
        // 等待速率限制恢复
        qm.rateLimiter.Wait(context.Background())
    }
}
```




### 11. 后台管理服务 (Admin Management Service)

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
POST   /api/v1/admin/click-analysis/deploy   // 部署优化策略到浏览器执行服务

// 系统监控API
GET    /api/v1/admin/system/events        // 获取系统异常事件
GET    /api/v1/admin/system/events/{id}   // 获取异常事件详情
PUT    /api/v1/admin/system/events/{id}   // 更新异常事件状态
GET    /api/v1/admin/system/tasks         // 获取定时任务执行结果
GET    /api/v1/admin/system/tasks/{id}    // 获取任务执行详情

// 国际化API
GET    /api/v1/i18n/translations/{lang}   // 获取语言包
PUT    /api/v1/i18n/translations/{lang}   // 更新语言包
GET    /api/v1/i18n/languages             // 获取支持的语言列表

// SEO管理API
GET    /api/v1/seo/sitemap                // 获取站点地图
PUT    /api/v1/seo/meta/{page}            // 更新页面SEO信息
GET    /api/v1/seo/pages                  // 获取所有页面SEO配置
```

### 12. 统一通知管理服务 (Notification Service)

**职责：** 提供完整的通知管理功能，包括事件监听、通知生成、分发和用户通知中心

**技术栈：** Go + Cloud Run + Pub/Sub + Firestore + PostgreSQL

**架构设计：**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Notification Service                        │
│                    (独立Cloud Run服务)                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │  规则引擎       │ │  通知分发器     │ │  通知管理器     │   │
│  │ Rule Engine     │ │  Dispatcher     │ │  Manager        │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│              事件总线 (现有Pub/Sub)                              │
│         监听业务事件 → 触发通知规则 → 生成通知                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                   分层存储                                      │
│  ┌─────────────────┐ ┌─────────────────┐                       │
│  │   Firestore     │ │   PostgreSQL    │                       │
│  │  实时缓存(30天)  │ │  完整历史存储   │                       │
│  └─────────────────┘ └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

**核心功能：**
- 事件驱动的通知规则引擎
- 多渠道通知分发（应用内/Push/Email/SMS）
- 分层存储策略（实时缓存+历史存储）
- 用户通知中心完整功能
- 通知规则和模板管理
- 通知统计和监控

**API设计：**
```go
// 用户通知API
GET    /api/v1/notifications              // 获取通知列表（支持分页、筛选）
GET    /api/v1/notifications/summary      // 获取通知统计
PUT    /api/v1/notifications/{id}/read    // 标记单个通知已读
PUT    /api/v1/notifications/batch        // 批量操作通知
PUT    /api/v1/notifications/mark-all-read // 全部标记已读
DELETE /api/v1/notifications/{id}         // 删除通知
GET    /api/v1/notifications/categories   // 获取通知分类

// 管理员通知配置API
GET    /api/v1/admin/notification-rules   // 获取通知规则
POST   /api/v1/admin/notification-rules   // 创建通知规则
PUT    /api/v1/admin/notification-rules/{id} // 更新通知规则
DELETE /api/v1/admin/notification-rules/{id} // 删除通知规则
GET    /api/v1/admin/notification-channels // 获取通知渠道配置
PUT    /api/v1/admin/notification-channels // 更新通知渠道配置
GET    /api/v1/admin/notification-stats   // 获取通知统计数据
POST   /api/v1/admin/notification-test    // 测试通知规则
```

**核心组件实现：**
```go
// 通知服务主体
type NotificationService struct {
    ruleEngine    *NotificationRuleEngine
    eventListener *EventListener
    dispatcher    *NotificationDispatcher
    storage       *NotificationStorage
    api          *NotificationAPI
}

// 通知规则引擎
type NotificationRuleEngine struct {
    rules map[string]*NotificationRule
}

type NotificationRule struct {
    ID         string                 `json:"id"`
    EventType  string                 `json:"event_type"`
    Conditions map[string]interface{} `json:"conditions"`
    Template   NotificationTemplate   `json:"template"`
    Channels   []string               `json:"channels"`
    Priority   string                 `json:"priority"`
    Throttling *ThrottlingConfig      `json:"throttling,omitempty"`
    Enabled    bool                   `json:"enabled"`
}

type NotificationTemplate struct {
    TitleTemplate   string `json:"title_template"`
    MessageTemplate string `json:"message_template"`
    ActionURL       string `json:"action_url,omitempty"`
    ActionLabel     string `json:"action_label,omitempty"`
}

// 事件监听器
type EventListener struct {
    subscriptions map[string]*pubsub.Subscription
}

// 监听的业务事件
var BusinessEvents = []string{
    "OfferStatusChanged",
    "SiterankCompleted", 
    "BatchopenTaskCompleted",
    "TokenReserved",
    "RiskDetected",
    "AdsPreflightCompleted",
    "BulkOperationCompleted",
}

// 通知分发器
type NotificationDispatcher struct {
    channels map[string]NotificationChannel
}

type NotificationChannel interface {
    Send(notification *Notification) error
    GetType() string
}

// 支持的通知渠道
type InAppChannel struct{}      // 应用内通知
type PushChannel struct{}       // 推送通知(预留)
type EmailChannel struct{}      // 邮件通知(预留)
type SMSChannel struct{}        // 短信通知(预留)

// 通知存储管理
type NotificationStorage struct {
    firestore *firestore.Client
    postgres  *sql.DB
}

type UserNotification struct {
    ID           int64     `json:"id"`
    UserID       string    `json:"user_id"`
    Type         string    `json:"type"`
    Category     string    `json:"category"`
    Title        string    `json:"title"`
    Message      string    `json:"message"`
    ActionURL    *string   `json:"action_url,omitempty"`
    ActionLabel  *string   `json:"action_label,omitempty"`
    Priority     string    `json:"priority"`
    Status       string    `json:"status"`
    Metadata     *string   `json:"metadata,omitempty"`
    CreatedAt    time.Time `json:"created_at"`
    ReadAt       *time.Time `json:"read_at,omitempty"`
    ArchivedAt   *time.Time `json:"archived_at,omitempty"`
}

// 通知规则示例
var ExampleNotificationRules = []NotificationRule{
    {
        ID: "offer_declined_5_days",
        EventType: "OfferStatusChanged",
        Conditions: map[string]interface{}{
            "status": "declining",
            "reason": "zero_performance_5_days",
        },
        Template: NotificationTemplate{
            TitleTemplate: "Offer自动转入衰退期",
            MessageTemplate: "您的Offer {{.OfferName}} 连续5天无曝光无点击，已自动转入衰退期",
            ActionURL: "/offers/{{.OfferID}}",
            ActionLabel: "查看详情",
        },
        Channels: []string{"in_app"},
        Priority: "high",
        Enabled: true,
    },
    {
        ID: "evaluation_high_score",
        EventType: "SiterankCompleted",
        Conditions: map[string]interface{}{
            "score": map[string]interface{}{"gte": 80},
        },
        Template: NotificationTemplate{
            TitleTemplate: "发现高价值Offer！",
            MessageTemplate: "{{.OfferURL}} 评分达到 {{.Score}} 分，建议立即启动仿真",
            ActionURL: "/offers/{{.OfferID}}/simulate",
            ActionLabel: "立即仿真",
        },
        Channels: []string{"in_app"},
        Priority: "high",
        Enabled: true,
    },
}
```

**数据模型设计：**

**PostgreSQL通知表：**
```sql
-- 用户通知表（完整历史）
CREATE TABLE user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    category VARCHAR(20) NOT NULL,         -- offer, evaluation, risk, billing, system
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    action_label VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
    status VARCHAR(20) DEFAULT 'unread',   -- unread, read, archived, deleted
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP NULL,
    archived_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    
    INDEX idx_user_status_created (user_id, status, created_at DESC),
    INDEX idx_user_category_created (user_id, category, created_at DESC),
    INDEX idx_user_created (user_id, created_at DESC)
);

-- 通知规则配置表
CREATE TABLE notification_rules (
    id BIGSERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL,
    template JSONB NOT NULL,
    channels JSONB NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    throttling JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 用户通知统计表
CREATE TABLE user_notification_stats (
    user_id VARCHAR(50) PRIMARY KEY,
    total_count INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    last_notification_at TIMESTAMP,
    category_stats JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Firestore实时缓存：**
```javascript
// /users/{userId}/notifications/{notificationId} - 仅最近30天
{
  id: string,
  type: string,
  category: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string,
  priority: "low" | "normal" | "high" | "critical",
  status: "unread" | "read" | "archived",
  createdAt: timestamp,
  readAt?: timestamp,
  metadata?: object
}

// /users/{userId}/notification_summary - 实时统计
{
  totalCount: number,
  unreadCount: number,
  lastNotificationAt: timestamp,
  categories: {
    offer: { total: number, unread: number, lastAt: timestamp },
    evaluation: { total: number, unread: number, lastAt: timestamp },
    risk: { total: number, unread: number, lastAt: timestamp },
    billing: { total: number, unread: number, lastAt: timestamp }
  }
}
```

**服务集成设计：**

**事件监听集成：**
```go
// 通知服务监听的业务事件映射
var EventNotificationMapping = map[string][]string{
    "OfferStatusChanged": {
        "offer_status_auto_changed",    // 自动状态转换
        "offer_status_manual_changed",  // 手动状态变更
        "offer_rosc_breakthrough",      // ROSC突破
    },
    "SiterankCompleted": {
        "evaluation_high_score",        // 高分评估
        "evaluation_completed",         // 评估完成
    },
    "BatchopenTaskCompleted": {
        "simulation_completed",         // 仿真完成
        "simulation_failed",           // 仿真失败
    },
    "TokenReserved": {
        "token_low_balance",           // 余额不足
        "token_debit_failed",          // 扣费失败
    },
    "RiskDetected": {
        "ads_account_suspended",       // 账号风险
        "landing_page_unavailable",    // 落地页问题
        "budget_insufficient",         // 预算不足
    },
}
```

**与现有服务的API集成：**
```go
// 通知服务调用其他服务的接口
type ServiceIntegration struct {
    offerService    OfferServiceClient
    billingService  BillingServiceClient
    userService     UserServiceClient
}

// 获取通知相关的业务数据
func (si *ServiceIntegration) GetNotificationContext(event *BusinessEvent) (*NotificationContext, error) {
    switch event.Type {
    case "OfferStatusChanged":
        offer, err := si.offerService.GetOffer(event.OfferID)
        if err != nil {
            return nil, err
        }
        return &NotificationContext{
            OfferName: offer.Name,
            OfferID:   offer.ID,
            UserID:    offer.UserID,
        }, nil
    case "TokenReserved":
        balance, err := si.billingService.GetBalance(event.UserID)
        if err != nil {
            return nil, err
        }
        return &NotificationContext{
            UserID:      event.UserID,
            TokenBalance: balance.Available,
        }, nil
    }
    return nil, nil
}
```

**前端集成设计：**
```typescript
// 前端通知中心组件集成
interface NotificationCenterProps {
  userId: string;
  realTimeUpdates?: boolean;
  maxDisplayCount?: number;
}

// 实时通知更新机制
class NotificationManager {
  private websocket: WebSocket;
  private pollingInterval: number = 30000; // 30秒轮询备用
  
  // WebSocket实时更新
  connectRealTime(userId: string) {
    this.websocket = new WebSocket(`/api/v1/notifications/ws?user_id=${userId}`);
    this.websocket.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      this.updateNotificationUI(notification);
    };
  }
  
  // 轮询备用机制
  startPolling(userId: string) {
    setInterval(() => {
      this.fetchLatestNotifications(userId);
    }, this.pollingInterval);
  }
}
```

## 
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

// /configs/i18n_settings
{
  defaultLanguage: "zh",
  supportedLanguages: ["zh", "en"],
  translations: {
    "zh": {
      "common.save": "保存",
      "common.cancel": "取消",
      "offer.status.pool": "机会池",
      // ... 更多翻译
    },
    "en": {
      "common.save": "Save",
      "common.cancel": "Cancel", 
      "offer.status.pool": "Opportunity Pool",
      // ... 更多翻译
    }
  },
  aiPrompts: {
    "zh": {
      "evaluation": "请分析以下Offer的投放价值...",
      "optimization": "请为以下广告数据提供优化建议..."
    },
    "en": {
      "evaluation": "Please analyze the advertising value of the following Offer...",
      "optimization": "Please provide optimization suggestions for the following ad data..."
    }
  }
}

// /configs/seo_settings
{
  pages: {
    "/": {
      "zh": {
        title: "上瘾式广告管理系统 - 智能Google Ads多账户管理平台",
        description: "专业的Google Ads多账户管理系统，提供智能Offer评估、批量操作、AI预警等功能",
        keywords: "Google Ads, 广告管理, 多账户, AI优化, 批量操作"
      },
      "en": {
        title: "Addictive Ads Management System - Intelligent Google Ads Multi-Account Platform",
        description: "Professional Google Ads multi-account management system with intelligent Offer evaluation, bulk operations, AI alerts",
        keywords: "Google Ads, Ad Management, Multi-Account, AI Optimization, Bulk Operations"
      }
    },
    "/about": {
      "zh": {
        title: "关于我们 - 上瘾式广告管理系统",
        description: "了解上瘾式广告管理系统的产品理念、核心功能和技术优势"
      },
      "en": {
        title: "About Us - Addictive Ads Management System", 
        description: "Learn about the product philosophy, core features and technical advantages"
      }
    }
  },
  sitemap: {
    changefreq: "weekly",
    priority: 0.8,
    lastmod: "auto"
  }
}
```

### Cloud SQL 数据结构

#### 1. 事件存储与Outbox表（企业级一次成型）

```sql
-- 事件存储表 (ULID + 分区)
CREATE TABLE event_store (
    event_id CHAR(26) PRIMARY KEY,           -- ULID单调递增
    aggregate_type VARCHAR(50) NOT NULL,     -- Offer, User, Task等
    aggregate_id VARCHAR(50) NOT NULL,       -- 聚合根ID
    version INTEGER NOT NULL,                -- 事件版本
    user_id VARCHAR(50) NOT NULL,            -- 用户ID (RLS隔离)
    occurred_at TIMESTAMPTZ DEFAULT NOW(),   -- 事件发生时间
    correlation_id VARCHAR(50),              -- 关联ID
    causation_id VARCHAR(50),                -- 因果ID
    schema_version INTEGER DEFAULT 1,        -- 事件模式版本
    payload JSONB NOT NULL,                  -- 事件数据
    headers JSONB,                           -- 事件头信息
    
    -- 关键索引
    INDEX idx_aggregate (aggregate_type, aggregate_id, version),
    INDEX idx_user_occurred (user_id, occurred_at DESC),
    INDEX idx_occurred (occurred_at DESC)
) PARTITION BY RANGE (EXTRACT(EPOCH FROM occurred_at)::BIGINT);

-- 按周分区 (示例)
CREATE TABLE event_store_2024_w01 PARTITION OF event_store
    FOR VALUES FROM (1704067200) TO (1704672000);

-- Outbox表 (确保事件发布的最终一致性)
CREATE TABLE outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id CHAR(26) NOT NULL UNIQUE,      -- 关联event_store
    topic VARCHAR(100) NOT NULL,            -- Pub/Sub主题
    payload JSONB NOT NULL,                 -- 发布载荷
    status VARCHAR(20) DEFAULT 'pending',   -- pending, published, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    INDEX idx_status_created (status, created_at),
    INDEX idx_event_id (event_id)
);

-- 读模型表 (启用RLS)
CREATE TABLE offers (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,           -- RLS隔离字段
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    country VARCHAR(2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    rosc DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_user_status (user_id, status),
    INDEX idx_user_created (user_id, created_at DESC)
);

-- 启用RLS
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_user_isolation ON offers
    FOR ALL TO PUBLIC
    USING (user_id = current_setting('app.user_id'));

-- 通知表 (启用RLS)
CREATE TABLE user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,           -- RLS隔离字段
    notification_type VARCHAR(50) NOT NULL,
    category VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    action_label VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'unread',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    INDEX idx_user_status_created (user_id, status, created_at DESC),
    INDEX idx_user_category_created (user_id, category, created_at DESC)
);

-- 启用RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_user_isolation ON user_notifications
    FOR ALL TO PUBLIC
    USING (user_id = current_setting('app.user_id'));
```

#### 2. 历史数据表

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

-- 系统异常事件表
CREATE TABLE system_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('business_risk', 'system_risk', 'api_limit', 'service_error') NOT NULL,
    event_category VARCHAR(50) NOT NULL, -- account_suspended, url_parsing_failed, etc.
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    affected_resources JSON, -- 受影响的资源ID列表
    status ENUM('open', 'investigating', 'resolved', 'ignored') DEFAULT 'open',
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_type_severity (event_type, severity),
    INDEX idx_status_created (status, created_at),
    INDEX idx_category (event_category)
);

-- 定时任务执行记录表
CREATE TABLE scheduled_task_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_name VARCHAR(100) NOT NULL,
    task_type ENUM('click_simulation', 'link_rotation', 'data_sync', 'cleanup') NOT NULL,
    execution_id VARCHAR(50) NOT NULL, -- 执行批次ID
    status ENUM('running', 'completed', 'failed', 'timeout') NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    processed_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    error_details JSON NULL,
    logs TEXT NULL,
    INDEX idx_task_status (task_name, status),
    INDEX idx_execution_id (execution_id),
    INDEX idx_started_at (started_at)
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
- **国际化：** next-i18next
- **移动端适配：** Ant Design Mobile
- **部署：** Firebase Hosting (独立子域名)

#### 共享技术栈
- **国际化：** next-i18next + react-i18next
- **SEO优化：** next-seo + next-sitemap
- **移动端适配：** 响应式设计 + PWA支持
- **多语言路由：** Next.js i18n routing
- **站点地图：** 自动生成多语言sitemap

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

### 服务与边界

### 外部服务
- **identity**：用户认证与权限管理
- **billing**：套餐管理与原子计费  
- **offer**：Offer生命周期管理
- **siterank**：10秒智能评估分析
- **batchopen**：仿真编排与任务管理
- **adscenter**：Google Ads集成与批量操作
- **workflow**：业务流程编排
- **console**：后台管理系统
- **frontend**：用户前端界面

### 新增执行器
- **browser-exec**：Node.js 22 + Playwright，常驻独立Cloud Run

## API契约与网关

### OpenAPI-first流程
1. **.kiro规范输出OpenAPI**（所有域）
2. **生成Go server stubs与TS SDK**
3. **CI契约测试**
4. **自动渲染API Gateway**

### 统一路由形态（/api/v1）

#### Identity服务
```
POST /api/v1/identity/register
GET  /api/v1/identity/me
POST /api/v1/identity/refresh
```

#### Offer服务  
```
GET  /api/v1/offers
POST /api/v1/offers
GET  /api/v1/offers/{id}
PUT  /api/v1/offers/{id}
```

#### Siterank服务
```
POST /api/v1/siterank/analyze     # 202返回analysisId
GET  /api/v1/siterank/{offerId}   # 最新结果
```

#### Adscenter服务
```
GET  /api/v1/adscenter/accounts
POST /api/v1/adscenter/preflight
POST /api/v1/adscenter/bulk-actions
GET  /api/v1/adscenter/oauth/url
POST /api/v1/adscenter/oauth/callback  # 回调免鉴权
```

#### Batchopen服务
```
POST /api/v1/batchopen/tasks      # 202返回taskId  
GET  /api/v1/batchopen/tasks/{id}
```

#### Billing服务
```
GET /api/v1/billing/subscriptions/me
GET /api/v1/billing/tokens/me
GET /api/v1/billing/tokens/transactions
```

#### Workflow服务
```
GET  /api/v1/workflows/templates
POST /api/v1/workflows/start      # 202返回workflow_instance_id
GET  /api/v1/workflows/{id}
```

### 统一错误体
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input parameters", 
  "details": {
    "field": "email",
    "reason": "Invalid email format"
  },
  "traceId": "abc123"
}
```

### 幂等处理
- 所有变更型POST支持`X-Idempotency-Key`
- 基于key去重，相同key返回相同结果

## 鉴权与安全

### 统一认证
- **所有受保护接口**：Firebase Bearer Token
- **Console访问**：role=ADMIN验证
- **白名单管理**：OAuth回调与健康检查

### 机密治理
- **密钥存储**：仅Secret Manager，禁止明文
- **Ads刷新令牌**：AES-GCM(256)加密
- **OAuth状态**：state HMAC + 回调域白名单
- **数据隔离**：user_id强隔离，服务端判定状态

### Secret Manager配置
```
DATABASE_URL-{stack}
REFRESH_TOKEN_KEY-{stack}        # AES-GCM 256
OAUTH_STATE_SECRET-{stack}
GOOGLE_ADS_*_{stack}            # developer token / OAuth client / MCC / test id
```

## 数据与事件

### 事件存储（Cloud SQL）
```sql
CREATE TABLE event_store (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL, 
    event_type VARCHAR(100) NOT NULL,
    event_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    trace_id VARCHAR(100),
    UNIQUE(aggregate_id, event_version),
    INDEX (aggregate_id, occurred_at)
);
```

### 标准事件集
- **UserRegistered**、**OfferCreated**
- **SiterankRequested/Completed**  
- **BatchopenTaskQueued/Started/Completed/Failed**
- **AdsPreflightRequested/Completed**
- **TokenReserved/Debited/Reverted**

### 投影器（Cloud Functions）
- 订阅Pub/Sub写Cloud SQL读模型与Firestore UI缓存
- 以事件id/版本做投影幂等

### 读模型（Cloud SQL）
- **User**、**Offer**、**SiterankAnalysis**、**BatchopenTask**
- **UserAdsConnection**、**Subscription**、**UserToken**、**TokenTransaction**、**AuditSnapshot**
- 统一迁移脚本一次到位

### Firestore缓存策略
- 仅作UI实时缓存层（与SQL投影同步写入）
- "SQL为事实来源"

## 企业级架构设计

## 核心域落地

### Siterank（10秒评估）

#### 技术流程
```
Browser-Exec解析URL/品牌 → SimilarWeb拉取 → 评分器（权重表+阈值，KISS） → SiterankCompleted → 投影
```

#### 性能策略
- **并行拉取**：URL解析、SimilarWeb、评分并行执行
- **超时分段**：10秒内返回结果，超时返回"已提交深评"
- **缓存优化**：域名+国家缓存，避免重复计算
- **降级处理**：后台完成后通过投影/通知更新

#### 实现架构
```go
type SiterankService struct {
    browserExec   BrowserExecClient
    similarWeb    SimilarWebClient
    scorer        OfferScorer
    eventBus      EventBus
}

func (s *SiterankService) AnalyzeOffer(ctx context.Context, req *AnalyzeRequest) (*AnalysisResult, error) {
    // 10秒超时控制
    ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()
    
    // 并行执行
    var wg sync.WaitGroup
    var urlInfo *URLInfo
    var trafficData *TrafficData
    var err error
    
    wg.Add(2)
    go func() {
        defer wg.Done()
        urlInfo, _ = s.browserExec.ParseURL(ctx, req.URL)
    }()
    
    go func() {
        defer wg.Done()
        trafficData, _ = s.similarWeb.GetTrafficData(ctx, req.Domain, req.Country)
    }()
    
    wg.Wait()
    
    // 评分计算
    score := s.scorer.Calculate(urlInfo, trafficData)
    
    // 发布事件
    event := &SiterankCompleted{
        OfferID: req.OfferID,
        Score:   score,
        Analysis: map[string]interface{}{
            "url_info": urlInfo,
            "traffic": trafficData,
        },
    }
    
    return &AnalysisResult{Score: score}, s.eventBus.Publish(ctx, event)
}
```

### Browser-Exec（Node.js + Playwright）

#### 核心能力API
```typescript
// /parse-url - URL解析和品牌提取
POST /api/v1/browser/parse-url
{
  "url": "https://affiliate.com/offer/123",
  "country": "US"
}

// /check-availability - 落地页可用性检测  
POST /api/v1/browser/check-availability
{
  "urls": ["https://example.com"],
  "country": "US"
}

// /simulate-click - 点击仿真
POST /api/v1/browser/simulate-click
{
  "url": "https://example.com",
  "pattern": "workday",
  "country": "US"
}

// /batch-execute - 批量执行
POST /api/v1/browser/batch-execute
{
  "tasks": [
    {"type": "parse-url", "url": "...", "country": "US"},
    {"type": "check-availability", "url": "...", "country": "UK"}
  ]
}
```

#### 架构实现
```typescript
class BrowserExecService {
    private browserPool: BrowserPool;
    private proxyManager: ProxyManager;
    
    async parseURL(request: ParseURLRequest): Promise<URLInfo> {
        const browser = await this.browserPool.acquire(request.country);
        const proxy = await this.proxyManager.getProxy(request.country);
        
        try {
            const page = await browser.newPage({
                proxy: proxy,
                userAgent: this.getUserAgent(request.country),
                locale: this.getLocale(request.country)
            });
            
            // 多重重定向处理
            const finalURL = await this.followRedirects(page, request.url);
            const domain = new URL(finalURL).hostname;
            const brand = this.extractBrand(domain);
            
            return {
                originalURL: request.url,
                finalURL: finalURL,
                domain: domain,
                brand: brand,
                country: request.country
            };
        } finally {
            await this.browserPool.release(browser);
            await this.proxyManager.releaseProxy(proxy);
        }
    }
    
    private extractBrand(domain: string): string {
        // nike.com -> nike, amazon.com -> amazon
        const parts = domain.split('.');
        return parts.length >= 2 ? parts[parts.length - 2] : domain;
    }
}

// 代理池管理
class ProxyManager {
    private countryPools: Map<string, ProxyPool>;
    
    async getProxy(country: string): Promise<ProxyInfo> {
        let pool = this.countryPools.get(country);
        if (!pool) {
            pool = new ProxyPool(country);
            this.countryPools.set(country, pool);
        }
        return await pool.acquire();
    }
}

// 浏览器池管理  
class BrowserPool {
    private browsers: Browser[] = [];
    private maxSize = 10;
    
    async acquire(country: string): Promise<Browser> {
        if (this.browsers.length > 0) {
            return this.browsers.pop()!;
        }
        
        return await playwright.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage']
        });
    }
    
    async release(browser: Browser): Promise<void> {
        if (this.browsers.length < this.maxSize) {
            this.browsers.push(browser);
        } else {
            await browser.close();
        }
    }
}
```

### Adscenter（诊断+批量）

#### Pre-flight诊断
```go
type PreflightChecker struct {
    adsClient GoogleAdsClient
}

type CheckResult struct {
    Code     string `json:"code"`
    Severity string `json:"severity"`  // info/warning/error/critical
    Message  string `json:"message"`
    Details  map[string]interface{} `json:"details,omitempty"`
    Summary  string `json:"summary"`
}

func (pc *PreflightChecker) RunChecks(ctx context.Context, accountID string) ([]*CheckResult, error) {
    var results []*CheckResult
    
    // 环境检查
    results = append(results, pc.checkEnvironment()...)
    
    // 授权检查
    results = append(results, pc.checkAuthorization(ctx, accountID)...)
    
    // 结构检查
    results = append(results, pc.checkAccountStructure(ctx, accountID)...)
    
    // 余额检查
    results = append(results, pc.checkBudget(ctx, accountID)...)
    
    // 回传检查
    results = append(results, pc.checkConversionTracking(ctx, accountID)...)
    
    // 落地页检查
    results = append(results, pc.checkLandingPages(ctx, accountID)...)
    
    // Ads API可达性
    results = append(results, pc.checkAPIReachability(ctx)...)
    
    return results, nil
}
```

#### 批量操作
```go
type BatchOperationService struct {
    adsClient    GoogleAdsClient
    eventBus     EventBus
    auditService AuditService
}

func (bos *BatchOperationService) ExecuteBatchOperation(ctx context.Context, plan *ChangePlan) (*BatchResult, error) {
    // 1. validate-only预检
    validateResult, err := bos.validatePlan(ctx, plan)
    if err != nil {
        return nil, err
    }
    
    // 2. 创建审计快照
    snapshot, err := bos.auditService.CreateSnapshot(ctx, plan.TargetAccounts)
    if err != nil {
        return nil, err
    }
    
    // 3. 入队执行（队列/限流/退避）
    taskID := generateTaskID()
    task := &BatchTask{
        ID:       taskID,
        Plan:     plan,
        Snapshot: snapshot,
        Status:   "queued",
    }
    
    // 发布任务事件
    event := &BatchopenTaskQueued{
        TaskID:      taskID,
        UserID:      plan.UserID,
        Operation:   plan.Operation,
        TargetCount: len(plan.Targets),
    }
    
    return &BatchResult{TaskID: taskID}, bos.eventBus.Publish(ctx, event)
}
```

### Billing（原子扣费）

#### Reserve/Commit/Release机制
```go
type BillingService struct {
    tokenRepo TokenRepository
    eventBus  EventBus
}

func (bs *BillingService) ReserveTokens(ctx context.Context, userID string, amount int, operation string) (*Reservation, error) {
    requestID := generateRequestID()
    
    // 检查余额
    balance, err := bs.tokenRepo.GetBalance(ctx, userID)
    if err != nil {
        return nil, err
    }
    
    if balance.Available < amount {
        return nil, ErrInsufficientBalance
    }
    
    // 原子预留
    err = bs.tokenRepo.ReserveTokens(ctx, userID, amount, requestID)
    if err != nil {
        return nil, err
    }
    
    // 发布预留事件
    event := &TokenReserved{
        UserID:    userID,
        Amount:    amount,
        Operation: operation,
        RequestID: requestID,
    }
    
    bs.eventBus.Publish(ctx, event)
    
    return &Reservation{
        RequestID: requestID,
        Amount:    amount,
        ExpiresAt: time.Now().Add(30 * time.Minute),
    }, nil
}

func (bs *BillingService) CommitTokens(ctx context.Context, requestID string) error {
    err := bs.tokenRepo.CommitReservation(ctx, requestID)
    if err != nil {
        return err
    }
    
    // 发布扣费事件
    reservation, _ := bs.tokenRepo.GetReservation(ctx, requestID)
    event := &TokenDebited{
        UserID:    reservation.UserID,
        Amount:    reservation.Amount,
        RequestID: requestID,
    }
    
    return bs.eventBus.Publish(ctx, event)
}

func (bs *BillingService) ReleaseTokens(ctx context.Context, requestID string, reason string) error {
    err := bs.tokenRepo.ReleaseReservation(ctx, requestID)
    if err != nil {
        return err
    }
    
    // 发布释放事件
    reservation, _ := bs.tokenRepo.GetReservation(ctx, requestID)
    event := &TokenReverted{
        UserID:    reservation.UserID,
        Amount:    reservation.Amount,
        RequestID: requestID,
        Reason:    reason,
    }
    
    return bs.eventBus.Publish(ctx, event)
}
```

## 共享底座 (pkg/*)

### pkg/auth - Firebase Bearer中间件
```go
type AuthMiddleware struct {
    firebase *auth.Client
}

func (am *AuthMiddleware) Authenticate(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractBearerToken(r)
        if token == "" {
            writeError(w, http.StatusUnauthorized, "MISSING_TOKEN", "Authorization header required")
            return
        }
        
        idToken, err := am.firebase.VerifyIDToken(r.Context(), token)
        if err != nil {
            writeError(w, http.StatusUnauthorized, "INVALID_TOKEN", "Token verification failed")
            return
        }
        
        // 注入用户上下文
        ctx := context.WithValue(r.Context(), "user_id", idToken.UID)
        ctx = context.WithValue(ctx, "user_email", idToken.Claims["email"])
        
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### pkg/config - Secret Manager + STACK
```go
type Config struct {
    Stack       string
    SecretNames map[string]string
    secrets     map[string]string
}

func LoadConfig(stack string) (*Config, error) {
    config := &Config{
        Stack: stack,
        SecretNames: map[string]string{
            "DATABASE_URL":        fmt.Sprintf("DATABASE_URL-%s", stack),
            "REFRESH_TOKEN_KEY":   fmt.Sprintf("REFRESH_TOKEN_KEY-%s", stack),
            "OAUTH_STATE_SECRET":  fmt.Sprintf("OAUTH_STATE_SECRET-%s", stack),
        },
        secrets: make(map[string]string),
    }
    
    // 从Secret Manager加载
    client, err := secretmanager.NewClient(context.Background())
    if err != nil {
        return nil, err
    }
    
    for key, secretName := range config.SecretNames {
        secret, err := client.AccessSecretVersion(context.Background(), &secretmanagerpb.AccessSecretVersionRequest{
            Name: fmt.Sprintf("projects/%s/secrets/%s/versions/latest", getProjectID(), secretName),
        })
        if err != nil {
            return nil, err
        }
        config.secrets[key] = string(secret.Payload.Data)
    }
    
    return config, nil
}
```

### pkg/events - 发布/订阅 + 幂等
```go
type EventBus struct {
    pubsub       *pubsub.Client
    topicName    string
    idempotency  IdempotencyManager
}

func (eb *EventBus) Publish(ctx context.Context, event Event) error {
    // 幂等检查
    if eb.idempotency.IsProcessed(event.EventID()) {
        return nil
    }
    
    // 序列化事件
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }
    
    // 发布到Pub/Sub
    topic := eb.pubsub.Topic(eb.topicName)
    result := topic.Publish(ctx, &pubsub.Message{
        Data: data,
        Attributes: map[string]string{
            "event_type":    event.EventType(),
            "aggregate_id":  event.AggregateID(),
            "trace_id":     getTraceID(ctx),
        },
    })
    
    // 等待发布完成
    _, err = result.Get(ctx)
    if err != nil {
        return err
    }
    
    // 标记已处理
    return eb.idempotency.MarkProcessed(event.EventID())
}
```

### pkg/http - 统一错误码/重试/限流
```go
type ErrorResponse struct {
    Code    string      `json:"code"`
    Message string      `json:"message"`
    Details interface{} `json:"details,omitempty"`
    TraceID string      `json:"traceId"`
}

func WriteError(w http.ResponseWriter, statusCode int, code, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(statusCode)
    
    response := ErrorResponse{
        Code:    code,
        Message: message,
        TraceID: getTraceIDFromContext(w),
    }
    
    json.NewEncoder(w).Encode(response)
}

type HTTPClient struct {
    client      *http.Client
    retryPolicy RetryPolicy
    rateLimiter RateLimiter
}

func (hc *HTTPClient) Do(req *http.Request) (*http.Response, error) {
    // 限流检查
    if err := hc.rateLimiter.Wait(req.Context()); err != nil {
        return nil, err
    }
    
    // 重试机制
    return hc.retryPolicy.Execute(func() (*http.Response, error) {
        return hc.client.Do(req)
    })
}
```

### pkg/telemetry - 日志/指标/追踪
```go
type Logger struct {
    logger *slog.Logger
}

func (l *Logger) Info(ctx context.Context, msg string, fields ...Field) {
    attrs := []slog.Attr{
        slog.String("trace_id", getTraceID(ctx)),
        slog.String("user_id", getUserID(ctx)),
        slog.String("service", getServiceName()),
        slog.String("version", getVersion()),
        slog.String("stack", getStack()),
    }
    
    for _, field := range fields {
        attrs = append(attrs, slog.Any(field.Key, field.Value))
    }
    
    l.logger.LogAttrs(ctx, slog.LevelInfo, msg, attrs...)
}

type Metrics struct {
    registry *prometheus.Registry
}

func (m *Metrics) Counter(name string) prometheus.Counter {
    counter := prometheus.NewCounter(prometheus.CounterOpts{
        Name: name,
        Help: fmt.Sprintf("Counter for %s", name),
    })
    m.registry.MustRegister(counter)
    return counter
}
```

### 事件驱动架构核心

#### 事件存储设计

```sql
-- PostgreSQL事件存储表
CREATE TABLE event_store (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trace_id VARCHAR(100),
    UNIQUE(aggregate_id, event_version),
    INDEX idx_aggregate_occurred (aggregate_id, occurred_at),
    INDEX idx_event_type (event_type),
    INDEX idx_trace_id (trace_id)
);
```

#### 核心事件定义

```go
// 最小事件集
type Event interface {
    EventID() string
    EventType() string
    AggregateID() string
    Version() int
    OccurredAt() time.Time
    Payload() interface{}
}

// 用户事件
type UserRegistered struct {
    UserID    string `json:"user_id"`
    Email     string `json:"email"`
    Plan      string `json:"plan"`
    CreatedAt time.Time `json:"created_at"`
}

// Offer事件
type OfferCreated struct {
    OfferID   string `json:"offer_id"`
    UserID    string `json:"user_id"`
    URL       string `json:"url"`
    Country   string `json:"country"`
    CreatedAt time.Time `json:"created_at"`
}

// 评估事件
type SiterankRequested struct {
    RequestID string `json:"request_id"`
    OfferID   string `json:"offer_id"`
    UserID    string `json:"user_id"`
}

type SiterankCompleted struct {
    RequestID string `json:"request_id"`
    OfferID   string `json:"offer_id"`
    Score     int    `json:"score"`
    Analysis  map[string]interface{} `json:"analysis"`
}

// 批量操作事件
type BatchTaskQueued struct {
    TaskID      string `json:"task_id"`
    UserID      string `json:"user_id"`
    Operation   string `json:"operation"`
    TargetCount int    `json:"target_count"`
}

type BatchTaskCompleted struct {
    TaskID       string `json:"task_id"`
    SuccessCount int    `json:"success_count"`
    FailureCount int    `json:"failure_count"`
}

// Token事件
type TokenReserved struct {
    UserID    string `json:"user_id"`
    Amount    int    `json:"amount"`
    Operation string `json:"operation"`
    RequestID string `json:"request_id"`
}

type TokenDebited struct {
    UserID    string `json:"user_id"`
    Amount    int    `json:"amount"`
    RequestID string `json:"request_id"`
}

type TokenReverted struct {
    UserID    string `json:"user_id"`
    Amount    int    `json:"amount"`
    RequestID string `json:"request_id"`
    Reason    string `json:"reason"`
}
```

## 微服务组件设计

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
    clickRepo           ClickRepository
    aiService           *FirebaseAIService
    configManager       *ConfigManager
    browserExecutorAPI  BrowserExecutorAPIClient
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
    // 将优化策略推送到浏览器执行服务
    deployRequest := &StrategyDeployRequest{
        OfferID:  strategy.OfferID,
        Patterns: strategy.Patterns,
        Version:  time.Now().Unix(),
    }
    
    return cas.browserExecutorAPI.UpdateClickStrategy(ctx, deployRequest)
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