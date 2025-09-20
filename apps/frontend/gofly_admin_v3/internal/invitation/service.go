package invitation

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InvitationService 邀请服务
type InvitationService struct {
	db           *gorm.DB
	tokenService TokenService
}

// TokenService Token服务接口
type TokenService interface {
	AddTokens(userID string, amount int, tokenType, description string) error
	GetBalance(userID string) (int, error)
}

// NewInvitationService 创建邀请服务
func NewInvitationService(db *gorm.DB, tokenService TokenService) *InvitationService {
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
		return "", fmt.Errorf("用户不存在: %w", err)
	}

	if user.InviteCode != "" {
		return user.InviteCode, nil
	}

	// 生成新的邀请码
	inviteCode := s.generateUniqueInviteCode()

	// 更新用户邀请码
	if err := s.db.Model(&user).Update("invite_code", inviteCode).Error; err != nil {
		return "", fmt.Errorf("更新邀请码失败: %w", err)
	}

	return inviteCode, nil
}

// generateUniqueInviteCode 生成唯一邀请码
func (s *InvitationService) generateUniqueInviteCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const codeLength = 8

	for {
		code := make([]byte, codeLength)
		for i := range code {
			code[i] = charset[rand.Intn(len(charset))]
		}

		inviteCode := string(code)

		// 检查是否已存在
		var count int64
		s.db.Model(&User{}).Where("invite_code = ?", inviteCode).Count(&count)
		if count == 0 {
			return inviteCode
		}
	}
}

// ProcessInvitation 处理邀请注册
func (s *InvitationService) ProcessInvitation(inviteCode, newUserID string) error {
	if inviteCode == "" {
		return nil // 没有邀请码，正常注册
	}

	// 查找邀请者
	var inviter User
	if err := s.db.Where("invite_code = ?", inviteCode).First(&inviter).Error; err != nil {
		return fmt.Errorf("邀请码无效: %w", err)
	}

	// 检查是否自己邀请自己
	if inviter.ID == newUserID {
		return fmt.Errorf("不能使用自己的邀请码")
	}

	// 检查新用户是否已被邀请过
	var newUser User
	if err := s.db.Where("id = ?", newUserID).First(&newUser).Error; err != nil {
		return fmt.Errorf("新用户不存在: %w", err)
	}

	if newUser.InvitedBy != nil {
		return fmt.Errorf("用户已被邀请过")
	}

	// 开始事务处理邀请
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 更新新用户的邀请信息
		now := time.Now()
		if err := tx.Model(&newUser).Updates(map[string]interface{}{
			"invited_by": inviter.ID,
			"invited_at": now,
		}).Error; err != nil {
			return fmt.Errorf("更新被邀请用户信息失败: %w", err)
		}

		// 2. 创建邀请记录
        invitation := &Invitation{
			ID:                 uuid.New().String(),
			InviterID:          inviter.ID,
			InviteeID:          newUserID,
			InviteCode:         inviteCode,
			Status:             InvitationStatusCompleted,
			InviterRewardGiven: false,
			InviteeRewardGiven: false,
            RewardDays:         30,
            TokenReward:        0, // 不再发放Token奖励
            CreatedAt:          now,
        }

		if err := tx.Create(invitation).Error; err != nil {
			return fmt.Errorf("创建邀请记录失败: %w", err)
		}

		// 3. 给被邀请用户30天Pro套餐
		if err := s.grantProSubscription(tx, newUserID, 30, "invitation"); err != nil {
			return fmt.Errorf("给被邀请用户Pro套餐失败: %w", err)
		}

		// 4. 给邀请者30天Pro套餐(可累加)
		if err := s.grantProSubscription(tx, inviter.ID, 30, "invitation_reward"); err != nil {
			return fmt.Errorf("给邀请者Pro套餐失败: %w", err)
		}

        // 5. 不再发放Token奖励（仅发放Pro套餐时长）

		// 6. 标记奖励已发放
		invitation.InviterRewardGiven = true
		invitation.InviteeRewardGiven = true
		if err := tx.Save(invitation).Error; err != nil {
			return fmt.Errorf("更新邀请奖励状态失败: %w", err)
		}

		return nil
	})
}

