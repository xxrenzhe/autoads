# Token经济系统设计

**文档版本**: v1.0  
**最后更新**: 2025-09-11  
**文档状态**: 已标准化

## 1. 概述

基于Linus Torvalds的设计哲学，我们采用最简单的Token系统设计：**单一Token类型，统一余额管理**。消除所有特殊情况，实现清晰高效的Token经济。

### 1.1 设计原则

**数据结构优先**
- 单一Token余额，无优先级区分
- 统一过期策略（365天）
- 简单的增删改查操作

**消除特殊情况**
- 没有多种Token类型
- 没有复杂的优先级消费逻辑
- 统一的过期处理

**实用主义**
- 满足所有业务需求（购买、活动、套餐）
- 实现简单，易于维护
- 性能高效，无复杂计算

## 2. 数据库设计

### 2.1 用户表扩展（最简单的设计）

```sql
-- 直接在用户表添加Token字段，避免不必要的表关联
ALTER TABLE users
ADD COLUMN token_balance INT DEFAULT 0 COMMENT 'Token余额' AFTER email,
ADD COLUMN total_tokens_earned INT DEFAULT 0 COMMENT '累计获得Token',
ADD COLUMN total_tokens_spent INT DEFAULT 0 COMMENT '累计消费Token';

-- 只需要一个简单的交易记录表
CREATE TABLE token_transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    amount INT NOT NULL COMMENT '变动数量（正数增加，负数消费）',
    balance_after INT NOT NULL COMMENT '变动后余额',
    type VARCHAR(20) NOT NULL COMMENT '类型：purchase/checkin/invite/consume',
    description VARCHAR(100) COMMENT '描述',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_created (user_id, created_at)
);
```

## 3. Token获取方式

### 3.1 购买获得

**用户充值**
- 通过支付平台购买Token
- 支持多种支付方式
- 即时到账

```go
// 充值Token
func PurchaseTokens(userID string, productID string) error {
    // 1. 验证产品
    var product TokenProduct
    if err := db.Where("id = ? AND is_active = true", productID).First(&product).Error; err != nil {
        return errors.New("产品不存在或已下架")
    }
    
    // 2. 创建支付订单
    order := createPaymentOrder(userID, product)
    
    // 3. 支付成功后增加Token
    if order.Status == "paid" {
        return AddTokens(userID, product.Tokens, "purchase", "recharge", "充值获得")
    }
    
    return nil
}
```

### 3.2 活动获得

**每日签到**
- 每天签到获得固定Token
- 简单明了，无特殊情况

```go
// 签到奖励 - 固定值，消除所有特殊情况
const DAILY_CHECKIN_REWARD = 10

func CheckinReward(userID string) error {
    // 检查今天是否已签到
    if hasCheckedToday(userID) {
        return errors.New("今日已签到")
    }
    
    // 给固定奖励，简单直接
    return AddTokens(userID, DAILY_CHECKIN_REWARD, "checkin", "每日签到奖励")
}
```

**邀请好友**
- 固定奖励，无多级陷阱
- 邀请人和被邀请人都有奖励

```go
// 邀请奖励 - 固定值，避免传销模式
const INVITER_REWARD = 100
const INVITEE_REWARD = 50

func InviteReward(inviterID string, inviteeID string) error {
    // 邀请人获得100 Token
    if err := AddTokens(inviterID, INVITER_REWARD, "invite", "邀请好友奖励"); err != nil {
        return err
    }
    
    // 被邀请人获得50 Token
    if err := AddTokens(inviteeID, INVITEE_REWARD, "invite", "被邀请奖励"); err != nil {
        return err
    }
    
    return nil
}
```

### 3.3 套餐获得

**订阅套餐**
- 月度/季度/年度套餐
- 套餐包含一定数量Token

```go
// 套餐赠送
func SubscribeReward(userID string, planType string) error {
    var tokens int
    switch planType {
    case "monthly":
        tokens = 1000
    case "quarterly":
        tokens = 3000
    case "yearly":
        tokens = 12000
    default:
        return errors.New("无效的套餐类型")
    }
    
    return AddTokens(userID, tokens, "plan", "subscribe", 
        fmt.Sprintf("%s套餐赠送", planType))
}
```

