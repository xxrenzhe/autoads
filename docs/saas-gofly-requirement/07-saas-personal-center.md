# SaaS用户个人中心设计

## 1. 概述

### 1.1 设计目标

为SaaS用户提供一个功能完善的个人中心，集中管理账户信息、订阅状态、Token余额、邀请和签到等功能，确保数据更新及时，用户体验流畅。

### 1.2 核心特性

- **统一入口**：一个页面整合所有用户功能
- **实时更新**：数据变化即时反映到界面
- **模块化设计**：各功能模块独立，易于维护
- **响应式布局**：适配各种设备屏幕

## 2. 整体架构

### 2.1 页面结构

```
个人中心
├── 欢迎信息区（用户信息、套餐状态、Token余额）
├── 统计卡片区（本月查询、剩余Token、本月签到、邀请好友）
├── 标签导航区（概览、个人信息、套餐管理、Token明细、邀请好友、每日签到）
└── 功能内容区（根据标签显示相应内容）
```

### 2.2 技术架构

- **前端**：React + TypeScript + Material-UI
- **状态管理**：React Hooks + Context API
- **实时通信**：WebSocket + 自定义事件
- **数据获取**：RESTful API + 轮询更新

## 3. 功能模块设计

### 3.1 概览模块（DashboardOverview）

**功能描述**
展示用户的核心数据概览，包括套餐状态、Token余额、最近活动等。

**组件结构**
```jsx
const DashboardOverview = ({ user, stats }) => {
    return (
        <Grid container spacing={3}>
            {/* 套餐状态卡片 */}
            <Grid item xs={12} md={6}>
                <SubscriptionStatusCard user={user} />
            </Grid>
            
            {/* Token余额卡片 */}
            <Grid item xs={12} md={6}>
                <TokenBalanceCard user={user} />
            </Grid>
            
            {/* 最近活动 */}
            <Grid item xs={12}>
                <RecentActivities userId={user?.id} />
            </Grid>
        </Grid>
    );
};
```

**数据更新策略**
- 页面加载时获取
- 用户操作后触发刷新
- 每5分钟自动更新

### 3.2 个人信息模块（ProfileInfo）

**功能描述**
管理用户的基本个人信息，包括邮箱、姓名、公司等。

**字段设计**
```go
type UserProfile struct {
    ID        string `json:"id"`
    Email     string `json:"email" gorm:"uniqueIndex"`
    Name      string `json:"name"`
    Company   string `json:"company"`
    Avatar    string `json:"avatar"`
    Phone     string `json:"phone"`
    Address   string `json:"address"`
    TimeZone  string `json:"time_zone" gorm:"default:'Asia/Shanghai'"`
    Language  string `json:"language" gorm:"default:'zh-CN'"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

**API接口**
- `GET /api/v1/user/profile` - 获取个人信息
- `PUT /api/v1/user/profile` - 更新个人信息
- `PUT /api/v1/user/avatar` - 更新头像

### 3.3 套餐管理模块（SubscriptionManagement）

**功能描述**
查看当前套餐状态，管理订阅历史，升级套餐。

**组件功能**
- 当前套餐信息展示
- 套餐使用进度
- 升级建议
- 订阅历史记录

**数据模型**
```go
type UserSubscription struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    UserID      string    `json:"user_id" gorm:"index"`
    TenantID    string    `json:"tenant_id" gorm:"index"`
    PlanID      string    `json:"plan_id"`
    PlanName    string    `json:"plan_name"`
    Status      string    `json:"status" gorm:"default:'active'"` // active/cancelled/expired
    StartedAt   time.Time `json:"started_at"`
    ExpiresAt   time.Time `json:"expires_at"`
    CancelledAt *time.Time `json:"cancelled_at"`
    Amount      float64   `json:"amount"`
    Currency    string    `json:"currency"`
    PaymentID   string    `json:"payment_id"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

### 3.4 Token明细模块（TokenTransactions）

**功能描述**
查看Token余额、交易记录、购买Token等。

**功能列表**
- Token余额展示（分类显示）
- 交易记录查询（支持筛选）
- Token购买入口
- 消费统计图表

**API接口**
- `GET /api/v1/tokens/balance` - 获取Token余额
- `GET /api/v1/tokens/transactions` - 获取交易记录
- `GET /api/v1/tokens/stats` - 获取消费统计
- `POST /api/v1/tokens/purchase` - 购买Token

### 3.5 邀请好友模块（InviteFriends）

**功能描述**
生成邀请链接，查看邀请记录，获得Pro套餐奖励。

**奖励规则**
- 新用户直接注册：获得14天Pro套餐
- 通过邀请链接注册：获得30天Pro套餐
- 成功邀请好友：邀请者获得30天Pro套餐（可累加）

**功能复用**
直接复用之前设计的邀请功能组件，保持一致性。

### 3.6 每日签到模块（DailyCheckIn）

**功能描述**
执行每日签到，查看签到历史，获得Token奖励。

**功能复用**
直接复用之前设计的签到功能组件，保持一致性。

## 4. 数据更新机制

### 4.1 简单轮询机制

**Linus式简化**：使用简单的定时刷新，避免WebSocket的复杂性。

