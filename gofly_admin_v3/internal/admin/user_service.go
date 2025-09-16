package admin

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// UserService 用户管理服务
type UserService struct {
	db *gorm.DB
}

// NewUserService 创建用户管理服务
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// GetUsers 获取用户列表
func (s *UserService) GetUsers(page, size int, search string) ([]UserManagement, int64, error) {
	var users []UserManagement
	var total int64

	query := s.db.Model(&User{})

	// 搜索条件
	if search != "" {
		query = query.Where("username LIKE ? OR email LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取用户总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("created_at DESC").Offset(offset).Limit(size).Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("获取用户列表失败: %w", err)
	}

	return users, total, nil
}

// GetUserDetail 获取用户详情
func (s *UserService) GetUserDetail(userID string) (*UserDetailInfo, error) {
	var user User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("用户不存在: %w", err)
	}

	detail := &UserDetailInfo{
		UserManagement: UserManagement{
			ID:           user.ID,
			Username:     user.Username,
			Email:        user.Email,
			PlanName:     user.PlanName,
			TokenBalance: user.TokenBalance,
			Status:       user.Status,
			LastLoginAt:  user.LastLoginAt,
			CreatedAt:    user.CreatedAt,
			UpdatedAt:    user.UpdatedAt,
		},
	}

	// 获取Token统计
	var tokenStats struct {
		TotalEarned   int64
		TotalConsumed int64
	}

	if err := s.db.Model(&TokenTransaction{}).
		Select("SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_consumed").
		Where("user_id = ?", userID).
		Scan(&tokenStats).Error; err != nil {
		return nil, fmt.Errorf("获取Token统计失败: %w", err)
	}

	detail.TokensEarned = tokenStats.TotalEarned
	detail.TokensConsumed = tokenStats.TotalConsumed

	// 获取任务统计
    var taskStats struct {
        BatchTasks      int64
        SiteRankQueries int64
        AdsCenterTasks int64
    }

    s.db.Model(&BatchTask{}).Where("user_id = ?", userID).Count(&taskStats.BatchTasks)
    s.db.Model(&SiteRankQuery{}).Where("user_id = ?", userID).Count(&taskStats.SiteRankQueries)
    s.db.Model(&AdsCenterTask{}).Where("user_id = ?", userID).Count(&taskStats.AdsCenterTasks)

    detail.BatchTasks = taskStats.BatchTasks
    detail.SiteRankQueries = taskStats.SiteRankQueries
    detail.AdsCenterTasks = taskStats.AdsCenterTasks

	// 获取邀请统计
	var invitationStats struct {
		TotalInvitations      int64
		SuccessfulInvitations int64
	}

	s.db.Model(&Invitation{}).Where("inviter_id = ?", userID).Count(&invitationStats.TotalInvitations)
	s.db.Model(&Invitation{}).Where("inviter_id = ? AND status = 'completed'", userID).Count(&invitationStats.SuccessfulInvitations)

	detail.TotalInvitations = invitationStats.TotalInvitations
	detail.SuccessfulInvitations = invitationStats.SuccessfulInvitations

	// 获取签到统计
	s.db.Model(&CheckinRecord{}).Where("user_id = ?", userID).Count(&detail.TotalCheckins)

	return detail, nil
}

// UpdateUserStatus 更新用户状态
func (s *UserService) UpdateUserStatus(adminID uint, userID, status string) error {
	// 验证状态值
	if status != "active" && status != "disabled" && status != "suspended" {
		return fmt.Errorf("无效的状态值: %s", status)
	}

	// 更新用户状态
	if err := s.db.Model(&User{}).Where("id = ?", userID).Update("status", status).Error; err != nil {
		return fmt.Errorf("更新用户状态失败: %w", err)
	}

	// 记录操作日志
	log := &UserOperationLog{
		AdminID:      adminID,
		TargetUserID: userID,
		Operation:    "update_status",
		Details:      fmt.Sprintf("状态更新为: %s", status),
		CreatedAt:    time.Now(),
	}

	if err := s.db.Create(log).Error; err != nil {
		// 日志记录失败不影响主操作
		fmt.Printf("记录操作日志失败: %v\n", err)
	}

	return nil
}