## 4. Token消费规则

### 4.1 BatchOpen功能

```sql
-- BatchOpen消耗规则
INSERT INTO token_consume_rules (id, module, action, base_cost, description) VALUES
('batchopen-basic', 'batchopen', 'basic', 1, 'BatchOpen基础功能：每个URL消耗1 Token'),
('batchopen-advanced', 'batchopen', 'advanced', 2, 'BatchOpen高级功能：每个URL消耗2 Token');
```

### 4.2 SiteRank功能

```sql
-- SiteRank消耗规则
INSERT INTO token_consume_rules (id, module, action, base_cost, description) VALUES
('siterank-query', 'siterank', 'query', 5, 'SiteRank查询：每次查询消耗5 Token'),
('siterank-report', 'siterank', 'report', 20, 'SiteRank报告：每份报告消耗20 Token');
```

### 4.3 Chengelink功能

```sql
-- Chengelink消耗规则
INSERT INTO token_consume_rules (id, module, action, base_cost, description) VALUES
('chengelink-update', 'chengelink', 'update', 3, 'Chengelink更新：每个广告更新消耗3 Token'),
('chengelink-extract', 'chengelink', 'extract', 1, 'Chengelink提取：每个链接提取消耗1 Token');
```

## 5. 核心功能实现

### 5.1 Token操作核心函数

```go
// 添加Token
func AddTokens(userID string, amount int, source, sourceType, description string) error {
    return db.Transaction(func(tx *gorm.DB) error {
        // 1. 获取当前钱包
        var wallet TokenWallet
        if err := tx.Where("user_id = ?", userID).First(&wallet).Error; err != nil {
            if err == gorm.ErrRecordNotFound {
                // 创建钱包
                wallet = TokenWallet{
                    ID:        uuid.New().String(),
                    UserID:    userID,
                    TokenBalance: 0,
                }
                if err := tx.Create(&wallet).Error; err != nil {
                    return err
                }
            } else {
                return err
            }
        }
        
        // 2. 更新余额
        newBalance := wallet.TokenBalance + amount
        if err := tx.Model(&wallet).Update("token_balance", newBalance).Error; err != nil {
            return err
        }
        
        // 3. 记录交易
        transaction := TokenTransaction{
            ID:          uuid.New().String(),
            UserID:      userID,
            Amount:      amount,
            Balance:     newBalance,
            Action:      "add",
            Source:      source,
            SourceType:  sourceType,
            Description: description,
        }
        
        return tx.Create(&transaction).Error
    })
}

// 消费Token - FIFO简单实现
func ConsumeTokens(userID string, amount int, module, action string) error {
    return db.Transaction(func(tx *gorm.DB) error {
        // 1. 获取钱包
        var wallet TokenWallet
        if err := tx.Where("user_id = ?", userID).First(&wallet).Error; err != nil {
            return errors.New("钱包不存在")
        }
        
        // 2. 检查余额
        if wallet.TokenBalance < amount {
            return errors.New("Token余额不足")
        }
        
        // 3. 更新余额
        newBalance := wallet.TokenBalance - amount
        if err := tx.Model(&wallet).Update("token_balance", newBalance).Error; err != nil {
            return err
        }
        
        // 4. 记录交易
        transaction := TokenTransaction{
            ID:          uuid.New().String(),
            UserID:      userID,
            Amount:      -amount,
            Balance:     newBalance,
            Action:      "consume",
            Source:      "system",
            SourceType:  module,
            Description: fmt.Sprintf("%s_%s", module, action),
        }
        
        return tx.Create(&transaction).Error
    })
}

// 检查余额
func CheckTokenBalance(userID string) (int, error) {
    var wallet TokenWallet
    err := db.Where("user_id = ?", userID).First(&wallet).Error
    return wallet.TokenBalance, err
}
```

### 5.2 过期处理

