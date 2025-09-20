# AutoAds 邀请和签到系统文档

## 概述

AutoAds 邀请和签到系统是一个完整的用户增长和留存系统，通过邀请好友和每日签到机制，为用户提供Pro套餐时长和Token奖励，促进用户活跃度和平台增长。

## 核心特性

### 1. 邀请系统
- **专属邀请码**: 每个用户自动生成唯一的8位邀请码
- **双向奖励**: 邀请者和被邀请者都获得30天Pro套餐和Token奖励
- **套餐累加**: 邀请者的Pro套餐时长可以累加
- **邀请统计**: 完整的邀请数据统计和历史记录

### 2. 签到系统
- **每日签到**: 固定10个Token奖励，无递增机制
- **签到日历**: 直观的月度签到日历显示
- **连续签到**: 跟踪连续签到天数和最长记录
- **防重复**: 每天只能签到一次，重复签到检测

### 3. 奖励机制
- **Pro套餐奖励**: 新用户14天试用，邀请注册30天Pro
- **Token奖励**: 邀请双方各100个Token，每日签到10个Token
- **即时到账**: 所有奖励立即生效，无延迟

## 数据模型

### 邀请系统数据模型

#### Invitation 邀请记录
```go
type Invitation struct {
    ID                 string            // 邀请记录ID
    InviterID          string            // 邀请者ID
    InviteeID          string            // 被邀请者ID
    InviteCode         string            // 邀请码
    Status             InvitationStatus  // 邀请状态
    InviterRewardGiven bool              // 邀请者奖励是否已发放
    InviteeRewardGiven bool              // 被邀请者奖励是否已发放
    RewardDays         int               // 奖励天数(默认30天)
    TokenReward        int               // Token奖励(默认100个)
    CreatedAt          time.Time         // 创建时间
}
```

#### 邀请状态
- `pending`: 等待中（邀请码已生成但未使用）
- `completed`: 已完成（好友已注册并获得奖励）
- `expired`: 已过期（邀请码过期失效）

#### InvitationStats 邀请统计
```go
type InvitationStats struct {
    TotalInvitations      int64   // 邀请总数
    SuccessfulInvitations int64   // 成功邀请数
    SuccessRate           float64 // 成功率
    TotalProDays          int     // 获得Pro套餐天数
    TotalTokenReward      int     // 获得Token奖励
}
```

### 签到系统数据模型

#### CheckinRecord 签到记录
```go
type CheckinRecord struct {
    UserID      string    // 用户ID
    CheckinDate string    // 签到日期(YYYY-MM-DD)
    TokenReward int       // Token奖励(固定10个)
    CreatedAt   time.Time // 创建时间
}
```

#### CheckinStatus 签到状态
```go
type CheckinStatus struct {
    TodayChecked    bool // 今天是否已签到
    ConsecutiveDays int  // 连续签到天数
    MonthlyDays     int  // 本月签到天数
    TotalDays       int  // 总签到天数
    NextReward      int  // 下次签到奖励(固定10个)
}
```

#### CheckinCalendar 签到日历
```go
type CheckinCalendar struct {
    Year        int   // 年份
    Month       int   // 月份
    CheckinDays []int // 已签到的日期
    TotalDays   int   // 本月签到总天数
}
```

## API接口

### 邀请系统API

#### 生成邀请链接
```http
POST /api/invitation/generate-link
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "base_url": "https://autoads.dev"
}
```

**响应示例:**
```json
{
  "code": 0,
  "message": "邀请链接生成成功",
  "data": {
    "invite_code": "ABC12345",
    "invite_link": "https://autoads.dev/register?invite=ABC12345",
    "message": "分享此链接邀请好友注册，双方都可获得30天Pro套餐和Token奖励"
  }
}
```

#### 验证邀请码
```http
POST /api/invitation/validate
Content-Type: application/json

{
  "invite_code": "ABC12345"
}
```

**响应示例:**
```json
{
  "code": 0,
  "message": "验证完成",
  "data": {
    "valid": true,
    "inviter_name": "张三",
    "inviter_email": "zhangsan@example.com",
    "message": "邀请码有效，注册后可获得30天Pro套餐"
  }
}
```

#### 获取邀请信息
```http
GET /api/invitation/info
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "invite_code": "ABC12345",
    "stats": {
      "total_invitations": 10,
      "successful_invitations": 8,
      "success_rate": 80.0,
      "total_pro_days": 240,
      "total_token_reward": 800
    }
  }
}
```

