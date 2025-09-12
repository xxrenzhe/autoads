# AutoAds SaaS Token系统文档

## 概述

AutoAds SaaS Token系统是一个简化到极致的虚拟货币系统，用于统一管理所有服务的使用计费。系统基于预付费模式，用户购买Token后可以使用各种服务功能。

## 核心特性

### 1. 简化的Token经济
- **统一计费**: 所有服务使用统一的Token计费
- **透明定价**: 明确的Token消费规则
- **预付费模式**: 先充值后使用，避免超额消费
- **实时余额**: 实时显示Token余额和消费记录

### 2. 基于服务的消费规则
- **SiteRank查询**: 1 Token/次
- **BatchGo HTTP模式**: 1 Token/URL
- **BatchGo Puppeteer模式**: 2 Token/URL
- **Chengelink链接提取**: 1 Token/次
- **Chengelink广告更新**: 3 Token/广告

### 3. 标准充值包配置
- **入门包**: ¥29 = 2,200 Token (2000 + 200赠送)
- **基础包**: ¥99 = 11,000 Token (10000 + 1000赠送) 🔥热门
- **专业包**: ¥299 = 58,000 Token (50000 + 8000赠送)
- **企业包**: ¥999 = 250,000 Token (200000 + 50000赠送)

### 4. 完整的交易记录系统
- **实时记录**: 每次Token变动都有详细记录
- **交易类型**: 消费(consume)、购买(purchase)、签到(checkin)、邀请(invite)
- **余额快照**: 记录每次交易后的余额
- **关联引用**: 可关联具体的任务或订单

## API接口

### Token余额管理

#### 获取Token余额
```http
GET /api/v1/tokens/balance
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "balance": 1500
}
```

#### 获取Token统计
```http
GET /api/v1/tokens/stats
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "current_balance": 1500,
  "today_consumption": 25,
  "monthly_consumption": 450,
  "total_consumption": 2500,
  "total_purchase": 4000,
  "consumption_rules": [...],
  "recharge_packages": [...]
}
```

### Token消费

#### 消费Token
```http
POST /api/v1/tokens/consume
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "service": "siterank",
  "action": "query",
  "quantity": 5,
  "reference": "batch_task_001"
}
```

**响应示例:**
```json
{
  "message": "Token消费成功",
  "consumed_tokens": 5,
  "new_balance": 1495
}
```

#### 检查Token充足性
```http
GET /api/v1/tokens/check?service=batchgo&action=puppeteer&quantity=10
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "sufficient": true,
  "current_balance": 1500,
  "required_tokens": 20,
  "shortage": 0
}
```

### Token购买

#### 购买Token
```http
POST /api/v1/tokens/purchase
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "package_id": "basic",
  "order_id": "order_20250912_001"
}
```

**响应示例:**
```json
{
  "message": "Token购买成功",
  "new_balance": 12500
}
```

### 交易记录

