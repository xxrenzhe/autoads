package dashboard

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// DashboardService 个人中心服务
type DashboardService struct {
	db           *gorm.DB
	tokenService TokenService
}

// TokenService Token服务接口
type TokenService interface {
	GetBalance(userID string) (int, error)
	GetTransactionHistory(userID string, page, size int, transactionType string) ([]TokenTransaction, int64, error)
	GetTransactionStats(userID string) (*TokenStats, error)
}

// NewDashboardService 创建个人中心服务
func NewDashboardService(db *gorm.DB, tokenService TokenService) *DashboardService {
	return &DashboardService{
		db:           db,
		tokenService: tokenService,
	}
}

// GetUserOverview 获取用户概览信息
func (s *DashboardService) GetUserOverview(userID string) (*UserOverview, error) {
	var user User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("获取用户信息失败: %w", err)
	}

	// 获取Token余额
	tokenBalance, err := s.tokenService.GetBalance(userID)
	if err != nil {
		return nil, fmt.Errorf("获取Token余额失败: %w", err)
	}

	// 获取套餐信息
	planInfo := s.getPlanInfo(&user)

	// 获取今日统计
	todayStats, err := s.getTodayStats(userID)
	if err != nil {
		return nil, fmt.Errorf("获取今日统计失败: %w", err)
	}

	// 获取本月统计
	monthlyStats, err := s.getMonthlyStats(userID)
	if err != nil {
		return nil, fmt.Errorf("获取本月统计失败: %w", err)
	}

	overview := &UserOverview{
		UserInfo: UserInfo{
			ID:          user.ID,
			Username:    user.Username,
			Email:       user.Email,
			Name:        user.Name,
			Company:     user.Company,
			AvatarURL:   user.AvatarURL,
			Timezone:    user.Timezone,
			Language:    user.Language,
			CreatedAt:   user.CreatedAt,
			LastLoginAt: user.LastLoginAt,
		},
		PlanInfo:     *planInfo,
		TokenBalance: tokenBalance,
		TodayStats:   *todayStats,
		MonthlyStats: *monthlyStats,
	}

	return overview, nil
}

// getPlanInfo 获取套餐信息
func (s *DashboardService) getPlanInfo(user *User) *PlanInfo {
	planInfo := &PlanInfo{
		PlanName:  user.PlanName,
		IsActive:  false,
		DaysLeft:  0,
		ExpiresAt: user.PlanExpiresAt,
		Features:  s.getPlanFeatures(user.PlanName),
	}

	if user.PlanExpiresAt != nil {
		now := time.Now()
		if user.PlanExpiresAt.After(now) {
			planInfo.IsActive = true
			planInfo.DaysLeft = int(user.PlanExpiresAt.Sub(now).Hours() / 24)
		}
	}

	return planInfo
}

// getPlanFeatures 获取套餐功能
func (s *DashboardService) getPlanFeatures(planName string) []PlanFeature {
	switch planName {
	case "pro":
		return []PlanFeature{
			{Name: "BatchGo批量访问", Enabled: true, Limit: "无限制"},
			{Name: "SiteRank查询", Enabled: true, Limit: "无限制"},
			{Name: "Chengelink自动化", Enabled: true, Limit: "无限制"},
			{Name: "优先客服支持", Enabled: true, Limit: "7x24小时"},
			{Name: "高级统计报告", Enabled: true, Limit: "详细报告"},
		}
	case "max":
		return []PlanFeature{
			{Name: "BatchGo批量访问", Enabled: true, Limit: "无限制"},
			{Name: "SiteRank查询", Enabled: true, Limit: "无限制"},
			{Name: "Chengelink自动化", Enabled: true, Limit: "无限制"},
			{Name: "优先客服支持", Enabled: true, Limit: "7x24小时"},
			{Name: "高级统计报告", Enabled: true, Limit: "详细报告"},
			{Name: "API访问", Enabled: true, Limit: "无限制"},
			{Name: "白标定制", Enabled: true, Limit: "支持"},
		}
	default: // free
		return []PlanFeature{
			{Name: "BatchGo批量访问", Enabled: true, Limit: "每日50次"},
			{Name: "SiteRank查询", Enabled: true, Limit: "每日20次"},
			{Name: "Chengelink自动化", Enabled: false, Limit: "Pro功能"},
			{Name: "客服支持", Enabled: true, Limit: "工作时间"},
			{Name: "基础统计", Enabled: true, Limit: "基础报告"},
		}
	}
}

