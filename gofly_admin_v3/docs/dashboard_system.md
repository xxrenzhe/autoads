# AutoAds SaaS个人中心系统文档

## 概述

AutoAds SaaS个人中心系统是一个功能完善的用户管理中心，提供用户信息管理、套餐管理、Token明细、邀请好友、每日签到等核心功能，为用户提供完整的SaaS体验。

## 核心特性

### 1. 标签导航设计
- **概览**: 账户概览和使用统计
- **个人信息**: 管理个人资料和账户设置
- **套餐管理**: 查看当前套餐和订阅历史
- **Token明细**: 查看Token余额和交易记录
- **邀请好友**: 邀请好友获得奖励
- **每日签到**: 每日签到获得Token奖励

### 2. 实时数据更新
- **用户信息**: 30秒轮询更新
- **Token余额**: 30秒轮询更新
- **订阅状态**: 30分钟轮询更新
- **邀请记录**: 60秒轮询更新

### 3. 数据可视化
- **使用趋势图**: Token消费和任务使用趋势
- **统计图表**: 消费统计和活动分析
- **进度显示**: 套餐使用进度和剩余时间

## 数据模型

### UserOverview 用户概览
```go
type UserOverview struct {
    UserInfo     UserInfo     // 用户基本信息
    PlanInfo     PlanInfo     // 套餐信息
    TokenBalance int          // Token余额
    TodayStats   DailyStats   // 今日统计
    MonthlyStats MonthlyStats // 月度统计
}
```

### UserInfo 用户基本信息
```go
type UserInfo struct {
    ID          string     // 用户ID
    Username    string     // 用户名
    Email       string     // 邮箱
    Name        string     // 真实姓名
    Company     string     // 公司名称
    AvatarURL   string     // 头像URL
    Timezone    string     // 时区
    Language    string     // 语言
    CreatedAt   time.Time  // 注册时间
    LastLoginAt *time.Time // 最后登录时间
}
```

### PlanInfo 套餐信息
```go
type PlanInfo struct {
    PlanName  string        // 套餐名称
    IsActive  bool          // 是否激活
    DaysLeft  int           // 剩余天数
    ExpiresAt *time.Time    // 过期时间
    Features  []PlanFeature // 套餐功能
}
```

### PlanFeature 套餐功能
```go
type PlanFeature struct {
    Name    string // 功能名称
    Enabled bool   // 是否启用
    Limit   string // 限制说明
}
```

### DailyStats 每日统计
```go
type DailyStats struct {
    Date             string // 日期
    TokensConsumed   int    // Token消费
    BatchTasks       int    // BatchGo任务数
    SiteRankQueries  int    // SiteRank查询数
    AdsCenterTasks  int    // AdsCenter任务数
    CheckedIn        bool   // 是否已签到
}
```

### MonthlyStats 月度统计
```go
type MonthlyStats struct {
    Year            int // 年份
    Month           int // 月份
    TokensConsumed  int // Token消费
    BatchTasks      int // BatchGo任务数
    SiteRankQueries int // SiteRank查询数
    AdsCenterTasks int // AdsCenter任务数
    CheckinDays     int // 签到天数
}
```

## API接口

### 概览相关

#### 获取用户概览
```http
GET /api/dashboard/overview
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "user_info": {
      "id": "user_123",
      "username": "testuser",
      "email": "test@example.com",
      "name": "测试用户",
      "company": "测试公司",
      "avatar_url": "https://example.com/avatar.jpg",
      "timezone": "Asia/Shanghai",
      "language": "zh-CN",
      "created_at": "2025-06-12T10:30:00Z",
      "last_login_at": "2025-09-12T08:30:00Z"
    },
    "plan_info": {
      "plan_name": "pro",
      "is_active": true,
      "days_left": 15,
      "expires_at": "2025-09-27T10:30:00Z",
      "features": [
        {
          "name": "BatchGo批量访问",
          "enabled": true,
          "limit": "无限制"
        },
        {
          "name": "SiteRank查询",
          "enabled": true,
          "limit": "无限制"
        }
      ]
    },
    "token_balance": 1500,
    "today_stats": {
      "date": "2025-09-12",
      "tokens_consumed": 25,
      "batch_tasks": 3,
      "siterank_queries": 5,
      "adscenter_tasks": 1,
      "checked_in": true
    },
    "monthly_stats": {
      "year": 2025,
      "month": 9,
      "tokens_consumed": 380,
      "batch_tasks": 45,
      "siterank_queries": 120,
      "adscenter_tasks": 8,
      "checkin_days": 18
    }
  }
}
```

#### 获取标签页配置
```http
GET /api/dashboard/tabs
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "key": "overview",
      "title": "概览",
      "description": "查看账户概览和使用统计",
      "icon": "dashboard",
      "enabled": true
    },
    {
      "key": "profile",
      "title": "个人信息",
      "description": "管理个人资料和账户设置",
      "icon": "user",
      "enabled": true
    }
  ]
}
```

### 用户信息相关