#### 获取交易记录
```http
GET /api/v1/tokens/transactions?page=1&size=20
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "transactions": [
    {
      "id": "tx_001",
      "user_id": "user_001",
      "amount": -5,
      "balance": 1495,
      "type": "consume",
      "description": "SiteRank域名查询（5次）",
      "reference": "batch_task_001",
      "created_at": "2025-09-12T14:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### 配置信息

#### 获取消费规则
```http
GET /api/v1/public/tokens/rules
```

**响应示例:**
```json
{
  "rules": [
    {
      "service": "siterank",
      "action": "query",
      "token_cost": 1,
      "description": "SiteRank域名查询"
    },
    {
      "service": "batchgo",
      "action": "http",
      "token_cost": 1,
      "description": "BatchGo HTTP模式（每个URL）"
    }
  ]
}
```

#### 获取充值包
```http
GET /api/v1/public/tokens/packages
```

**响应示例:**
```json
{
  "packages": [
    {
      "id": "basic",
      "name": "基础包",
      "price": 99.00,
      "token_amount": 10000,
      "bonus": 1000,
      "popular": true,
      "description": "最受欢迎，性价比最高"
    }
  ]
}
```

## 服务集成

### 在服务中消费Token

```go
// 示例：在SiteRank服务中消费Token
func (s *SiteRankService) QueryDomain(userID, domain string) error {
    // 1. 检查Token是否足够
    sufficient, _, _, err := s.tokenService.CheckTokenSufficiency(
        userID, "siterank", "query", 1)
    if err != nil {
        return err
    }
    if !sufficient {
        return errors.New("Token余额不足")
    }
    
    // 2. 执行查询逻辑
    result, err := s.performQuery(domain)
    if err != nil {
        return err
    }
    
    // 3. 消费Token
    err = s.tokenService.ConsumeTokensByService(
        userID, "siterank", "query", 1, fmt.Sprintf("query_%s", domain))
    if err != nil {
        // 记录错误但不影响查询结果
        log.Printf("Token consumption failed: %v", err)
    }
    
    return nil
}
```

### 批量操作Token消费

```go
// 示例：BatchGo批量操作
func (s *BatchGoService) ProcessURLs(userID string, urls []string, mode string) error {
    var tokenCost int
    var action string
    
    switch mode {
    case "http":
        action = "http"
        tokenCost = 1
    case "puppeteer":
        action = "puppeteer"
        tokenCost = 2
    default:
        return errors.New("不支持的模式")
    }
    
    // 1. 检查Token是否足够
    totalCost := len(urls) * tokenCost
    sufficient, balance, _, err := s.tokenService.CheckTokenSufficiency(
        userID, "batchgo", action, len(urls))
    if err != nil {
        return err
    }
    if !sufficient {
        return fmt.Errorf("Token余额不足，需要%d，当前%d", totalCost, balance)
    }
    
    // 2. 执行批量处理
    taskID := generateTaskID()
    err = s.processBatch(urls, mode, taskID)
    if err != nil {
        return err
    }
    
    // 3. 消费Token
    return s.tokenService.ConsumeTokensByService(
        userID, "batchgo", action, len(urls), taskID)
}
```

## 数据模型

### TokenTransaction 交易记录
```go
type TokenTransaction struct {
    ID          string    `json:"id"`          // 交易ID
    UserID      string    `json:"user_id"`     // 用户ID
    Amount      int       `json:"amount"`      // 变动数量（正数增加，负数消费）
    Balance     int       `json:"balance"`     // 变动后余额
    Type        string    `json:"type"`        // 交易类型
    Description string    `json:"description"` // 描述
    Reference   string    `json:"reference"`   // 关联引用
    CreatedAt   time.Time `json:"created_at"`  // 创建时间
}
```

### TokenConsumptionRule 消费规则
```go
type TokenConsumptionRule struct {
    Service     string `json:"service"`     // 服务名称
    Action      string `json:"action"`      // 操作类型
    TokenCost   int    `json:"token_cost"`  // Token消费数量
    Description string `json:"description"` // 描述
}
```

### RechargePackage 充值包
```go
type RechargePackage struct {
    ID          string  `json:"id"`           // 套餐ID
    Name        string  `json:"name"`         // 套餐名称
    Price       float64 `json:"price"`        // 价格（元）
    TokenAmount int     `json:"token_amount"` // Token数量
    Bonus       int     `json:"bonus"`        // 赠送Token
    Popular     bool    `json:"popular"`      // 是否热门
    Description string  `json:"description"`  // 描述
}
```

## 消费规则详解

### 服务类型常量
```go
const (
    ServiceSiteRank   = "siterank"    // SiteRank服务
    ServiceBatchGo    = "batchgo"     // BatchGo服务
    ServiceChengeLink = "chengelink"  // ChengeLink服务
    ServiceAPI        = "api"         // API服务
)
```

### 操作类型常量
```go
const (
    ActionQuery      = "query"       // 查询操作
    ActionHTTP       = "http"        // HTTP模式
    ActionPuppeteer  = "puppeteer"   // Puppeteer模式
    ActionExtract    = "extract"     // 链接提取
    ActionUpdateAds  = "update_ads"  // 广告更新
    ActionCall       = "call"        // API调用
)
```

### 具体消费规则

| 服务 | 操作 | Token消费 | 说明 |
|------|------|-----------|------|
| siterank | query | 1 | 每次域名查询消费1个Token |
| batchgo | http | 1 | HTTP模式每个URL消费1个Token |
| batchgo | puppeteer | 2 | Puppeteer模式每个URL消费2个Token |
| chengelink | extract | 1 | 每次链接提取消费1个Token |
| chengelink | update_ads | 3 | 每个广告更新消费3个Token |
| api | call | 1 | 每次API调用消费1个Token |

## 安全特性

### 1. 事务安全
- **原子操作**: 余额更新和交易记录在同一事务中
- **并发安全**: 使用数据库事务防止并发问题
- **回滚机制**: 操作失败时自动回滚

### 2. 余额保护
- **预检查**: 消费前检查余额是否足够
- **负余额保护**: 严格防止余额变为负数
- **实时验证**: 每次操作都验证当前余额

### 3. 审计追踪
- **完整记录**: 所有Token变动都有详细记录
- **不可篡改**: 交易记录只能新增，不能修改
- **关联追踪**: 可追踪到具体的业务操作

## 最佳实践

### 1. 服务集成
- 在业务逻辑执行前检查Token
- 业务成功后再消费Token
- 记录详细的消费描述和引用

### 2. 错误处理
- 优雅处理Token不足的情况
- 提供清晰的错误信息
- 记录Token消费失败的日志

### 3. 性能优化
- 批量操作时一次性检查和消费
- 使用缓存减少数据库查询
- 异步处理非关键的Token操作

### 4. 用户体验
- 实时显示Token余额
- 提供消费预估功能
- 清晰的充值引导

## 扩展功能

### 1. Token赠送
- 新用户注册赠送
- 邀请好友赠送
- 活动奖励赠送

### 2. 套餐集成
- 不同套餐的Token包含量
- 套餐到期的Token处理
- 套餐升级的Token补偿

### 3. 统计分析
- Token使用趋势分析
- 服务使用热度统计
- 用户消费行为分析

### 4. 营销功能
- Token优惠券
- 充值活动
- 消费返利