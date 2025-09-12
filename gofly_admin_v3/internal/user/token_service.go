package user

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// generateUUID 生成UUID
func generateUUID() string {
	return uuid.New().String()
}

// TokenService Token服务
type TokenService struct {
	db     *gorm.DB
	config *TokenConfigService
}

// NewTokenService 创建Token服务
func NewTokenService(db *gorm.DB) *TokenService {
	return &TokenService{
		db:     db,
		config: NewTokenConfigService(),
	}
}

// ConsumeTokens 消费Token
func (s *TokenService) ConsumeTokens(userID string, amount int, description, reference string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 获取用户当前余额
		var user User
		if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
			return fmt.Errorf("用户不存在: %w", err)
		}

		// 2. 检查余额
		if user.TokenBalance < amount {
			return errors.New("Token余额不足")
		}

		// 3. 扣减余额
		newBalance := user.TokenBalance - amount
		if err := tx.Model(&user).Update("token_balance", newBalance).Error; err != nil {
			return fmt.Errorf("更新余额失败: %w", err)
		}

		// 4. 记录交易
		transaction := TokenTransaction{
			ID:          generateUUID(),
			UserID:      userID,
			Amount:      -amount,
			Balance:     newBalance,
			Type:        "consume",
			Description: description,
			Reference:   reference,
			CreatedAt:   time.Now(),
		}

		if err := tx.Create(&transaction).Error; err != nil {
			return fmt.Errorf("记录交易失败: %w", err)
		}

		return nil
	})
}

// AddTokens 增加Token
func (s *TokenService) AddTokens(userID string, amount int, tokenType, description, reference string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 获取用户当前余额
		var user User
		if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
			return fmt.Errorf("用户不存在: %w", err)
		}

		// 2. 增加余额
		newBalance := user.TokenBalance + amount
		if err := tx.Model(&user).Update("token_balance", newBalance).Error; err != nil {
			return fmt.Errorf("更新余额失败: %w", err)
		}

		// 3. 记录交易
		transaction := TokenTransaction{
			ID:          generateUUID(),
			UserID:      userID,
			Amount:      amount,
			Balance:     newBalance,
			Type:        tokenType,
			Description: description,
			Reference:   reference,
			CreatedAt:   time.Now(),
		}

		if err := tx.Create(&transaction).Error; err != nil {
			return fmt.Errorf("记录交易失败: %w", err)
		}

		return nil
	})
}