// getTodayStats 获取今日统计
func (s *DashboardService) getTodayStats(userID string) (*DailyStats, error) {
	today := time.Now().Format("2006-01-02")

	stats := &DailyStats{
		Date: today,
	}

	// 获取今日Token消费
	var tokenConsumed int
	err := s.db.Table("token_transactions").
		Select("SUM(ABS(amount))").
		Where("user_id = ? AND type = 'consume' AND DATE(created_at) = ?", userID, today).
		Scan(&tokenConsumed).Error
	if err != nil {
		return nil, err
	}
	stats.TokensConsumed = tokenConsumed

	// 获取今日任务数量
	var batchTasks, siteRankTasks, chengeLinkTasks int64

	s.db.Model(&BatchTask{}).Where("user_id = ? AND DATE(created_at) = ?", userID, today).Count(&batchTasks)
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND DATE(created_at) = ?", userID, today).Count(&siteRankTasks)
	s.db.Model(&ChengeLinkTask{}).Where("user_id = ? AND DATE(created_at) = ?", userID, today).Count(&chengeLinkTasks)

	stats.BatchTasks = int(batchTasks)
	stats.SiteRankQueries = int(siteRankTasks)
	stats.ChengeLinkTasks = int(chengeLinkTasks)

	// 检查今日签到
	var checkinCount int64
	s.db.Model(&CheckinRecord{}).Where("user_id = ? AND checkin_date = ?", userID, today).Count(&checkinCount)
	stats.CheckedIn = checkinCount > 0

	return stats, nil
}

// getMonthlyStats 获取本月统计
func (s *DashboardService) getMonthlyStats(userID string) (*MonthlyStats, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	stats := &MonthlyStats{
		Year:  now.Year(),
		Month: int(now.Month()),
	}

	// 获取本月Token消费
	var tokenConsumed int
	err := s.db.Table("token_transactions").
		Select("SUM(ABS(amount))").
		Where("user_id = ? AND type = 'consume' AND created_at >= ?", userID, startOfMonth).
		Scan(&tokenConsumed).Error
	if err != nil {
		return nil, err
	}
	stats.TokensConsumed = tokenConsumed

	// 获取本月任务数量
	var batchTasks, siteRankTasks, chengeLinkTasks int64

	s.db.Model(&BatchTask{}).Where("user_id = ? AND created_at >= ?", userID, startOfMonth).Count(&batchTasks)
	s.db.Model(&SiteRankQuery{}).Where("user_id = ? AND created_at >= ?", userID, startOfMonth).Count(&siteRankTasks)
	s.db.Model(&ChengeLinkTask{}).Where("user_id = ? AND created_at >= ?", userID, startOfMonth).Count(&chengeLinkTasks)

	stats.BatchTasks = int(batchTasks)
	stats.SiteRankQueries = int(siteRankTasks)
	stats.ChengeLinkTasks = int(chengeLinkTasks)

	// 获取本月签到天数
	var checkinDays int64
	s.db.Model(&CheckinRecord{}).Where("user_id = ? AND created_at >= ?", userID, startOfMonth).Count(&checkinDays)
	stats.CheckinDays = int(checkinDays)

	return stats, nil
}

// UpdateUserProfile 更新用户资料
func (s *DashboardService) UpdateUserProfile(userID string, req *UpdateProfileRequest) error {
	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Company != nil {
		updates["company"] = *req.Company
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = *req.AvatarURL
	}
	if req.Timezone != nil {
		updates["timezone"] = *req.Timezone
	}
	if req.Language != nil {
		updates["language"] = *req.Language
	}

	if len(updates) == 0 {
		return fmt.Errorf("没有需要更新的字段")
	}

	updates["updated_at"] = time.Now()

	return s.db.Model(&User{}).Where("id = ?", userID).Updates(updates).Error
}

