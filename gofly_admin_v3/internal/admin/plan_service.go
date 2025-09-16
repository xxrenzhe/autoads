package admin

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// PlanService 套餐管理服务
type PlanService struct {
	db *gorm.DB
}

// NewPlanService 创建套餐管理服务
func NewPlanService(db *gorm.DB) *PlanService {
	return &PlanService{db: db}
}

// GetPlans 获取套餐列表
func (s *PlanService) GetPlans() ([]PlanConfig, error) {
	var plans []PlanConfig

	if err := s.db.Order("name ASC").Find(&plans).Error; err != nil {
		return nil, fmt.Errorf("获取套餐列表失败: %w", err)
	}

	return plans, nil
}

// GetPlan 获取套餐详情
func (s *PlanService) GetPlan(id uint) (*PlanConfig, error) {
	var plan PlanConfig

	if err := s.db.Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, fmt.Errorf("套餐不存在: %w", err)
	}

	return &plan, nil
}

// CreatePlan 创建套餐
func (s *PlanService) CreatePlan(req *CreatePlanRequest) (*PlanConfig, error) {
	// 验证套餐名称唯一性
	var count int64
	if err := s.db.Model(&PlanConfig{}).Where("name = ?", req.Name).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("检查套餐名称失败: %w", err)
	}

	if count > 0 {
		return nil, fmt.Errorf("套餐名称已存在")
	}

    plan := &PlanConfig{
		Name:               req.Name,
		DisplayName:        req.DisplayName,
		Description:        req.Description,
		Price:              req.Price,
		Duration:           req.Duration,
        BatchGoEnabled:       req.BatchGoEnabled,
        SiteRankEnabled:      req.SiteRankEnabled,
        AdsCenterEnabled:     req.AdsCenterEnabled,
        MaxBatchSize:         req.MaxBatchSize,
        MaxConcurrency:       req.MaxConcurrency,
        MaxSiteRankQueries:   req.MaxSiteRankQueries,
        MaxAdsCenterAccounts: req.MaxAdsCenterAccounts,
		InitialTokens:      req.InitialTokens,
		DailyTokens:        req.DailyTokens,
		IsActive:           true,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	if err := s.db.Create(plan).Error; err != nil {
		return nil, fmt.Errorf("创建套餐失败: %w", err)
	}

	return plan, nil
}

// UpdatePlan 更新套餐
func (s *PlanService) UpdatePlan(id uint, req *UpdatePlanRequest) (*PlanConfig, error) {
	var plan PlanConfig
	if err := s.db.Where("id = ?", id).First(&plan).Error; err != nil {
		return nil, fmt.Errorf("套餐不存在: %w", err)
	}

	// 如果要更新名称，检查唯一性
	if req.Name != "" && req.Name != plan.Name {
		var count int64
		if err := s.db.Model(&PlanConfig{}).Where("name = ? AND id != ?", req.Name, id).Count(&count).Error; err != nil {
			return nil, fmt.Errorf("检查套餐名称失败: %w", err)
		}

		if count > 0 {
			return nil, fmt.Errorf("套餐名称已存在")
		}
		plan.Name = req.Name
	}

	// 更新字段
	if req.DisplayName != "" {
		plan.DisplayName = req.DisplayName
	}
	if req.Description != "" {
		plan.Description = req.Description
	}
	if req.Price >= 0 {
		plan.Price = req.Price
	}
	if req.Duration > 0 {
		plan.Duration = req.Duration
	}

	// 功能权限
    plan.BatchGoEnabled = req.BatchGoEnabled
    plan.SiteRankEnabled = req.SiteRankEnabled
    plan.AdsCenterEnabled = req.AdsCenterEnabled

	// 参数限制
	if req.MaxBatchSize > 0 {
		plan.MaxBatchSize = req.MaxBatchSize
	}
	if req.MaxConcurrency > 0 {
		plan.MaxConcurrency = req.MaxConcurrency
	}
    if req.MaxSiteRankQueries >= 0 {
        plan.MaxSiteRankQueries = req.MaxSiteRankQueries
    }
    if req.MaxAdsCenterAccounts >= 0 {
        plan.MaxAdsCenterAccounts = req.MaxAdsCenterAccounts
    }

	// Token相关
	if req.InitialTokens >= 0 {
		plan.InitialTokens = req.InitialTokens
	}
	if req.DailyTokens >= 0 {
		plan.DailyTokens = req.DailyTokens
	}

	plan.UpdatedAt = time.Now()

	if err := s.db.Save(&plan).Error; err != nil {
		return nil, fmt.Errorf("更新套餐失败: %w", err)
	}

	return &plan, nil
}