// GetTokenTransactions 获取Token交易记录
func (s *TokenService) GetTokenTransactions(userID string, page, pageSize int) ([]*TokenTransaction, int64, error) {
	var transactions []*TokenTransaction
	var total int64

	// 计算偏移量
	offset := (page - 1) * pageSize

	// 获取总数
	if err := s.db.Model(&TokenTransaction{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := s.db.Where("user_id = ?", userID).
		Offset(offset).Limit(pageSize).
		Order("created_at DESC").
		Find(&transactions).Error; err != nil {
		return nil, 0, err
	}

	return transactions, total, nil
}

// GetTokenBalance 获取用户Token余额
func (s *TokenService) GetTokenBalance(userID string) (int, error) {
	var user User
	if err := s.db.Where("id = ?", userID).Select("token_balance").First(&user).Error; err != nil {
		return 0, err
	}
	return user.TokenBalance, nil
}

// ConsumeTokensByService 根据服务规则消费Token
func (s *TokenService) ConsumeTokensByService(userID, service, action string, quantity int, reference string) error {
	// 1. 获取消费规则
	rule, err := s.config.GetConsumptionRule(service, action)
	if err != nil {
		return fmt.Errorf("获取消费规则失败: %w", err)
	}

	// 2. 计算总消费
	totalCost := rule.TokenCost * quantity

	// 3. 获取用户余额并验证
	balance, err := s.GetTokenBalance(userID)
	if err != nil {
		return fmt.Errorf("获取用户余额失败: %w", err)
	}

	if err := s.config.ValidateTokenConsumption(service, action, quantity, balance); err != nil {
		return err
	}

	// 4. 生成描述
	description := s.config.GetTokenCostDescription(service, action, quantity)

	// 5. 执行消费
	return s.ConsumeTokens(userID, totalCost, description, reference)
}

// CheckTokenSufficiency 检查Token是否足够
func (s *TokenService) CheckTokenSufficiency(userID, service, action string, quantity int) (bool, int, int, error) {
	// 1. 获取用户余额
	balance, err := s.GetTokenBalance(userID)
	if err != nil {
		return false, 0, 0, err
	}

	// 2. 计算所需Token
	totalCost, err := s.config.CalculateTokenCost(service, action, quantity)
	if err != nil {
		return false, 0, 0, err
	}

	// 3. 检查是否足够
	sufficient := balance >= totalCost

	return sufficient, balance, totalCost, nil
}

// GetConsumptionRules 获取所有消费规则
func (s *TokenService) GetConsumptionRules() []TokenConsumptionRule {
	return s.config.GetAllConsumptionRules()
}

// GetRechargePackages 获取所有充值包
func (s *TokenService) GetRechargePackages() []RechargePackage {
	return s.config.GetAllRechargePackages()
}

// PurchaseTokens 购买Token
func (s *TokenService) PurchaseTokens(userID, packageID, orderID string) error {
	// 1. 获取充值包信息
	pkg, err := s.config.GetRechargePackage(packageID)
	if err != nil {
		return fmt.Errorf("获取充值包失败: %w", err)
	}

	// 2. 计算总Token数量（基础+赠送）
	totalTokens := pkg.TokenAmount + pkg.Bonus

	// 3. 生成描述
	description := fmt.Sprintf("购买%s充值包", pkg.Name)
	if pkg.Bonus > 0 {
		description += fmt.Sprintf("（赠送%d Token）", pkg.Bonus)
	}

	// 4. 添加Token
	return s.AddTokens(userID, totalTokens, "purchase", description, orderID)
}

// GetTokenStats 获取Token统计信息
func (s *TokenService) GetTokenStats(userID string) (map[string]interface{}, error) {
	// 1. 获取当前余额
	balance, err := s.GetTokenBalance(userID)
	if err != nil {
		return nil, err
	}

	// 2. 获取今日消费
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.AddDate(0, 0, 1)

	var todayConsumption int
	err = s.db.Model(&TokenTransaction{}).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?",
			userID, "consume", today, tomorrow).
		Select("COALESCE(SUM(ABS(amount)), 0)").
		Scan(&todayConsumption).Error
	if err != nil {
		return nil, err
	}

	// 3. 获取本月消费
	startOfMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	var monthlyConsumption int
	err = s.db.Model(&TokenTransaction{}).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?",
			userID, "consume", startOfMonth, endOfMonth).
		Select("COALESCE(SUM(ABS(amount)), 0)").
		Scan(&monthlyConsumption).Error
	if err != nil {
		return nil, err
	}

	// 4. 获取总消费
	var totalConsumption int
	err = s.db.Model(&TokenTransaction{}).
		Where("user_id = ? AND type = ?", userID, "consume").
		Select("COALESCE(SUM(ABS(amount)), 0)").
		Scan(&totalConsumption).Error
	if err != nil {
		return nil, err
	}

	// 5. 获取总充值
	var totalPurchase int
	err = s.db.Model(&TokenTransaction{}).
		Where("user_id = ? AND type = ?", userID, "purchase").
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalPurchase).Error
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"current_balance":     balance,
		"today_consumption":   todayConsumption,
		"monthly_consumption": monthlyConsumption,
		"total_consumption":   totalConsumption,
		"total_purchase":      totalPurchase,
		"consumption_rules":   s.GetConsumptionRules(),
		"recharge_packages":   s.GetRechargePackages(),
	}, nil
}

// CheckinService 签到服务
type CheckinService struct {
	db           *gorm.DB
	tokenService *TokenService
}

// NewCheckinService 创建签到服务
func NewCheckinService(db *gorm.DB, tokenService *TokenService) *CheckinService {
	return &CheckinService{
		db:           db,
		tokenService: tokenService,
	}
}

// PerformCheckin 执行签到
func (s *CheckinService) PerformCheckin(userID string) (*CheckinRecord, error) {
	today := time.Now().Truncate(24 * time.Hour)

	return s.performCheckinTx(userID, today)
}