#### 获取邀请历史
```http
GET /api/invitation/history?page=1&size=20
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
        "id": "inv_001",
        "invitee_username": "李四",
        "invitee_email": "lisi@example.com",
        "invite_code": "ABC12345",
        "status": "completed",
        "inviter_reward_given": true,
        "invitee_reward_given": true,
        "reward_days": 30,
        "token_reward": 100,
        "created_at": "2025-09-12T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 8,
      "pages": 1
    }
  }
}
```

#### 处理邀请注册（内部接口）
```http
POST /api/invitation/process
Content-Type: application/json

{
  "invite_code": "ABC12345",
  "new_user_id": "user_123"
}
```

### 签到系统API

#### 执行签到
```http
POST /api/checkin/perform
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "签到成功",
  "data": {
    "success": true,
    "message": "签到成功",
    "token_reward": 10,
    "checkin_date": "2025-09-12",
    "already_done": false
  }
}
```

#### 获取签到信息
```http
GET /api/checkin/info
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "today_checked": true,
    "consecutive_days": 5,
    "monthly_days": 12,
    "total_days": 45,
    "next_reward": 10
  }
}
```

#### 获取签到日历
```http
GET /api/checkin/calendar?year=2025&month=9
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "year": 2025,
    "month": 9,
    "checkin_days": [1, 3, 5, 8, 9, 10, 11, 12],
    "total_days": 8
  }
}
```

#### 获取签到历史
```http
GET /api/checkin/history?page=1&size=20
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
        "user_id": "user_123",
        "checkin_date": "2025-09-12",
        "token_reward": 10,
        "created_at": "2025-09-12T08:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### 获取签到统计
```http
GET /api/checkin/stats
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "total_days": 45,
    "consecutive_days": 5,
    "monthly_days": 12,
    "total_tokens": 450,
    "max_consecutive": 15
  }
}
```

## 业务逻辑

### 邀请流程

#### 1. 邀请码生成
- 用户注册时自动生成8位唯一邀请码
- 邀请码格式：大写字母+数字组合（如：ABC12345）
- 确保全局唯一性，避免冲突

#### 2. 邀请注册流程
```
1. 用户A分享邀请链接给用户B
2. 用户B点击链接访问注册页面
3. 注册页面自动填入邀请码
4. 用户B完成注册
5. 系统处理邀请奖励：
   - 给用户B：30天Pro套餐 + 100个Token
   - 给用户A：30天Pro套餐(累加) + 100个Token
6. 创建邀请记录，标记奖励已发放
```

#### 3. 套餐时长计算
- **新用户无套餐**: 从注册时间开始计算30天
- **现有套餐未过期**: 在现有过期时间基础上延长30天
- **现有套餐已过期**: 从当前时间开始计算30天

### 签到流程

#### 1. 每日签到
```
1. 用户点击签到按钮
2. 检查今天是否已签到
3. 如果未签到：
   - 创建签到记录
   - 给用户添加10个Token
   - 返回签到成功
4. 如果已签到：
   - 返回"今天已签到"提示
