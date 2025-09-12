package subscription

import (
	"errors"

	"gofly-admin-v3/internal/store"
)

var (
	ErrFeatureNotAvailable = errors.New("feature not available for this plan")
	ErrInvalidPlan         = errors.New("invalid subscription plan")
)

// Plan 订阅套餐
type Plan struct {
	ID          string  `json:"id" gorm:"primaryKey"`
	Name        string  `json:"name" gorm:"unique;not null"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Duration    int     `json:"duration"` // 天数
	TokenBonus  int64   `json:"token_bonus"`
	Features    string  `json:"features"` // JSON格式存储特性
	Status      string  `json:"status" gorm:"default:'ACTIVE'"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// Subscription 用户订阅
type Subscription struct {
	ID        string `json:"id" gorm:"primaryKey"`
	UserID    string `json:"user_id"`
	PlanID    string `json:"plan_id"`
	Status    string `json:"status" gorm:"default:'ACTIVE'"`
	StartedAt string `json:"started_at"`
	EndedAt   string `json:"ended_at"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// Service 订阅服务
type Service struct {
	db *store.DB
}

// NewService 创建订阅服务
func NewService(db *store.DB) *Service {
	return &Service{db: db}
}

// GetPlan 获取套餐信息
func (s *Service) GetPlan(planID string) (*Plan, error) {
	var plan Plan
	err := s.db.First(&plan, "id = ?", planID).Error
	return &plan, err
}

// GetUserSubscription 获取用户订阅
func (s *Service) GetUserSubscription(userID string) (*Subscription, error) {
	var sub Subscription
	err := s.db.Where("user_id = ? AND status = ?", userID, "ACTIVE").
		First(&sub).Error
	return &sub, err
}

// CheckFeatureAccess 检查功能访问权限
func (s *Service) CheckFeatureAccess(userID, feature string) error {
	userSub, err := s.GetUserSubscription(userID)
	if err != nil {
		// 没有订阅，使用免费套餐
		return s.checkFreeAccess(feature)
	}

	plan, err := s.GetPlan(userSub.PlanID)
	if err != nil {
		return ErrInvalidPlan
	}

	switch plan.Name {
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

// checkFreeAccess 检查免费套餐权限
func (s *Service) checkFreeAccess(feature string) error {
	allowedFeatures := map[string]bool{
		"BATCHGO_BASIC": true,
		"SITERANKGO":    true,
		"USER_PROFILE":  true,
	}

	if !allowedFeatures[feature] {
		return ErrFeatureNotAvailable
	}
	return nil
}

// checkProAccess 检查专业套餐权限
func (s *Service) checkProAccess(feature string) error {
	allowedFeatures := map[string]bool{
		"BATCHGO_BASIC":    true,
		"BATCHGO_ADVANCED": true,
		"SITERANKGO":       true,
		"ADSCENTERGO":      true,
		"USER_PROFILE":     true,
	}

	if !allowedFeatures[feature] {
		return ErrFeatureNotAvailable
	}
	return nil
}

// checkMaxAccess 检查企业套餐权限
func (s *Service) checkMaxAccess(feature string) error {
	// 企业套餐可使用所有功能
	return nil
}