// TogglePlanStatus 切换套餐状态
func (s *PlanService) TogglePlanStatus(id uint) error {
	var plan PlanConfig
	if err := s.db.Where("id = ?", id).First(&plan).Error; err != nil {
		return fmt.Errorf("套餐不存在: %w", err)
	}

	plan.IsActive = !plan.IsActive
	plan.UpdatedAt = time.Now()

	if err := s.db.Save(&plan).Error; err != nil {
		return fmt.Errorf("更新套餐状态失败: %w", err)
	}

	return nil
}

// DeletePlan 删除套餐
func (s *PlanService) DeletePlan(id uint) error {
	// 检查是否有用户正在使用该套餐
	var plan PlanConfig
	if err := s.db.Where("id = ?", id).First(&plan).Error; err != nil {
		return fmt.Errorf("套餐不存在: %w", err)
	}

	var userCount int64
	if err := s.db.Model(&User{}).Where("plan_name = ?", plan.Name).Count(&userCount).Error; err != nil {
		return fmt.Errorf("检查套餐使用情况失败: %w", err)
	}

	if userCount > 0 {
		return fmt.Errorf("该套餐正在被 %d 个用户使用，无法删除", userCount)
	}

	if err := s.db.Delete(&plan).Error; err != nil {
		return fmt.Errorf("删除套餐失败: %w", err)
	}

	return nil
}

// GetPlanUsageStats 获取套餐使用统计
func (s *PlanService) GetPlanUsageStats() ([]PlanUsageStats, error) {
	var stats []PlanUsageStats

	query := `
		SELECT 
			pc.id,
			pc.name,
			pc.display_name,
			pc.is_active,
			COALESCE(u.user_count, 0) as user_count,
			COALESCE(u.active_user_count, 0) as active_user_count
		FROM plan_configs pc
		LEFT JOIN (
			SELECT 
				plan_name,
				COUNT(*) as user_count,
				COUNT(CASE WHEN status = 'active' THEN 1 END) as active_user_count
			FROM users
			GROUP BY plan_name
		) u ON pc.name = u.plan_name
		ORDER BY pc.name ASC
	`

	if err := s.db.Raw(query).Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("获取套餐使用统计失败: %w", err)
	}

	return stats, nil
}

// CreatePlanRequest 创建套餐请求
type CreatePlanRequest struct {
	Name               string  `json:"name" binding:"required"`
	DisplayName        string  `json:"display_name" binding:"required"`
	Description        string  `json:"description"`
	Price              float64 `json:"price"`
	Duration           int     `json:"duration" binding:"required,min=1"`
    BatchGoEnabled     bool    `json:"batchgo_enabled"`
    SiteRankEnabled    bool    `json:"siterank_enabled"`
    AdsCenterEnabled   bool    `json:"adscenter_enabled"`
	MaxBatchSize       int     `json:"max_batch_size" binding:"required,min=1"`
	MaxConcurrency     int     `json:"max_concurrency" binding:"required,min=1"`
    MaxSiteRankQueries   int     `json:"max_siterank_queries"`
    MaxAdsCenterAccounts int     `json:"max_adscenter_accounts"`
	InitialTokens      int     `json:"initial_tokens"`
	DailyTokens        int     `json:"daily_tokens"`
}

// UpdatePlanRequest 更新套餐请求
type UpdatePlanRequest struct {
	Name               string  `json:"name"`
	DisplayName        string  `json:"display_name"`
	Description        string  `json:"description"`
	Price              float64 `json:"price"`
	Duration           int     `json:"duration"`
    BatchGoEnabled     bool    `json:"batchgo_enabled"`
    SiteRankEnabled    bool    `json:"siterank_enabled"`
    AdsCenterEnabled   bool    `json:"adscenter_enabled"`
	MaxBatchSize       int     `json:"max_batch_size"`
	MaxConcurrency     int     `json:"max_concurrency"`
    MaxSiteRankQueries   int     `json:"max_siterank_queries"`
    MaxAdsCenterAccounts int     `json:"max_adscenter_accounts"`
	InitialTokens      int     `json:"initial_tokens"`
	DailyTokens        int     `json:"daily_tokens"`
}

// PlanUsageStats 套餐使用统计
type PlanUsageStats struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	DisplayName     string `json:"display_name"`
	IsActive        bool   `json:"is_active"`
	UserCount       int64  `json:"user_count"`
	ActiveUserCount int64  `json:"active_user_count"`
}