func (s *CheckinService) performCheckinTx(userID string, date time.Time) (*CheckinRecord, error) {
	var record *CheckinRecord

	err := s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 检查今天是否已签到
		var existingRecord CheckinRecord
		err := tx.Where("user_id = ? AND checkin_date = ?", userID, date).First(&existingRecord).Error
		if err == nil {
			return errors.New("今天已经签到过了")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("检查签到记录失败: %w", err)
		}

		// 2. 创建签到记录
		record = &CheckinRecord{
			UserID:      userID,
			CheckinDate: date,
			TokenReward: 10, // 固定10个Token
			CreatedAt:   time.Now(),
		}

		if err := tx.Create(record).Error; err != nil {
			return fmt.Errorf("创建签到记录失败: %w", err)
		}

		// 3. 增加Token
		if err := s.tokenService.AddTokens(userID, 10, "checkin", "每日签到奖励", ""); err != nil {
			return fmt.Errorf("增加Token失败: %w", err)
		}

		return nil
	})

	return record, err
}

// GetCheckinInfo 获取签到信息
func (s *CheckinService) GetCheckinInfo(userID string) (map[string]interface{}, error) {
	today := time.Now().Truncate(24 * time.Hour)

	// 检查今天是否已签到
	var todayRecord CheckinRecord
	hasCheckedToday := true
	err := s.db.Where("user_id = ? AND checkin_date = ?", userID, today).First(&todayRecord).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		hasCheckedToday = false
	} else if err != nil {
		return nil, err
	}

	// 获取本月签到记录
	startOfMonth := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, today.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, -1)

	var monthlyRecords []CheckinRecord
	if err := s.db.Where("user_id = ? AND checkin_date BETWEEN ? AND ?",
		userID, startOfMonth, endOfMonth).
		Order("checkin_date ASC").
		Find(&monthlyRecords).Error; err != nil {
		return nil, err
	}

	// 计算连续签到天数
	consecutiveDays := s.calculateConsecutiveDays(userID, today)

	return map[string]interface{}{
		"has_checked_today": hasCheckedToday,
		"consecutive_days":  consecutiveDays,
		"monthly_records":   monthlyRecords,
		"total_this_month":  len(monthlyRecords),
		"reward_per_day":    10,
	}, nil
}

// calculateConsecutiveDays 计算连续签到天数
func (s *CheckinService) calculateConsecutiveDays(userID string, today time.Time) int {
	consecutiveDays := 0
	currentDate := today

	for {
		var record CheckinRecord
		err := s.db.Where("user_id = ? AND checkin_date = ?", userID, currentDate).First(&record).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			break
		}
		if err != nil {
			break
		}

		consecutiveDays++
		currentDate = currentDate.AddDate(0, 0, -1)
	}

	return consecutiveDays
}