// grantProSubscription 给用户Pro套餐
func (s *InvitationService) grantProSubscription(tx *gorm.DB, userID string, days int, source string) error {
	var user User
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}

	// 计算新的过期时间
	var newExpires time.Time
	now := time.Now()

	if user.PlanExpiresAt != nil && user.PlanExpiresAt.After(now) {
		// 如果当前套餐未过期，在现有基础上累加
		newExpires = user.PlanExpiresAt.AddDate(0, 0, days)
	} else {
		// 如果当前套餐已过期或没有套餐，从现在开始计算
		newExpires = now.AddDate(0, 0, days)
	}

	// 更新用户套餐信息
	updates := map[string]interface{}{
		"plan_name":       "pro",
		"plan_expires_at": newExpires,
	}

	return tx.Model(&user).Updates(updates).Error
}

// GetInvitationStats 获取邀请统计
func (s *InvitationService) GetInvitationStats(userID string) (*InvitationStats, error) {
	var stats InvitationStats

	// 获取邀请总数
	if err := s.db.Model(&Invitation{}).Where("inviter_id = ?", userID).Count(&stats.TotalInvitations).Error; err != nil {
		return nil, fmt.Errorf("获取邀请总数失败: %w", err)
	}

	// 获取成功邀请数
	if err := s.db.Model(&Invitation{}).Where("inviter_id = ? AND status = ?", userID, InvitationStatusCompleted).Count(&stats.SuccessfulInvitations).Error; err != nil {
		return nil, fmt.Errorf("获取成功邀请数失败: %w", err)
	}

	// 计算获得的Pro套餐天数和Token奖励
	var invitations []Invitation
	if err := s.db.Where("inviter_id = ? AND status = ?", userID, InvitationStatusCompleted).Find(&invitations).Error; err != nil {
		return nil, fmt.Errorf("获取邀请记录失败: %w", err)
	}

	for _, invitation := range invitations {
		if invitation.InviterRewardGiven {
			stats.TotalProDays += invitation.RewardDays
			stats.TotalTokenReward += invitation.TokenReward
		}
	}

	// 计算成功率
	if stats.TotalInvitations > 0 {
		stats.SuccessRate = float64(stats.SuccessfulInvitations) / float64(stats.TotalInvitations) * 100
	}

	return &stats, nil
}

// GetInvitationHistory 获取邀请历史
func (s *InvitationService) GetInvitationHistory(userID string, page, size int) ([]InvitationRecord, int64, error) {
	var records []InvitationRecord
	var total int64

	query := s.db.Table("invitations").
		Select("invitations.*, users.username as invitee_username, users.email as invitee_email").
		Joins("LEFT JOIN users ON invitations.invitee_id = users.id").
		Where("invitations.inviter_id = ?", userID)

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取邀请历史总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("invitations.created_at DESC").Offset(offset).Limit(size).Scan(&records).Error; err != nil {
		return nil, 0, fmt.Errorf("获取邀请历史失败: %w", err)
	}

	return records, total, nil
}

// GetInviteLink 获取邀请链接
func (s *InvitationService) GetInviteLink(userID, baseURL string) (string, error) {
	inviteCode, err := s.GenerateInviteCode(userID)
	if err != nil {
		return "", err
	}

	// 构建邀请链接
	baseURL = strings.TrimSuffix(baseURL, "/")
	inviteLink := fmt.Sprintf("%s/register?invite=%s", baseURL, inviteCode)

	return inviteLink, nil
}

// ValidateInviteCode 验证邀请码
func (s *InvitationService) ValidateInviteCode(inviteCode string) (*User, error) {
	if inviteCode == "" {
		return nil, fmt.Errorf("邀请码不能为空")
	}

	var inviter User
	if err := s.db.Where("invite_code = ?", inviteCode).First(&inviter).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("邀请码无效")
		}
		return nil, fmt.Errorf("验证邀请码失败: %w", err)
	}

	return &inviter, nil
}

// GetInvitationLeaderboard 获取邀请排行榜
func (s *InvitationService) GetInvitationLeaderboard(limit int) ([]InvitationLeaderboardEntry, error) {
	var entries []InvitationLeaderboardEntry

	query := `
		SELECT 
			u.id,
			u.username,
			u.email,
			COUNT(i.id) as invitation_count,
			SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as successful_count,
			SUM(CASE WHEN i.inviter_reward_given THEN i.token_reward ELSE 0 END) as total_token_reward
		FROM users u
		LEFT JOIN invitations i ON u.id = i.inviter_id
		GROUP BY u.id, u.username, u.email
		HAVING invitation_count > 0
		ORDER BY successful_count DESC, invitation_count DESC
		LIMIT ?
	`

	if err := s.db.Raw(query, limit).Scan(&entries).Error; err != nil {
		return nil, fmt.Errorf("获取邀请排行榜失败: %w", err)
	}

	return entries, nil
}
