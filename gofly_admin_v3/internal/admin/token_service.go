package admin

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// TokenService Token管理服务
type TokenService struct {
	db *gorm.DB
}

// NewTokenService 创建Token管理服务
func NewTokenService(db *gorm.DB) *TokenService {
	return &TokenService{db: db}
}

// GetTokenPackages 获取Token充值包列表
func (s *TokenService) GetTokenPackages() ([]TokenPackage, error) {
	var packages []TokenPackage

	if err := s.db.Order("sort_order ASC, id ASC").Find(&packages).Error; err != nil {
		return nil, fmt.Errorf("获取Token充值包列表失败: %w", err)
	}

	return packages, nil
}

// CreateTokenPackage 创建Token充值包
func (s *TokenService) CreateTokenPackage(req *CreateTokenPackageRequest) (*TokenPackage, error) {
	pkg := &TokenPackage{
		Name:        req.Name,
		TokenAmount: req.TokenAmount,
		Price:       req.Price,
		BonusTokens: req.BonusTokens,
		Description: req.Description,
		IsActive:    true,
		SortOrder:   req.SortOrder,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.db.Create(pkg).Error; err != nil {
		return nil, fmt.Errorf("创建Token充值包失败: %w", err)
	}

	return pkg, nil
}

// UpdateTokenPackage 更新Token充值包
func (s *TokenService) UpdateTokenPackage(id uint, req *UpdateTokenPackageRequest) (*TokenPackage, error) {
	var pkg TokenPackage
	if err := s.db.Where("id = ?", id).First(&pkg).Error; err != nil {
		return nil, fmt.Errorf("Token充值包不存在: %w", err)
	}

	// 更新字段
	if req.Name != "" {
		pkg.Name = req.Name
	}
	if req.TokenAmount > 0 {
		pkg.TokenAmount = req.TokenAmount
	}
	if req.Price >= 0 {
		pkg.Price = req.Price
	}
	if req.BonusTokens >= 0 {
		pkg.BonusTokens = req.BonusTokens
	}
	if req.Description != "" {
		pkg.Description = req.Description
	}
	if req.SortOrder >= 0 {
		pkg.SortOrder = req.SortOrder
	}

	pkg.UpdatedAt = time.Now()

	if err := s.db.Save(&pkg).Error; err != nil {
		return nil, fmt.Errorf("更新Token充值包失败: %w", err)
	}

	return &pkg, nil
}

// ToggleTokenPackageStatus 切换Token充值包状态
func (s *TokenService) ToggleTokenPackageStatus(id uint) error {
	var pkg TokenPackage
	if err := s.db.Where("id = ?", id).First(&pkg).Error; err != nil {
		return fmt.Errorf("Token充值包不存在: %w", err)
	}

	pkg.IsActive = !pkg.IsActive
	pkg.UpdatedAt = time.Now()

	if err := s.db.Save(&pkg).Error; err != nil {
		return fmt.Errorf("更新Token充值包状态失败: %w", err)
	}

	return nil
}

// DeleteTokenPackage 删除Token充值包
func (s *TokenService) DeleteTokenPackage(id uint) error {
	if err := s.db.Delete(&TokenPackage{}, id).Error; err != nil {
		return fmt.Errorf("删除Token充值包失败: %w", err)
	}

	return nil
}

// GetTokenConsumptionRules 获取Token消费规则
func (s *TokenService) GetTokenConsumptionRules() ([]TokenConsumptionRule, error) {
	var rules []TokenConsumptionRule

	if err := s.db.Order("service ASC, action ASC").Find(&rules).Error; err != nil {
		return nil, fmt.Errorf("获取Token消费规则失败: %w", err)
	}

	return rules, nil
}

// CreateTokenConsumptionRule 创建Token消费规则
func (s *TokenService) CreateTokenConsumptionRule(req *CreateTokenRuleRequest) (*TokenConsumptionRule, error) {
	// 检查规则是否已存在
	var count int64
	if err := s.db.Model(&TokenConsumptionRule{}).
		Where("service = ? AND action = ?", req.Service, req.Action).
		Count(&count).Error; err != nil {
		return nil, fmt.Errorf("检查规则失败: %w", err)
	}

	if count > 0 {
		return nil, fmt.Errorf("该服务的消费规则已存在")
	}

	rule := &TokenConsumptionRule{
		Service:     req.Service,
		Action:      req.Action,
		TokenCost:   req.TokenCost,
		Description: req.Description,
		IsActive:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.db.Create(rule).Error; err != nil {
		return nil, fmt.Errorf("创建Token消费规则失败: %w", err)
	}

	return rule, nil
}

// UpdateTokenConsumptionRule 更新Token消费规则
func (s *TokenService) UpdateTokenConsumptionRule(id uint, req *UpdateTokenRuleRequest) (*TokenConsumptionRule, error) {
	var rule TokenConsumptionRule
	if err := s.db.Where("id = ?", id).First(&rule).Error; err != nil {
		return nil, fmt.Errorf("Token消费规则不存在: %w", err)
	}

	// 更新字段
	if req.TokenCost >= 0 {
		rule.TokenCost = req.TokenCost
	}
	if req.Description != "" {
		rule.Description = req.Description
	}

	rule.UpdatedAt = time.Now()

	if err := s.db.Save(&rule).Error; err != nil {
		return nil, fmt.Errorf("更新Token消费规则失败: %w", err)
	}

	return &rule, nil
}

// ToggleTokenRuleStatus 切换Token消费规则状态
func (s *TokenService) ToggleTokenRuleStatus(id uint) error {
	var rule TokenConsumptionRule
	if err := s.db.Where("id = ?", id).First(&rule).Error; err != nil {
		return fmt.Errorf("Token消费规则不存在: %w", err)
	}

	rule.IsActive = !rule.IsActive
	rule.UpdatedAt = time.Now()

	if err := s.db.Save(&rule).Error; err != nil {
		return fmt.Errorf("更新Token消费规则状态失败: %w", err)
	}

	return nil
}

// DeleteTokenConsumptionRule 删除Token消费规则
func (s *TokenService) DeleteTokenConsumptionRule(id uint) error {
	if err := s.db.Delete(&TokenConsumptionRule{}, id).Error; err != nil {
		return fmt.Errorf("删除Token消费规则失败: %w", err)
	}

	return nil
}

// GetInvitationRanking 获取邀请排行榜
func (s *TokenService) GetInvitationRanking(limit int) ([]InvitationRanking, error) {
	var rankings []InvitationRanking

	query := `
		SELECT 
			u.id as user_id,
			u.username,
			u.email,
			COALESCE(inv.invitation_count, 0) as invitation_count,
			COALESCE(inv.successful_count, 0) as successful_count,
			COALESCE(tokens.reward_tokens, 0) as reward_tokens,
			COALESCE(inv.successful_count * 30, 0) as reward_pro_days
		FROM users u
		LEFT JOIN (
			SELECT 
				inviter_id,
				COUNT(*) as invitation_count,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count
			FROM invitations
			GROUP BY inviter_id
		) inv ON u.id = inv.inviter_id
		LEFT JOIN (
			SELECT 
				user_id,
				SUM(CASE WHEN description LIKE '%邀请奖励%' THEN amount ELSE 0 END) as reward_tokens
			FROM token_transactions
			GROUP BY user_id
		) tokens ON u.id = tokens.user_id
		WHERE inv.invitation_count > 0
		ORDER BY inv.successful_count DESC, inv.invitation_count DESC
		LIMIT ?
	`

	if err := s.db.Raw(query, limit).Scan(&rankings).Error; err != nil {
		return nil, fmt.Errorf("获取邀请排行榜失败: %w", err)
	}

	return rankings, nil
}

// GetTokenStats 获取Token统计信息
func (s *TokenService) GetTokenStats() (*TokenStats, error) {
	stats := &TokenStats{}

	// 总Token统计
	var totalStats struct {
		TotalEarned   int64
		TotalConsumed int64
	}

	if err := s.db.Model(&TokenTransaction{}).
		Select("SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_consumed").
		Scan(&totalStats).Error; err != nil {
		return nil, fmt.Errorf("获取Token总统计失败: %w", err)
	}

	stats.TotalTokensEarned = totalStats.TotalEarned
	stats.TotalTokensConsumed = totalStats.TotalConsumed

	// 今日Token统计
	today := time.Now().Format("2006-01-02")
	var todayStats struct {
		TodayEarned   int64
		TodayConsumed int64
	}

	if err := s.db.Model(&TokenTransaction{}).
		Select("SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as today_earned, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as today_consumed").
		Where("DATE(created_at) = ?", today).
		Scan(&todayStats).Error; err != nil {
		return nil, fmt.Errorf("获取今日Token统计失败: %w", err)
	}

	stats.TodayTokensEarned = todayStats.TodayEarned
	stats.TodayTokensConsumed = todayStats.TodayConsumed

	// 用户余额统计
	var balanceStats struct {
		TotalBalance int64
		AvgBalance   float64
	}

	if err := s.db.Model(&User{}).
		Select("SUM(token_balance) as total_balance, AVG(token_balance) as avg_balance").
		Scan(&balanceStats).Error; err != nil {
		return nil, fmt.Errorf("获取用户余额统计失败: %w", err)
	}

	stats.TotalUserBalance = balanceStats.TotalBalance
	stats.AverageUserBalance = balanceStats.AvgBalance

	// 活跃用户统计
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	if err := s.db.Model(&User{}).
		Where("last_login_at > ?", sevenDaysAgo).
		Count(&stats.ActiveUsers).Error; err != nil {
		return nil, fmt.Errorf("获取活跃用户统计失败: %w", err)
	}

	return stats, nil
}

// 请求结构体
type CreateTokenPackageRequest struct {
	Name        string  `json:"name" binding:"required"`
	TokenAmount int     `json:"token_amount" binding:"required,min=1"`
	Price       float64 `json:"price" binding:"required,min=0"`
	BonusTokens int     `json:"bonus_tokens"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sort_order"`
}

type UpdateTokenPackageRequest struct {
	Name        string  `json:"name"`
	TokenAmount int     `json:"token_amount"`
	Price       float64 `json:"price"`
	BonusTokens int     `json:"bonus_tokens"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sort_order"`
}

type CreateTokenRuleRequest struct {
	Service     string `json:"service" binding:"required"`
	Action      string `json:"action" binding:"required"`
	TokenCost   int    `json:"token_cost" binding:"required,min=0"`
	Description string `json:"description"`
}

type UpdateTokenRuleRequest struct {
	TokenCost   int    `json:"token_cost"`
	Description string `json:"description"`
}

// TokenStats Token统计信息
type TokenStats struct {
	TotalTokensEarned   int64   `json:"total_tokens_earned"`
	TotalTokensConsumed int64   `json:"total_tokens_consumed"`
	TodayTokensEarned   int64   `json:"today_tokens_earned"`
	TodayTokensConsumed int64   `json:"today_tokens_consumed"`
	TotalUserBalance    int64   `json:"total_user_balance"`
	AverageUserBalance  float64 `json:"average_user_balance"`
	ActiveUsers         int64   `json:"active_users"`
}
