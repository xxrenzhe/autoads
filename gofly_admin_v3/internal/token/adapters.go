package token

import ()

// Adapter 实现 SiteRank/BatchGo 的 TokenService 接口
type Adapter struct { svc *Service }

// NewAdapterWithService 直接注入内部 Service
func NewAdapterWithService(s *Service) *Adapter { return &Adapter{svc: s} }

// CheckTokenSufficiency 检查余额是否足够（按规则 x 数量）
func (a *Adapter) CheckTokenSufficiency(userID, service, action string, quantity int) (bool, int, int, error) {
    if quantity <= 0 { quantity = 1 }
    costPer, err := a.svc.getRuleCost(service, action)
    if err != nil { return false, 0, 0, err }
    total := costPer * quantity
    bal, err := a.svc.GetBalance(userID)
    if err != nil { return false, 0, total, err }
    return bal >= int64(total), int(bal), total, nil
}

// ConsumeTokensByService 消费（按规则 x 数量）
func (a *Adapter) ConsumeTokensByService(userID, service, action string, quantity int, reference string) error {
    return a.svc.Consume(userID, service, action, quantity, reference, nil)
}

// GetBalance 供 AdsCenter 使用
func (a *Adapter) GetBalance(userID string) (int, error) {
    bal, err := a.svc.GetBalance(userID)
    return int(bal), err
}

// AdapterAdsCenter 适配 AdsCenter 的 TokenService
type AdapterAdsCenter struct { svc *Service }

func NewAdsCenterAdapter(s *Service) *AdapterAdsCenter { return &AdapterAdsCenter{svc: s} }

func (a *AdapterAdsCenter) ConsumeTokens(userID string, amount int, description string) error {
    if amount <= 0 { return nil }
    // 作为精确消费记录为 type=consume（不基于规则）
    return a.svc.ConsumeExact(userID, amount, "adscenter", "raw", "", map[string]interface{}{"desc": description})
}

func (a *AdapterAdsCenter) GetBalance(userID string) (int, error) {
    bal, err := a.svc.GetBalance(userID)
    return int(bal), err
}

// 适配器只负责匹配接口，具体 Service 由调用方注入
