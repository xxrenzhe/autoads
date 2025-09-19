package user

import (
    "context"
    "errors"
    "fmt"
    "strings"
    "sync"
    "time"

    "gofly-admin-v3/utils/gf"
)

// TokenConsumptionRule Token消费规则
type TokenConsumptionRule struct {
	Service     string `json:"service"`     // 服务名称
	Action      string `json:"action"`      // 操作类型
	TokenCost   int    `json:"token_cost"`  // Token消费数量
	Description string `json:"description"` // 描述
}

// RechargePackage 充值包配置
type RechargePackage struct {
	ID          string  `json:"id"`           // 套餐ID
	Name        string  `json:"name"`         // 套餐名称
	Price       float64 `json:"price"`        // 价格（元）
	TokenAmount int     `json:"token_amount"` // Token数量
	Bonus       int     `json:"bonus"`        // 赠送Token
	Popular     bool    `json:"popular"`      // 是否热门
	Description string  `json:"description"`  // 描述
}

// TokenConfigService Token配置服务
type TokenConfigService struct {
    consumptionRules []TokenConsumptionRule
    rechargePackages []RechargePackage
    // fast lookup index: key = service|action
    mu    sync.RWMutex
    rules map[string]TokenConsumptionRule
    // optional TTL reload (defensive)
    lastLoaded time.Time
    ttl        time.Duration
}

// NewTokenConfigService 创建Token配置服务
func NewTokenConfigService() *TokenConfigService {
    s := &TokenConfigService{
        consumptionRules: getDefaultConsumptionRules(),
        rechargePackages: getDefaultRechargePackages(),
        rules:            map[string]TokenConsumptionRule{},
        ttl:              5 * time.Minute,
    }
    s.rebuildRuleIndex(s.consumptionRules)
    // overlay with DB rules (is_active=1)
    _ = s.reloadFromDB()
    // subscribe hot reload via Redis
    go s.subscribeReload()
    return s
}

func ruleKey(svc, act string) string { return strings.ToLower(strings.TrimSpace(svc)) + "|" + strings.ToLower(strings.TrimSpace(act)) }

func (s *TokenConfigService) rebuildRuleIndex(rules []TokenConsumptionRule) {
    s.mu.Lock()
    defer s.mu.Unlock()
    idx := make(map[string]TokenConsumptionRule, len(rules))
    for _, r := range rules {
        idx[ruleKey(r.Service, r.Action)] = r
    }
    s.rules = idx
    s.lastLoaded = time.Now()
}

func (s *TokenConfigService) reloadFromDB() error {
    db := gf.DB()
    if db == nil { return nil }
    rows, err := db.Model("token_consumption_rules").Where("is_active = 1").Order("service, action").All()
    if err != nil { return err }
    // start from defaults, overlay DB
    base := getDefaultConsumptionRules()
    // overlay map
    m := make(map[string]TokenConsumptionRule, len(base)+len(rows))
    for _, r := range base { m[ruleKey(r.Service, r.Action)] = r }
    for _, row := range rows {
        svc := strings.ToLower(strings.TrimSpace(row["service"].String()))
        act := strings.ToLower(strings.TrimSpace(row["action"].String()))
        m[ruleKey(svc, act)] = TokenConsumptionRule{
            Service:     svc,
            Action:      act,
            TokenCost:   row["token_cost"].Int(),
            Description: row["description"].String(),
        }
    }
    // flatten back to slice (optional)
    list := make([]TokenConsumptionRule, 0, len(m))
    for _, v := range m { list = append(list, v) }
    s.consumptionRules = list
    s.rebuildRuleIndex(list)
    return nil
}

func (s *TokenConfigService) subscribeReload() {
    r := gf.Redis(); if r == nil { return }
    ctx := context.Background()
    conn, _, err := r.GroupPubSub().Subscribe(ctx, "token:rules:update")
    if err != nil { return }
    for {
        _, err := conn.ReceiveMessage(ctx)
        if err == nil {
            _ = s.reloadFromDB()
        } else {
            time.Sleep(100 * time.Millisecond)
        }
    }
}

// getDefaultConsumptionRules 获取默认消费规则
func getDefaultConsumptionRules() []TokenConsumptionRule {
    return []TokenConsumptionRule{
		{
			Service:     "siterank",
			Action:      "query",
			TokenCost:   1,
			Description: "SiteRank域名查询",
		},
		{
			Service:     "batchgo",
			Action:      "http",
			TokenCost:   1,
			Description: "BatchGo HTTP模式（每个URL）",
		},
		{
			Service:     "batchgo",
			Action:      "puppeteer",
			TokenCost:   2,
			Description: "BatchGo Puppeteer模式（每个URL）",
		},
        {
            Service:     "adscenter",
            Action:      "extract",
            TokenCost:   1,
            Description: "自动化广告链接提取",
        },
        {
            Service:     "adscenter",
            Action:      "update_ads",
            TokenCost:   3,
            Description: "自动化广告更新（每个广告）",
        },
		{
			Service:     "api",
			Action:      "call",
			TokenCost:   1,
			Description: "API调用",
		},
		{
			Service:     ServiceAdsCenter,
			Action:      "update",
			TokenCost:   3,
			Description: "AdsCenter 更新/执行（每项）",
		},
    }
}