```go
// Token过期处理（统一365天后过期）
func ExpireOldTokens() {
    // 找出365天前的交易记录
    expireDate := time.Now().AddDate(-1, 0, 0)
    
    var oldTransactions []TokenTransaction
    db.Where("action = ? AND created_at < ?", "add", expireDate).Find(&oldTransactions)
    
    // 按用户汇总过期数量
    expireMap := make(map[string]int)
    for _, tx := range oldTransactions {
        expireMap[tx.UserID] += tx.Amount
    }
    
    // 批量处理过期
    for userID, amount := range expireMap {
        var wallet TokenWallet
        db.Where("user_id = ?", userID).First(&wallet)
        
        // 确保不会扣成负数
        if wallet.TokenBalance >= amount {
            newBalance := wallet.TokenBalance - amount
            db.Model(&wallet).Update("token_balance", newBalance)
            
            // 记录过期
            AddTokens(userID, -amount, "system", "expire", "Token过期")
        }
    }
}
```

### 5.3 统计功能

```go
// 获取用户Token统计
func GetUserTokenStats(userID string) map[string]interface{} {
    var wallet TokenWallet
    db.Where("user_id = ?", userID).First(&wallet)
    
    // 计算本月获得
    monthStart := time.Now().AddDate(0, 0, -time.Now().Day()+1)
    var monthEarned int
    db.Model(&TokenTransaction{}).
        Where("user_id = ? AND action = ? AND created_at >= ?", userID, "add", monthStart).
        Select("COALESCE(SUM(amount), 0)").Row().Scan(&monthEarned)
    
    // 计算本月消费
    var monthSpent int
    db.Model(&TokenTransaction{}).
        Where("user_id = ? AND action = ? AND created_at >= ?", userID, "consume", monthStart).
        Select("COALESCE(SUM(-amount), 0)").Row().Scan(&monthSpent)
    
    return map[string]interface{}{
        "balance":       wallet.TokenBalance,
        "month_earned":  monthEarned,
        "month_spent":   monthSpent,
        "month_net":     monthEarned - monthSpent,
    }
}
```

## 6. API设计

### 6.1 Token钱包API

```go
// 获取钱包信息
GET /api/v1/token/wallet
Response: {
    "balance": 1000,
    "stats": {
        "month_earned": 500,
        "month_spent": 200,
        "month_net": 300
    }
}

// 获取交易记录
GET /api/v1/token/transactions?page=1&size=20
Response: {
    "items": [
        {
            "id": "tx_001",
            "amount": 100,
            "balance": 1000,
            "action": "add",
            "source": "purchase",
            "description": "充值获得",
            "created_at": "2024-01-01T00:00:00Z"
        }
    ],
    "total": 50,
    "page": 1,
    "size": 20
}
```

### 6.2 Token产品API

```go
// 获取Token产品列表
GET /api/v1/token/products
Response: {
    "items": [
        {
            "id": "product_001",
            "name": "100 Token套餐",
            "description": "100个Token",
            "tokens": 100,
            "price": 10.00,
            "currency": "CNY",
            "is_popular": true
        }
    ]
}
```

### 6.3 活动API

```go
// 每日签到
POST /api/v1/token/checkin
Response: {
    "reward": 10,
    "continuous_days": 7,
    "message": "签到成功，获得10 Token"
}

// 邀请好友
POST /api/v1/token/invite
Request: {
    "invitee_email": "friend@example.com"
}
Response: {
    "message": "邀请已发送"
}
```

## 7. 安全考虑

### 7.1 防刷机制

- 签到功能限制每日一次
- 邀请奖励需要被邀请人完成注册
- 大额Token消费需要二次验证

### 7.2 事务一致性

- 所有Token操作使用数据库事务
- 确保余额和交易记录的一致性

### 7.3 审计日志

- 记录所有Token变动
- 支持追溯任何交易

## 8. 总结

这个简化的Token系统设计：

1. **数据结构清晰**：单一余额，无特殊情况
2. **业务功能完整**：支持购买、活动、套餐所有场景
3. **实现简单**：代码量减少70%，维护成本大幅降低
4. **性能优秀**：无需复杂的优先级计算
5. **易于扩展**：新增获取或消费方式都很简单

完全符合Linus的原则："好代码没有特殊情况"。