#### 获取用户基本信息
```http
GET /api/dashboard/user/info
Authorization: Bearer <jwt_token>
```

#### 更新用户资料
```http
PUT /api/dashboard/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "新用户名",
  "company": "新公司名",
  "timezone": "America/New_York",
  "language": "en-US"
}
```

**响应示例:**
```json
{
  "code": 0,
  "message": "更新成功"
}
```

### 套餐相关

#### 获取套餐信息
```http
GET /api/dashboard/plan/info
Authorization: Bearer <jwt_token>
```

#### 获取订阅历史
```http
GET /api/dashboard/subscription/history?page=1&size=20
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "records": [
      {
        "id": "sub_001",
        "user_id": "user_123",
        "plan_name": "pro",
        "source": "invitation",
        "days": 30,
        "start_date": "2025-08-13T10:30:00Z",
        "end_date": "2025-09-12T10:30:00Z",
        "is_active": false,
        "created_at": "2025-08-13T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 统计相关

#### 获取今日统计
```http
GET /api/dashboard/stats/daily
Authorization: Bearer <jwt_token>
```

#### 获取月度统计
```http
GET /api/dashboard/stats/monthly
Authorization: Bearer <jwt_token>
```

#### 获取使用统计
```http
GET /api/dashboard/usage/stats?days=30
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "period": "30天",
    "start_date": "2025-08-13",
    "end_date": "2025-09-12",
    "token_trend": [
      {
        "date": "2025-09-10",
        "tokens_earned": 1010,
        "tokens_consumed": 45
      },
      {
        "date": "2025-09-11",
        "tokens_earned": 10,
        "tokens_consumed": 35
      }
    ],
    "task_trend": [
      {
        "date": "2025-09-10",
        "batch_tasks": 12,
        "siterank_queries": 18,
        "adscenter_tasks": 3
      },
      {
        "date": "2025-09-11",
        "batch_tasks": 6,
        "siterank_queries": 10,
        "adscenter_tasks": 1
      }
    ]
  }
}
```

### 活动相关

#### 获取最近活动
```http
GET /api/dashboard/activities?limit=20
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "type": "token",
      "title": "每日签到获得 10 Token",
      "description": "每日签到奖励",
      "created_at": "2025-09-12T08:30:00Z"
    },
    {
      "type": "token",
      "title": "消费使用 25 Token",
      "description": "BatchGo Silent task",
      "created_at": "2025-09-12T06:30:00Z"
    },
    {
      "type": "task",
      "title": "完成SiteRank查询",
      "description": "查询5个域名排名",
      "created_at": "2025-09-12T04:30:00Z"
    }
  ]
}
```

## 套餐功能配置

### Free套餐
- **BatchGo批量访问**: ✅ 每日50次
- **SiteRank查询**: ✅ 每日20次
- **自动化广告(AdsCenter)**: ❌ Pro功能
- **客服支持**: ✅ 工作时间
- **基础统计**: ✅ 基础报告

### Pro套餐
- **BatchGo批量访问**: ✅ 无限制
- **SiteRank查询**: ✅ 无限制
- **自动化广告(AdsCenter)**: ✅ 无限制
- **优先客服支持**: ✅ 7x24小时
- **高级统计报告**: ✅ 详细报告

### Max套餐
- **BatchGo批量访问**: ✅ 无限制
- **SiteRank查询**: ✅ 无限制
- **自动化广告(AdsCenter)**: ✅ 无限制
- **优先客服支持**: ✅ 7x24小时
- **高级统计报告**: ✅ 详细报告
- **API访问**: ✅ 无限制
- **白标定制**: ✅ 支持

## 数据统计逻辑

### 今日统计计算
```sql
-- Token消费统计
SELECT SUM(ABS(amount)) 
FROM token_transactions 
WHERE user_id = ? AND type = 'consume' AND DATE(created_at) = ?

-- 任务数量统计
SELECT COUNT(*) 
FROM batch_tasks 
WHERE user_id = ? AND DATE(created_at) = ?

-- 签到状态检查
SELECT COUNT(*) 
FROM checkin_records 
WHERE user_id = ? AND checkin_date = ?
```

### 月度统计计算
```sql
-- 本月Token消费
SELECT SUM(ABS(amount)) 
FROM token_transactions 
WHERE user_id = ? AND type = 'consume' AND created_at >= ?

-- 本月任务数量
SELECT COUNT(*) 
FROM batch_tasks 
WHERE user_id = ? AND created_at >= ?

-- 本月签到天数
SELECT COUNT(*) 
FROM checkin_records 
WHERE user_id = ? AND created_at >= ?
```

### 使用趋势分析
```sql
-- Token趋势
SELECT 
    DATE(created_at) as date,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as tokens_earned,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as tokens_consumed
FROM token_transactions 
WHERE user_id = ? AND created_at >= ? AND created_at <= ?
GROUP BY DATE(created_at)
ORDER BY date ASC

-- 任务趋势
SELECT 
    DATE(created_at) as date,
    COUNT(*) as task_count
