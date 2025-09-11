# Token 经济系统设计

### 6.1 Token 消费规则引擎

```go
// internal/token/rules.go
type ConsumptionRule struct {
    Feature     string                 `json:"feature"`
    Operation   string                 `json:"operation"`
    Condition   map[string]interface{} `json:"condition"`
    Amount      int                    `json:"amount"`
    Priority    int                    `json:"priority"`
}

type RulesEngine struct {
    rules []ConsumptionRule
}

func (re *RulesEngine) Evaluate(feature, operation string, metadata map[string]interface{}) int {
    // 按优先级排序规则
    sort.Slice(re.rules, func(i, j int) bool {
        return re.rules[i].Priority > re.rules[j].Priority
    })
    
    for _, rule := range re.rules {
        if rule.Feature == feature && rule.Operation == operation {
            if re.matchCondition(rule.Condition, metadata) {
                return rule.Amount
            }
        }
    }
    
    return 0 // 默认不消耗
}

func (re *RulesEngine) matchCondition(condition map[string]interface{}, metadata map[string]interface{}) bool {
    // 实现条件匹配逻辑
    for key, expected := range condition {
        if actual, exists := metadata[key]; !exists || actual != expected {
            return false
        }
    }
    return true
}
```

### 6.2 Token 服务实现

```go
// internal/token/service.go
type Service struct {
    db     *store.DB
    redis  *store.Redis
    engine *RulesEngine
}

func (s *Service) PreDeduct(userID string, feature string, estimatedAmount int64, taskID string) error {
    // 检查余额
    balance, err := s.GetBalance(userID)
    if err != nil {
        return err
    }
    
    if balance < estimatedAmount {
        return ErrInsufficientBalance
    }
    
    // 创建预扣费记录
    preDeduct := &TokenPreDeduction{
        ID:        uuid.New().String(),
        UserID:    userID,
        Feature:   feature,
        TaskID:    taskID,
        Amount:    estimatedAmount,
        Status:    "PENDING",
        ExpiresAt: time.Now().Add(time.Hour), // 1小时后过期
    }
    
    // 扣除余额
    if err := s.deductBalance(userID, estimatedAmount, "PRE_DEDUCT", taskID); err != nil {
        return err
    }
    
    return s.db.Create(preDeduct).Error
}

func (s *Service) ConfirmDeduction(userID string, taskID string, actualAmount int64) error {
    // 查找预扣费记录
    var preDeduct TokenPreDeduction
    if err := s.db.Where("user_id = ? AND task_id = ? AND status = ?", userID, taskID, "PENDING").First(&preDeduct).Error; err != nil {
        return err
    }
    
    // 计算差额
    diff := preDeduct.Amount - actualAmount
    
    if diff > 0 {
        // 退还多余的 Token
        if err := s.refundBalance(userID, diff, "REFUND", taskID); err != nil {
            return err
        }
    } else if diff < 0 {
        // 补扣不足的 Token
        if err := s.deductBalance(userID, -diff, "SUPPLEMENT", taskID); err != nil {
            return err
        }
    }
    
    // 更新预扣费状态
    preDeduct.Status = "CONFIRMED"
    preDeduct.ConfirmedAmount = actualAmount
    return s.db.Save(&preDeduct).Error
}
```

### 6.3 套餐权限控制

```go
// internal/subscription/service.go
type Service struct {
    db *store.DB
}

func (s *Service) CheckFeatureAccess(userID, feature string) error {
    user, err := s.getUserWithSubscription(userID)
    if err != nil {
        return err
    }
    
    // 检查套餐权限
    switch user.Plan.Name {
    case "FREE":
        return s.checkFreeAccess(feature)
    case "PRO":
        return s.checkProAccess(feature)
    case "MAX":
        return s.checkMaxAccess(feature)
    default:
        return ErrInvalidPlan
    }
}

func (s *Service) checkFreeAccess(feature string) error {
    allowedFeatures := map[string]bool{
        "BATCHGO_BASIC":     true,
        "SITERANKGO":        true,
        "USER_PROFILE":       true,
    }
    
    if !allowedFeatures[feature] {
        return ErrFeatureNotAvailable
    }
    return nil
}
```