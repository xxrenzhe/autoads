package token

import (
    "context"
    "errors"
    "fmt"
    "strings"
    "time"

    "gofly-admin-v3/internal/audit"
    "gofly-admin-v3/internal/cache"
    "gofly-admin-v3/utils/gf"
    "gofly-admin-v3/utils/gform"
)

// 统一错误码（上层可使用 errors.Is(err, ErrInsufficientTokens) 判断）
var ErrInsufficientTokens = errors.New("ERR_INSUFFICIENT_TOKENS")

// Service Token服务
type Service struct {
    db gform.DB
}

func NewService(db gform.DB) *Service { return &Service{db: db} }

// GetBalance 返回用户Token余额（带缓存）
func (s *Service) GetBalance(userID string) (int64, error) {
    key := "user:tokens:" + userID
    var cached int64
    if err := cache.GetCache().Get(key, &cached); err == nil { return cached, nil }
    rec, err := s.db.Model("users").Where("id=?", userID).One()
    if err != nil || rec == nil { return 0, fmt.Errorf("user not found") }
    bal := rec["token_balance"].Int64()
    _ = cache.GetCache().Set(key, bal, 60*time.Second)
    return bal, nil
}

// getRuleCost 获取服务/动作的每次消耗
func (s *Service) getRuleCost(service, action string) (int, error) {
    cacheKey := fmt.Sprintf("token:rule:%s:%s", strings.ToLower(service), strings.ToLower(action))
    var cost int
    if err := cache.GetCache().Get(cacheKey, &cost); err == nil { return cost, nil }
    rec, err := s.db.Model("token_consumption_rules").Where("service=? AND action=? AND is_active=1", strings.ToLower(service), strings.ToLower(action)).One()
    if err != nil || rec == nil { return 0, fmt.Errorf("rule not found") }
    cost = rec["token_cost"].Int()
    _ = cache.GetCache().Set(cacheKey, cost, 5*time.Minute)
    return cost, nil
}

// Consume 消耗Token（原子，失败回滚）
func (s *Service) Consume(userID, service, action string, count int, refID string, details interface{}) error {
    if count <= 0 { count = 1 }
    costPer, err := s.getRuleCost(service, action)
    if err != nil { return err }
    total := costPer * count
    ctx := context.Background()
    return s.db.Model("users").Transaction(ctx, func(ctx context.Context, tx gform.TX) error {
        // 乐观扣减：仅当余额足够
        res, err := tx.Exec("UPDATE users SET token_balance = token_balance - ? WHERE id = ? AND token_balance >= ?", total, userID, total)
        if err != nil { return err }
        if n, _ := res.RowsAffected(); n == 0 { return ErrInsufficientTokens }
        // 插入流水
        if _, err := tx.Model("token_transactions").Insert(gf.Map{
            "user_id": userID, "amount": -total, "type": "consume",
            "service": service, "action": action, "ref_id": refID, "details": details,
        }); err != nil { return err }
        audit.LogUserAction(userID, "token_consume", "token", refID, gf.Map{"service": service, "action": action, "amount": total}, "", "", true, "", 0)
        return nil
    })
}

// Adjust 调整余额（管理员）
func (s *Service) Adjust(userID string, delta int, reason string) error {
    ctx := context.Background()
    return s.db.Model("users").Transaction(ctx, func(ctx context.Context, tx gform.TX) error {
        if _, err := tx.Exec("UPDATE users SET token_balance = token_balance + ? WHERE id = ?", delta, userID); err != nil { return err }
        if _, err := tx.Model("token_transactions").Insert(gf.Map{
            "user_id": userID, "amount": delta, "type": "adjust", "details": gf.Map{"reason": reason},
        }); err != nil { return err }
        audit.LogUserAction(userID, "token_adjust", "token", "", gf.Map{"delta": delta, "reason": reason}, "", "", true, "", 0)
        return nil
    })
}

// PurchasePackage 按套餐充值（管理员或模拟支付）
func (s *Service) PurchasePackage(userID, packageID string) error {
    rec, err := s.db.Model("token_packages").Where("id=? AND is_active=1", packageID).One()
    if err != nil || rec == nil { return fmt.Errorf("package not found") }
    amount := rec["token_amount"].Int() + rec["bonus_tokens"].Int()
    ctx := context.Background()
    return s.db.Model("users").Transaction(ctx, func(ctx context.Context, tx gform.TX) error {
        if _, err := tx.Exec("UPDATE users SET token_balance = token_balance + ? WHERE id = ?", amount, userID); err != nil { return err }
        if _, err := tx.Model("token_transactions").Insert(gf.Map{
            "user_id": userID, "amount": amount, "type": "purchase", "ref_id": packageID,
        }); err != nil { return err }
        audit.LogUserAction(userID, "token_purchase", "token", packageID, gf.Map{"amount": amount}, "", "", true, "", 0)
        return nil
    })
}

// ConsumeExact 精确消费指定数量Token（不走规则）
func (s *Service) ConsumeExact(userID string, amount int, service, action, refID string, details interface{}) error {
    if amount <= 0 { return nil }
    ctx := context.Background()
    return s.db.Model("users").Transaction(ctx, func(ctx context.Context, tx gform.TX) error {
        res, err := tx.Exec("UPDATE users SET token_balance = token_balance - ? WHERE id = ? AND token_balance >= ?", amount, userID, amount)
        if err != nil { return err }
        if n, _ := res.RowsAffected(); n == 0 { return ErrInsufficientTokens }
        if _, err := tx.Model("token_transactions").Insert(gf.Map{
            "user_id": userID, "amount": -amount, "type": "consume",
            "service": service, "action": action, "ref_id": refID, "details": details,
        }); err != nil { return err }
        audit.LogUserAction(userID, "token_consume", "token", refID, gf.Map{"service": service, "action": action, "amount": amount}, "", "", true, "", 0)
        return nil
    })
}

// ListTransactions 列出流水
func (s *Service) ListTransactions(userID string, page, size int) (gform.Result, int64, error) {
    if page <= 0 { page = 1 }
    if size <= 0 || size > 200 { size = 20 }
    q := s.db.Model("token_transactions").Where("user_id = ?", userID)
    total, err := q.Count()
    if err != nil { return nil, 0, err }
    list, err := q.Order("created_at DESC").Offset((page-1)*size).Limit(size).All()
    return list, int64(total), err
}