// GetCheckinHistory 获取签到历史
func (s *CheckinService) GetCheckinHistory(userID string, page, pageSize int) ([]*CheckinRecord, int64, error) {
	var records []*CheckinRecord
	var total int64

	// 计算偏移量
	offset := (page - 1) * pageSize

	// 获取总数
	if err := s.db.Model(&CheckinRecord{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	if err := s.db.Where("user_id = ?", userID).
		Offset(offset).Limit(pageSize).
		Order("checkin_date DESC").
		Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}

// InvitationService 邀请服务
type InvitationService struct {
	db           *gorm.DB
	tokenService *TokenService
}

// NewInvitationService 创建邀请服务
func NewInvitationService(db *gorm.DB, tokenService *TokenService) *InvitationService {
	return &InvitationService{
		db:           db,
		tokenService: tokenService,
	}
}

// GenerateInviteCode 生成邀请码
func (s *InvitationService) GenerateInviteCode(userID string) (string, error) {
	// 检查用户是否已有邀请码
	var user User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return "", err
	}

	if user.InviteCode != "" {
		return user.InviteCode, nil
	}

	// 生成新的邀请码
	inviteCode := s.generateUniqueInviteCode()

	// 更新用户邀请码
	if err := s.db.Model(&user).Update("invite_code", inviteCode).Error; err != nil {
		return "", err
	}

	return inviteCode, nil
}

// generateUniqueInviteCode 生成唯一邀请码
func (s *InvitationService) generateUniqueInviteCode() string {
	// 简单的邀请码生成逻辑，实际项目中可以使用更复杂的算法
	return fmt.Sprintf("INV%d", time.Now().Unix()%1000000)
}

// ProcessInvitation 处理邀请注册
func (s *InvitationService) ProcessInvitation(inviteCode, inviteeID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 查找邀请人
		var inviter User
		if err := tx.Where("invite_code = ?", inviteCode).First(&inviter).Error; err != nil {
			return errors.New("邀请码无效")
		}

		// 2. 检查是否已处理过
		var existingInvitation Invitation
		err := tx.Where("invitee_id = ?", inviteeID).First(&existingInvitation).Error
		if err == nil {
			return errors.New("该用户已通过邀请注册")
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		// 3. 创建邀请记录
		invitation := Invitation{
			ID:         generateUUID(),
			InviterID:  inviter.ID,
			InviteeID:  inviteeID,
			InviteCode: inviteCode,
			Status:     "completed",
			CreatedAt:  time.Now(),
		}

		if err := tx.Create(&invitation).Error; err != nil {
			return err
		}

		// 4. 给被邀请者30天Pro套餐
		inviteeExpires := time.Now().AddDate(0, 0, 30)
		if err := tx.Model(&User{}).Where("id = ?", inviteeID).Updates(map[string]interface{}{
			"plan_name":       "pro",
			"plan_expires_at": inviteeExpires,
			"invited_by":      inviter.ID,
			"invited_at":      time.Now(),
		}).Error; err != nil {
			return err
		}

		// 5. 给邀请者30天Pro套餐（可累加）
		var inviterUser User
		if err := tx.Where("id = ?", inviter.ID).First(&inviterUser).Error; err != nil {
			return err
		}

		var newExpires time.Time
		if inviterUser.PlanExpiresAt != nil && inviterUser.PlanExpiresAt.After(time.Now()) {
			// 如果当前套餐未过期，在现有基础上增加30天
			newExpires = inviterUser.PlanExpiresAt.AddDate(0, 0, 30)
		} else {
			// 如果当前套餐已过期或没有套餐，从现在开始30天
			newExpires = time.Now().AddDate(0, 0, 30)
		}

		if err := tx.Model(&inviterUser).Updates(map[string]interface{}{
			"plan_name":       "pro",
			"plan_expires_at": newExpires,
		}).Error; err != nil {
			return err
		}

		// 6. 给双方Token奖励
		if err := s.tokenService.AddTokens(inviteeID, 1000, "invite", "邀请注册奖励", invitation.ID); err != nil {
			return err
		}

		if err := s.tokenService.AddTokens(inviter.ID, 1000, "invite", "成功邀请奖励", invitation.ID); err != nil {
			return err
		}

		// 7. 更新邀请记录状态
		if err := tx.Model(&invitation).Updates(map[string]interface{}{
			"inviter_reward_given": true,
			"invitee_reward_given": true,
		}).Error; err != nil {
			return err
		}

		return nil
	})
}

// GetInvitationStats 获取邀请统计
func (s *InvitationService) GetInvitationStats(userID string) (map[string]interface{}, error) {
	var totalInvitations int64
	var completedInvitations int64

	// 总邀请数
	if err := s.db.Model(&Invitation{}).Where("inviter_id = ?", userID).Count(&totalInvitations).Error; err != nil {
		return nil, err
	}

	// 成功邀请数
	if err := s.db.Model(&Invitation{}).Where("inviter_id = ? AND status = ?", userID, "completed").Count(&completedInvitations).Error; err != nil {
		return nil, err
	}

	// 获得的Pro套餐天数（简化计算）
	proDays := completedInvitations * 30

	// 获得的Token奖励
	tokenReward := completedInvitations * 1000

	return map[string]interface{}{
		"total_invitations":     totalInvitations,
		"completed_invitations": completedInvitations,
		"pro_days_earned":       proDays,
		"token_reward_earned":   tokenReward,
	}, nil
}