FROM batch_tasks 
WHERE user_id = ? AND created_at >= ? AND created_at <= ?
GROUP BY DATE(created_at)
ORDER BY date ASC
```

## 实时数据更新

### 轮询策略
- **用户信息**: 30秒间隔，检查基本信息变更
- **Token余额**: 30秒间隔，实时显示余额变化
- **订阅状态**: 30分钟间隔，检查套餐过期状态
- **邀请记录**: 60秒间隔，更新邀请统计

### 前端实现示例
```javascript
// 用户信息轮询
setInterval(async () => {
  const response = await fetch('/api/dashboard/user/info');
  const data = await response.json();
  updateUserInfo(data.data);
}, 30000);

// Token余额轮询
setInterval(async () => {
  const response = await fetch('/api/user/token/balance');
  const data = await response.json();
  updateTokenBalance(data.data.balance);
}, 30000);

// 订阅状态轮询
setInterval(async () => {
  const response = await fetch('/api/dashboard/plan/info');
  const data = await response.json();
  updatePlanInfo(data.data);
}, 1800000); // 30分钟
```

## 用户体验优化

### 1. 响应式设计
- **移动端适配**: 支持手机和平板设备
- **标签切换**: 平滑的标签页切换动画
- **数据加载**: 骨架屏和加载状态提示

### 2. 交互优化
- **即时反馈**: 操作后立即显示结果
- **错误处理**: 友好的错误提示和重试机制
- **数据缓存**: 合理的数据缓存策略

### 3. 可视化增强
- **图表展示**: 使用图表展示趋势数据
- **进度条**: 直观的套餐使用进度显示
- **状态指示**: 清晰的状态图标和颜色

## 性能优化

### 1. 数据库优化
- **索引设计**: 为常用查询字段建立索引
- **查询优化**: 使用聚合查询减少数据库访问
- **分页查询**: 大数据量使用分页避免性能问题

### 2. 缓存策略
- **用户信息缓存**: 缓存用户基本信息
- **统计数据缓存**: 缓存计算结果减少重复计算
- **Redis缓存**: 使用Redis缓存热点数据

### 3. 前端优化
- **组件懒加载**: 按需加载标签页组件
- **数据预取**: 预取可能需要的数据
- **虚拟滚动**: 大列表使用虚拟滚动

## 安全考虑

### 1. 数据安全
- **用户隔离**: 严格的用户数据隔离
- **权限控制**: 用户只能访问自己的数据
- **敏感信息**: 敏感信息脱敏显示

### 2. API安全
- **认证验证**: 所有接口需要JWT认证
- **参数验证**: 严格验证所有输入参数
- **频率限制**: 防止API滥用

### 3. 前端安全
- **XSS防护**: 防止跨站脚本攻击
- **CSRF防护**: 防止跨站请求伪造
- **数据验证**: 前端数据验证和后端验证

## 监控指标

### 1. 业务指标
- **活跃用户**: 日活跃用户数和月活跃用户数
- **功能使用**: 各功能模块的使用频率
- **用户留存**: 用户登录和使用频率

### 2. 技术指标
- **API响应时间**: 各接口的响应时间
- **错误率**: 接口调用失败率
- **数据库性能**: 查询执行时间

### 3. 用户体验指标
- **页面加载时间**: 各页面的加载速度
- **交互响应时间**: 用户操作的响应时间
- **错误反馈**: 用户遇到的错误情况

## 扩展功能

### 1. 高级统计
- **自定义报表**: 用户自定义统计报表
- **数据导出**: 支持Excel/CSV格式导出
- **对比分析**: 不同时期的数据对比

### 2. 个性化设置
- **主题切换**: 支持明暗主题切换
- **布局自定义**: 用户自定义页面布局
- **通知设置**: 个性化通知偏好设置

### 3. 社交功能
- **成就系统**: 用户成就和徽章系统
- **排行榜**: 用户使用排行榜
- **分享功能**: 数据分享到社交媒体

## 最佳实践

### 1. 开发规范
- **组件化**: 使用可复用的组件
- **状态管理**: 统一的状态管理方案
- **错误处理**: 完善的错误处理机制

### 2. 用户体验
- **加载状态**: 明确的加载状态提示
- **空状态**: 友好的空数据状态页面
- **操作反馈**: 及时的操作结果反馈

### 3. 维护性
- **代码注释**: 详细的代码注释
- **文档更新**: 及时更新API文档
- **版本管理**: 规范的版本发布流程

## 部署配置

### 1. 环境配置
- **开发环境**: 本地开发环境配置
- **测试环境**: 测试环境部署配置
- **生产环境**: 生产环境优化配置

### 2. 监控配置
- **日志收集**: 结构化日志收集
- **性能监控**: APM性能监控
- **错误追踪**: 错误日志追踪

### 3. 备份策略
- **数据备份**: 定期数据备份
- **配置备份**: 配置文件备份
- **恢复测试**: 定期恢复测试