```

#### 2. 连续签到计算
- 从今天开始往前查找连续的签到记录
- 遇到缺失日期则中断连续计数
- 实时计算当前连续签到天数

#### 3. 签到日历生成
- 查询指定年月的所有签到记录
- 提取签到日期的"日"部分
- 生成已签到日期数组供前端显示

## Token奖励机制

### 奖励标准
- **邀请奖励**: 邀请者和被邀请者各100个Token
- **签到奖励**: 每日固定10个Token
- **无递增机制**: 签到奖励不随连续天数增加

### 奖励发放
- **即时到账**: 所有奖励立即生效
- **防重复**: 同一邀请/签到只能获得一次奖励
- **记录完整**: 所有奖励都有详细的交易记录

### Token类型
- **invite**: 邀请奖励Token
- **checkin**: 签到奖励Token

## Pro套餐奖励

### 奖励规则
- **新用户注册**: 14天Pro试用（无邀请码）
- **邀请注册**: 30天Pro套餐（有邀请码，不与14天叠加）
- **邀请奖励**: 邀请者获得30天Pro套餐（可累加）

### 套餐管理
- **自动激活**: 奖励套餐自动激活，无需手动操作
- **时长累加**: 邀请者的Pro套餐时长可以累加
- **过期管理**: 系统自动管理套餐过期时间

## 统计分析

### 邀请统计
- **邀请总数**: 用户发出的邀请总数
- **成功邀请数**: 好友成功注册的邀请数
- **成功率**: 成功邀请数 / 邀请总数 * 100%
- **获得奖励**: 总Pro套餐天数和Token奖励

### 签到统计
- **总签到天数**: 用户累计签到天数
- **连续签到**: 当前连续签到天数
- **本月签到**: 本月已签到天数
- **最长连续**: 历史最长连续签到记录
- **总Token奖励**: 签到获得的总Token数

### 排行榜
- **邀请排行榜**: 按成功邀请数排序
- **签到排行榜**: 按总签到天数排序

## 防刷机制

### 邀请防刷
- **唯一性检查**: 每个用户只能被邀请一次
- **自邀防护**: 不能使用自己的邀请码
- **奖励标记**: 防止重复发放奖励

### 签到防刷
- **日期唯一**: 每天只能签到一次
- **时间校验**: 基于服务器时间判断日期
- **重复检测**: 重复签到返回提示信息

## 数据库设计

### 邀请表 (invitations)
```sql
CREATE TABLE invitations (
    id VARCHAR(36) PRIMARY KEY,
    inviter_id VARCHAR(36) NOT NULL,
    invitee_id VARCHAR(36) NOT NULL UNIQUE,
    invite_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    inviter_reward_given BOOLEAN DEFAULT FALSE,
    invitee_reward_given BOOLEAN DEFAULT FALSE,
    reward_days INT DEFAULT 30,
    token_reward INT DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_inviter_id (inviter_id),
    INDEX idx_invite_code (invite_code),
    INDEX idx_status (status)
);
```

### 签到表 (checkin_records)
```sql
CREATE TABLE checkin_records (
    user_id VARCHAR(36) NOT NULL,
    checkin_date DATE NOT NULL,
    token_reward INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (user_id, checkin_date),
    INDEX idx_checkin_date (checkin_date)
);
```

### 用户表扩展字段
```sql
ALTER TABLE users 
ADD COLUMN invite_code VARCHAR(20) UNIQUE,
ADD COLUMN invited_by VARCHAR(36),
ADD COLUMN invited_at DATETIME,
ADD COLUMN plan_name VARCHAR(20) DEFAULT 'free',
ADD COLUMN plan_expires_at DATETIME;
```

## 性能优化

### 查询优化
- **索引设计**: 为常用查询字段建立索引
- **分页查询**: 历史记录使用分页避免大量数据加载
- **缓存策略**: 用户邀请码和签到状态可以缓存

### 并发处理
- **事务保护**: 邀请处理和签到使用数据库事务
- **唯一约束**: 数据库层面保证数据唯一性
- **乐观锁**: 避免并发冲突

## 监控指标

### 业务指标
- **邀请转化率**: 邀请链接点击到注册的转化率
- **签到活跃度**: 日活跃用户签到比例
- **用户留存**: 签到用户的留存率
- **奖励成本**: Token和Pro套餐的发放成本

### 技术指标
- **API响应时间**: 邀请和签到接口的响应时间
- **数据库性能**: 查询执行时间和并发处理能力
- **错误率**: 接口调用失败率

## 扩展功能

### 1. 高级邀请功能
- **邀请码定制**: 允许用户自定义邀请码
- **邀请活动**: 限时邀请活动，额外奖励
- **邀请等级**: 根据邀请数量设置等级奖励

### 2. 签到增强
- **签到任务**: 完成特定任务才能签到
- **签到礼包**: 连续签到获得特殊礼包
- **补签功能**: 允许用户补签错过的日期

### 3. 社交功能
- **邀请分享**: 一键分享到社交媒体
- **好友系统**: 邀请成功后建立好友关系
- **排行榜**: 邀请和签到排行榜展示

## 最佳实践

### 1. 用户体验
- **简化流程**: 邀请和签到流程尽可能简单
- **即时反馈**: 操作后立即显示结果
- **清晰提示**: 明确的奖励说明和操作指引

### 2. 数据安全
- **输入验证**: 严格验证所有用户输入
- **权限控制**: 用户只能操作自己的数据
- **审计日志**: 记录所有重要操作

### 3. 系统稳定
- **错误处理**: 完善的错误处理和恢复机制
- **监控告警**: 关键指标异常时及时告警
- **容量规划**: 根据用户增长规划系统容量

## 安全考虑

### 1. 防刷保护
- **频率限制**: 限制邀请和签到操作频率
- **IP限制**: 同一IP的操作频率限制
- **设备指纹**: 检测异常设备行为

### 2. 数据保护
- **敏感信息**: 邀请码等敏感信息加密存储
- **用户隔离**: 严格的用户数据隔离
- **访问控制**: 基于角色的访问控制

### 3. 业务安全
- **奖励上限**: 设置合理的奖励上限
- **异常检测**: 检测异常的邀请和签到行为
- **风控规则**: 建立完善的风控规则体系