// RechargeTokens 手动充值Token
func (s *UserService) RechargeTokens(adminID uint, userID string, amount int, reason string) error {
	if amount <= 0 {
		return fmt.Errorf("充值金额必须大于0")
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 更新用户Token余额
	if err := tx.Model(&User{}).Where("id = ?", userID).
		Update("token_balance", gorm.Expr("token_balance + ?", amount)).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新Token余额失败: %w", err)
	}

	// 创建Token交易记录
	transaction := &TokenTransaction{
		UserID:      userID,
		Amount:      amount,
		Description: fmt.Sprintf("管理员充值: %s", reason),
		CreatedAt:   time.Now(),
	}

	if err := tx.Create(transaction).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("创建交易记录失败: %w", err)
	}

	// 记录操作日志
	log := &UserOperationLog{
		AdminID:      adminID,
		TargetUserID: userID,
		Operation:    "recharge_tokens",
		Details:      fmt.Sprintf("充值 %d Token, 原因: %s", amount, reason),
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		// 日志记录失败不影响主操作
		fmt.Printf("记录操作日志失败: %v\n", err)
	}

	return tx.Commit().Error
}

// ChangePlan 更改用户套餐
func (s *UserService) ChangePlan(adminID uint, userID, planName string, duration int) error {
	// 验证套餐是否存在
	var planConfig PlanConfig
	if err := s.db.Where("name = ? AND is_active = ?", planName, true).First(&planConfig).Error; err != nil {
		return fmt.Errorf("套餐不存在或已禁用: %w", err)
	}

	// 开始事务
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 计算到期时间
	expiresAt := time.Now().AddDate(0, 0, duration)

	// 更新用户套餐
	updates := map[string]interface{}{
		"plan_name":       planName,
		"plan_expires_at": expiresAt,
		"updated_at":      time.Now(),
	}

	if err := tx.Model(&User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("更新用户套餐失败: %w", err)
	}

	// 如果套餐包含初始Token，则充值
	if planConfig.InitialTokens > 0 {
		if err := tx.Model(&User{}).Where("id = ?", userID).
			Update("token_balance", gorm.Expr("token_balance + ?", planConfig.InitialTokens)).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("充值套餐Token失败: %w", err)
		}

		// 创建Token交易记录
		transaction := &TokenTransaction{
			UserID:      userID,
			Amount:      planConfig.InitialTokens,
			Description: fmt.Sprintf("套餐赠送Token: %s", planConfig.DisplayName),
			CreatedAt:   time.Now(),
		}

		if err := tx.Create(transaction).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("创建Token交易记录失败: %w", err)
		}
	}

	// 记录操作日志
	log := &UserOperationLog{
		AdminID:      adminID,
		TargetUserID: userID,
		Operation:    "change_plan",
		Details:      fmt.Sprintf("套餐更改为: %s, 有效期: %d天", planConfig.DisplayName, duration),
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		// 日志记录失败不影响主操作
		fmt.Printf("记录操作日志失败: %v\n", err)
	}

	return tx.Commit().Error
}

// GetUserTokenHistory 获取用户Token历史
func (s *UserService) GetUserTokenHistory(userID string, page, size int) ([]TokenTransaction, int64, error) {
	var transactions []TokenTransaction
	var total int64

	query := s.db.Model(&TokenTransaction{}).Where("user_id = ?", userID)

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取Token历史总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("created_at DESC").Offset(offset).Limit(size).Find(&transactions).Error; err != nil {
		return nil, 0, fmt.Errorf("获取Token历史失败: %w", err)
	}

	return transactions, total, nil
}

// GetUserOperationLogs 获取用户操作日志
func (s *UserService) GetUserOperationLogs(userID string, page, size int) ([]UserOperationLogDetail, int64, error) {
	var logs []UserOperationLogDetail
	var total int64

	query := s.db.Table("user_operation_logs uol").
		Select("uol.*, au.username as admin_username").
		Joins("LEFT JOIN admin_users au ON uol.admin_id = au.id").
		Where("uol.target_user_id = ?", userID)

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取操作日志总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("uol.created_at DESC").Offset(offset).Limit(size).Scan(&logs).Error; err != nil {
		return nil, 0, fmt.Errorf("获取操作日志失败: %w", err)
	}

	return logs, total, nil
}

// UserDetailInfo 用户详细信息
type UserDetailInfo struct {
	UserManagement
	TokensEarned          int64 `json:"tokens_earned"`
	TokensConsumed        int64 `json:"tokens_consumed"`
	BatchTasks            int64 `json:"batch_tasks"`
	SiteRankQueries       int64 `json:"siterank_queries"`
    AdsCenterTasks       int64 `json:"adscenter_tasks"`
	TotalInvitations      int64 `json:"total_invitations"`
	SuccessfulInvitations int64 `json:"successful_invitations"`
	TotalCheckins         int64 `json:"total_checkins"`
}

// UserOperationLogDetail 用户操作日志详情
type UserOperationLogDetail struct {
	UserOperationLog
	AdminUsername string `json:"admin_username"`
}