```go
// 数据刷新服务（简单实现）
type RefreshService struct {
    intervals map[string]*time.Ticker // user_id -> ticker
    mutex     sync.RWMutex
}

// 启动用户数据自动刷新
func (s *RefreshService) StartRefresh(userID string, interval time.Duration) {
    s.mutex.Lock()
    defer s.mutex.Unlock()
    
    // 停止旧的任务
    if ticker, exists := s.intervals[userID]; exists {
        ticker.Stop()
    }
    
    // 创建新的定时任务
    ticker := time.NewTicker(interval)
    s.intervals[userID] = ticker
    
    go func() {
        for range ticker.C {
            // 触发数据刷新（通过缓存或事件）
            s.refreshUserData(userID)
        }
    }()
}

// 刷新用户数据
func (s *RefreshService) refreshUserData(userID string) {
    // 1. 更新缓存
    cache.UpdateUserCache(userID)
    
    // 2. 可选：通过简单的内存队列通知
    queue.Publish("user_updated", userID)
}
```

### 4.2 前端轮询实现

```jsx
// 简单的轮询Hook
const usePolling = (fetchFunc, interval = 30000) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await fetchFunc();
                setData(result);
            } catch (error) {
                console.error('Polling error:', error);
            } finally {
                setLoading(false);
            }
        };
        
        // 立即执行一次
        fetchData();
        
        // 设置定时器
        const timer = setInterval(fetchData, interval);
        
        return () => clearInterval(timer);
    }, [fetchFunc, interval]);
    
    return { data, loading };
};

// 使用示例
const UserProfile = () => {
    const { data: profile, loading } = usePolling(
        () => fetch('/api/v1/user/profile').then(res => res.json()),
        30000 // 30秒刷新一次
    );
    
    if (loading) return <div>Loading...</div>;
    return <div>{profile?.name}</div>;
};
```

### 4.3 数据更新策略（简化版）

| 数据类型 | 更新频率 | 更新方式 |
|---------|---------|---------|
| 用户基本信息 | 30秒轮询 | 定时刷新 |
| Token余额 | 30秒轮询 | 定时刷新 |
| 订阅状态 | 30分钟轮询 | 定时刷新 |
| 签到状态 | 页面加载时检查 | 手动刷新 |
| 邀请记录 | 60秒轮询 | 定时刷新 |

## 5. 性能优化

### 5.1 数据缓存

- **用户信息缓存**：缓存5分钟
- **套餐信息缓存**：缓存1小时
- **Token余额**：缓存10秒（避免频繁查询）
- **统计数据**：缓存15分钟

```go
// 带缓存的用户信息获取
func GetUserProfileWithCache(userID string) (*UserProfile, error) {
    cacheKey := fmt.Sprintf("user:profile:%s", userID)
    
    var profile UserProfile
    if err := cache.Get(cacheKey, &profile); err == nil {
        return &profile, nil
    }
    
    // 从数据库获取
    if err := db.Where("id = ?", userID).First(&profile).Error; err != nil {
        return nil, err
    }
    
    // 缓存5分钟
    cache.Set(cacheKey, profile, 5*time.Minute)
    
    return &profile, nil
}
```

### 5.2 懒加载策略

- 标签页内容懒加载
- 图片和图表按需加载
- 历史记录分页加载

```jsx
// 懒加载组件示例
const LazyTokenTransactions = React.lazy(() => import('./TokenTransactions'));

// 在标签页中使用
{activeTab === 'tokens' && (
    <React.Suspense fallback={<div>加载中...</div>}>
        <LazyTokenTransactions user={user} />
    </React.Suspense>
)}
```

### 5.3 请求优化

- 合并API请求
- 使用SWR进行数据获取
- 请求防抖和节流

```jsx
// 使用SWR管理数据
const { data: user, error, mutate } = useSWR('/api/v1/user/profile', fetcher);

// 手动刷新数据
const handleRefresh = () => {
    mutate();
};
```

## 6. 安全考虑

### 6.1 权限验证

- 所有API需要JWT认证
- 敏感操作需要二次验证
- 租户数据隔离

```go
// 中间件：验证用户访问权限
func UserAccessMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        tenantID := c.GetString("tenant_id")
        pathUserID := c.Param("user_id")
        
        // 只能访问自己的数据
        if pathUserID != "" && pathUserID != userID {
            c.AbortWithStatusJSON(403, gin.H{
                "code":    403,
                "message": "Access denied",
            })
            return
        }
        
        c.Set("tenant_id", tenantID)
        c.Next()
    }
}
```

### 6.2 数据保护

- 敏感信息脱敏
- XSS防护
- CSRF保护

## 7. 监控和分析

### 7.1 用户行为追踪

- 页面访问统计
- 功能使用频率
- 停留时间分析

### 7.2 性能监控

- 页面加载时间
- API响应时间
- 错误率统计

## 8. 扩展性考虑

1. **多语言支持**：预留国际化接口
2. **主题定制**：支持自定义主题
3. **插件系统**：功能模块可插拔
4. **API版本管理**：支持API升级

## 9. 部署和运维

### 9.1 构建优化

- 代码分割
- 资源压缩
- CDN加速

### 9.2 灰度发布

- 功能开关控制
- A/B测试支持
- 逐步放量

通过以上设计，SaaS个人中心将为用户提供一个功能完善、体验流畅的管理界面，有效提升用户满意度和活跃度。