// GetSubscriptionHistory 获取订阅历史
func (s *DashboardService) GetSubscriptionHistory(userID string, page, size int) ([]SubscriptionRecord, int64, error) {
	var records []SubscriptionRecord
	var total int64

	query := s.db.Model(&SubscriptionRecord{}).Where("user_id = ?", userID)

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取订阅历史总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("created_at DESC").Offset(offset).Limit(size).Find(&records).Error; err != nil {
		return nil, 0, fmt.Errorf("获取订阅历史失败: %w", err)
	}

	return records, total, nil
}

// GetUsageStats 获取使用统计
func (s *DashboardService) GetUsageStats(userID string, days int) (*UsageStats, error) {
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	stats := &UsageStats{
		Period:    fmt.Sprintf("%d天", days),
		StartDate: startDate.Format("2006-01-02"),
		EndDate:   endDate.Format("2006-01-02"),
	}

	// 获取Token消费趋势
	tokenTrend, err := s.getTokenTrend(userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("获取Token趋势失败: %w", err)
	}
	stats.TokenTrend = tokenTrend

	// 获取任务使用趋势
	taskTrend, err := s.getTaskTrend(userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("获取任务趋势失败: %w", err)
	}
	stats.TaskTrend = taskTrend

	return stats, nil
}

// getTokenTrend 获取Token消费趋势
func (s *DashboardService) getTokenTrend(userID string, startDate, endDate time.Time) ([]DailyTokenUsage, error) {
	var results []DailyTokenUsage

	query := `
		SELECT 
			DATE(created_at) as date,
			SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as tokens_earned,
			SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as tokens_consumed
		FROM token_transactions 
		WHERE user_id = ? AND created_at >= ? AND created_at <= ?
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`

	if err := s.db.Raw(query, userID, startDate, endDate).Scan(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

// getTaskTrend 获取任务使用趋势
func (s *DashboardService) getTaskTrend(userID string, startDate, endDate time.Time) ([]DailyTaskUsage, error) {
	var results []DailyTaskUsage

	// 由于涉及多个表，这里简化实现
	// 实际项目中可以使用更复杂的查询或分别查询后合并

	query := `
		SELECT 
			DATE(created_at) as date,
			COUNT(*) as batch_tasks,
			0 as siterank_queries,
			0 as chengelink_tasks
		FROM batch_tasks 
		WHERE user_id = ? AND created_at >= ? AND created_at <= ?
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`

	if err := s.db.Raw(query, userID, startDate, endDate).Scan(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

// GetRecentActivities 获取最近活动
func (s *DashboardService) GetRecentActivities(userID string, limit int) ([]ActivityRecord, error) {
	var activities []ActivityRecord

	// 获取最近的Token交易记录
	var tokenTxs []TokenTransaction
	if err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&tokenTxs).Error; err != nil {
		return nil, fmt.Errorf("获取Token交易记录失败: %w", err)
	}

	// 转换为活动记录
	for _, tx := range tokenTxs {
		activity := ActivityRecord{
			Type:        "token",
			Title:       s.getTokenActivityTitle(tx.Type, tx.Amount),
			Description: tx.Description,
			CreatedAt:   tx.CreatedAt,
		}
		activities = append(activities, activity)
	}

	// 按时间排序
	// 这里简化处理，实际项目中可能需要更复杂的排序逻辑

	if len(activities) > limit {
		activities = activities[:limit]
	}

	return activities, nil
}

// getTokenActivityTitle 获取Token活动标题
func (s *DashboardService) getTokenActivityTitle(txType string, amount int) string {
	switch txType {
	case "checkin":
		return fmt.Sprintf("每日签到获得 %d Token", amount)
	case "invite":
		return fmt.Sprintf("邀请奖励获得 %d Token", amount)
	case "purchase":
		return fmt.Sprintf("购买充值获得 %d Token", amount)
	case "consume":
		return fmt.Sprintf("消费使用 %d Token", -amount)
	default:
		if amount > 0 {
			return fmt.Sprintf("获得 %d Token", amount)
		} else {
			return fmt.Sprintf("消费 %d Token", -amount)
		}
	}
}