// getDefaultRechargePackages 获取默认充值包
func getDefaultRechargePackages() []RechargePackage {
	return []RechargePackage{
		{
			ID:          "starter",
			Name:        "入门包",
			Price:       29.00,
			TokenAmount: 2000,
			Bonus:       200,
			Popular:     false,
			Description: "适合轻度使用",
		},
		{
			ID:          "basic",
			Name:        "基础包",
			Price:       99.00,
			TokenAmount: 10000,
			Bonus:       1000,
			Popular:     true,
			Description: "最受欢迎，性价比最高",
		},
		{
			ID:          "pro",
			Name:        "专业包",
			Price:       299.00,
			TokenAmount: 50000,
			Bonus:       8000,
			Popular:     false,
			Description: "适合专业用户",
		},
		{
			ID:          "enterprise",
			Name:        "企业包",
			Price:       999.00,
			TokenAmount: 200000,
			Bonus:       50000,
			Popular:     false,
			Description: "企业级大批量使用",
		},
	}
}

// GetConsumptionRule 获取消费规则
func (s *TokenConfigService) GetConsumptionRule(service, action string) (*TokenConsumptionRule, error) {
    // defensive TTL reload
    if time.Since(s.lastLoaded) > s.ttl { _ = s.reloadFromDB() }
    s.mu.RLock(); defer s.mu.RUnlock()
    if r, ok := s.rules[ruleKey(service, action)]; ok {
        return &r, nil
    }
    return nil, fmt.Errorf("未找到服务 %s 操作 %s 的消费规则", service, action)
}

// GetAllConsumptionRules 获取所有消费规则
func (s *TokenConfigService) GetAllConsumptionRules() []TokenConsumptionRule {
    if time.Since(s.lastLoaded) > s.ttl { _ = s.reloadFromDB() }
    s.mu.RLock(); defer s.mu.RUnlock()
    // return stable snapshot
    out := make([]TokenConsumptionRule, 0, len(s.rules))
    for _, v := range s.rules { out = append(out, v) }
    return out
}

// GetRechargePackage 获取充值包
func (s *TokenConfigService) GetRechargePackage(packageID string) (*RechargePackage, error) {
	for _, pkg := range s.rechargePackages {
		if pkg.ID == packageID {
			return &pkg, nil
		}
	}
	return nil, fmt.Errorf("未找到充值包 %s", packageID)
}

// GetAllRechargePackages 获取所有充值包
func (s *TokenConfigService) GetAllRechargePackages() []RechargePackage {
	return s.rechargePackages
}

// CalculateTokenCost 计算Token消费
func (s *TokenConfigService) CalculateTokenCost(service, action string, quantity int) (int, error) {
	rule, err := s.GetConsumptionRule(service, action)
	if err != nil {
		return 0, err
	}

	if quantity <= 0 {
		return 0, errors.New("数量必须大于0")
	}

	return rule.TokenCost * quantity, nil
}

// ValidateTokenConsumption 验证Token消费
func (s *TokenConfigService) ValidateTokenConsumption(service, action string, quantity int, userBalance int) error {
	totalCost, err := s.CalculateTokenCost(service, action, quantity)
	if err != nil {
		return err
	}

	if userBalance < totalCost {
		return fmt.Errorf("Token余额不足，需要 %d Token，当前余额 %d Token", totalCost, userBalance)
	}

	return nil
}

// GetTokenCostDescription 获取Token消费描述
func (s *TokenConfigService) GetTokenCostDescription(service, action string, quantity int) string {
	rule, err := s.GetConsumptionRule(service, action)
	if err != nil {
		return fmt.Sprintf("未知服务消费：%s-%s", service, action)
	}

	if quantity == 1 {
		return rule.Description
	}

	return fmt.Sprintf("%s（%d次）", rule.Description, quantity)
}

// ServiceType 服务类型常量
const (
    ServiceSiteRank  = "siterank"
    ServiceBatchGo   = "batchgo"
    ServiceAdsCenter = "adscenter"
    ServiceAPI       = "api"
)

// ActionType 操作类型常量
const (
	ActionQuery     = "query"
	ActionHTTP      = "http"
	ActionPuppeteer = "puppeteer"
	ActionExtract   = "extract"
	ActionUpdateAds = "update_ads"
	ActionCall      = "call"
)

// 预定义的消费规则常量
var (
	// SiteRank服务
	CostSiteRankQuery = TokenConsumptionRule{
		Service: ServiceSiteRank, Action: ActionQuery, TokenCost: 1,
		Description: "SiteRank域名查询",
	}

	// BatchGo服务
	CostBatchGoHTTP = TokenConsumptionRule{
		Service: ServiceBatchGo, Action: ActionHTTP, TokenCost: 1,
		Description: "BatchGo HTTP模式（每个URL）",
	}
	CostBatchGoPuppeteer = TokenConsumptionRule{
		Service: ServiceBatchGo, Action: ActionPuppeteer, TokenCost: 2,
		Description: "BatchGo Puppeteer模式（每个URL）",
	}

    // AdsCenter 服务
    CostAdsCenterExtract = TokenConsumptionRule{
        Service: ServiceAdsCenter, Action: ActionExtract, TokenCost: 1,
        Description: "自动化广告链接提取",
    }
    CostAdsCenterUpdateAds = TokenConsumptionRule{
        Service: ServiceAdsCenter, Action: ActionUpdateAds, TokenCost: 3,
        Description: "自动化广告更新（每个广告）",
    }
    // 兼容保留：CostAdsCenterUpdate（旧命名）
    CostAdsCenterUpdate = TokenConsumptionRule{
        Service: ServiceAdsCenter, Action: "update", TokenCost: 3,
        Description: "AdsCenter 更新/执行（每项）",
    }

	// API服务
	CostAPICall = TokenConsumptionRule{
		Service: ServiceAPI, Action: ActionCall, TokenCost: 1,
		Description: "API调用",
	}
)
