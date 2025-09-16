package admin

import (
	"time"

	"gorm.io/gorm"
)

// DashboardService 管理后台数据面板服务
type DashboardService struct {
	db *gorm.DB
}

// NewDashboardService 创建数据面板服务
func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{db: db}
}

// GetOverviewStats 获取概览统计
func (s *DashboardService) GetOverviewStats() (*OverviewStats, error) {
	stats := &OverviewStats{}

	// 用户统计
	if err := s.db.Model(&User{}).Count(&stats.TotalUsers).Error; err != nil {
		return nil, err
	}

	// 今日新增用户
	today := time.Now().Format("2006-01-02")
	if err := s.db.Model(&User{}).Where("DATE(created_at) = ?", today).Count(&stats.TodayNewUsers).Error; err != nil {
		return nil, err
	}

	// 活跃用户（7天内登录）
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	if err := s.db.Model(&User{}).Where("last_login_at > ?", sevenDaysAgo).Count(&stats.ActiveUsers).Error; err != nil {
		return nil, err
	}

	// Token统计
	var tokenStats struct {
		TotalConsumed int64
		TotalEarned   int64
	}

	if err := s.db.Model(&TokenTransaction{}).
		Select("SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_consumed, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned").
		Scan(&tokenStats).Error; err != nil {
		return nil, err
	}

	stats.TotalTokensConsumed = tokenStats.TotalConsumed
	stats.TotalTokensEarned = tokenStats.TotalEarned

	// 今日Token消费
	if err := s.db.Model(&TokenTransaction{}).
		Select("SUM(ABS(amount))").
		Where("amount < 0 AND DATE(created_at) = ?", today).
		Scan(&stats.TodayTokensConsumed).Error; err != nil {
		return nil, err
	}

	// 任务统计
	if err := s.db.Model(&BatchTask{}).Count(&stats.TotalBatchTasks).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&SiteRankQuery{}).Count(&stats.TotalSiteRankQueries).Error; err != nil {
		return nil, err
	}

    if err := s.db.Model(&AdsCenterTask{}).Count(&stats.TotalChengeLinkTasks).Error; err != nil {
        return nil, err
    }

	// 今日任务
	if err := s.db.Model(&BatchTask{}).Where("DATE(created_at) = ?", today).Count(&stats.TodayBatchTasks).Error; err != nil {
		return nil, err
	}

	// 邀请统计
	if err := s.db.Model(&Invitation{}).Count(&stats.TotalInvitations).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&Invitation{}).Where("status = 'completed'").Count(&stats.SuccessfulInvitations).Error; err != nil {
		return nil, err
	}

	// 签到统计
	if err := s.db.Model(&CheckinRecord{}).Count(&stats.TotalCheckins).Error; err != nil {
		return nil, err
	}

	if err := s.db.Model(&CheckinRecord{}).Where("checkin_date = ?", today).Count(&stats.TodayCheckins).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// GetUserTrend 获取用户增长趋势
func (s *DashboardService) GetUserTrend(days int) ([]DailyUserStats, error) {
	var stats []DailyUserStats

	query := `
		SELECT 
			DATE(created_at) as date,
			COUNT(*) as new_users,
			COUNT(CASE WHEN last_login_at IS NOT NULL THEN 1 END) as active_users
		FROM users 
		WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`

	if err := s.db.Raw(query, days).Scan(&stats).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// GetTokenTrend 获取Token使用趋势
func (s *DashboardService) GetTokenTrend(days int) ([]DailyTokenStats, error) {
	var stats []DailyTokenStats

	query := `
		SELECT 
			DATE(created_at) as date,
			SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as tokens_earned,
			SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as tokens_consumed
		FROM token_transactions 
		WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
		GROUP BY DATE(created_at)
		ORDER BY date ASC
	`

	if err := s.db.Raw(query, days).Scan(&stats).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// GetTaskTrend 获取任务使用趋势
func (s *DashboardService) GetTaskTrend(days int) ([]DailyTaskStats, error) {
	var stats []DailyTaskStats

	// 获取BatchGo任务趋势
	batchQuery := `
		SELECT 
			DATE(created_at) as date,
			COUNT(*) as batch_tasks,
			0 as siterank_queries,
			0 as chengelink_tasks
		FROM batch_tasks 
		WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
		GROUP BY DATE(created_at)
	`

	var batchStats []DailyTaskStats
	if err := s.db.Raw(batchQuery, days).Scan(&batchStats).Error; err != nil {
		return nil, err
	}

	// 获取SiteRank查询趋势
	siteRankQuery := `
		SELECT 
			DATE(created_at) as date,
			0 as batch_tasks,
			COUNT(*) as siterank_queries,
			0 as chengelink_tasks
		FROM siterank_queries 
		WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
		GROUP BY DATE(created_at)
	`

	var siteRankStats []DailyTaskStats
	if err := s.db.Raw(siteRankQuery, days).Scan(&siteRankStats).Error; err != nil {
		return nil, err
	}

	// 合并数据（简化实现）
	dateMap := make(map[string]*DailyTaskStats)

	for _, stat := range batchStats {
		dateMap[stat.Date] = &DailyTaskStats{
			Date:            stat.Date,
			BatchTasks:      stat.BatchTasks,
			SiteRankQueries: 0,
			ChengeLinkTasks: 0,
		}
	}

	for _, stat := range siteRankStats {
		if existing, exists := dateMap[stat.Date]; exists {
			existing.SiteRankQueries = stat.SiteRankQueries
		} else {
			dateMap[stat.Date] = &DailyTaskStats{
				Date:            stat.Date,
				BatchTasks:      0,
				SiteRankQueries: stat.SiteRankQueries,
				ChengeLinkTasks: 0,
			}
		}
	}

	// 转换为切片
	for _, stat := range dateMap {
		stats = append(stats, *stat)
	}

	return stats, nil
}

// GetTopUsers 获取用户排行榜
func (s *DashboardService) GetTopUsers(limit int) ([]UserRanking, error) {
	var rankings []UserRanking

	query := `
		SELECT 
			u.id,
			u.username,
			u.email,
			u.plan_name,
			u.token_balance,
			u.created_at,
			COALESCE(SUM(CASE WHEN tt.amount < 0 THEN ABS(tt.amount) ELSE 0 END), 0) as tokens_consumed,
			COALESCE(bt.batch_count, 0) as batch_tasks,
			COALESCE(sr.siterank_count, 0) as siterank_queries,
			COALESCE(inv.invitation_count, 0) as invitations
		FROM users u
		LEFT JOIN token_transactions tt ON u.id = tt.user_id
		LEFT JOIN (
			SELECT user_id, COUNT(*) as batch_count 
			FROM batch_tasks 
			GROUP BY user_id
		) bt ON u.id = bt.user_id
		LEFT JOIN (
			SELECT user_id, COUNT(*) as siterank_count 
			FROM siterank_queries 
			GROUP BY user_id
		) sr ON u.id = sr.user_id
		LEFT JOIN (
			SELECT inviter_id, COUNT(*) as invitation_count 
			FROM invitations 
			WHERE status = 'completed'
			GROUP BY inviter_id
		) inv ON u.id = inv.inviter_id
		GROUP BY u.id, u.username, u.email, u.plan_name, u.token_balance, u.created_at
		ORDER BY tokens_consumed DESC
		LIMIT ?
	`

	if err := s.db.Raw(query, limit).Scan(&rankings).Error; err != nil {
		return nil, err
	}

	return rankings, nil
}

// GetRevenueStats 获取收入统计（模拟数据）
func (s *DashboardService) GetRevenueStats() (*RevenueStats, error) {
	stats := &RevenueStats{}

	// 这里应该根据实际的支付记录计算
	// 目前使用模拟数据
	stats.TotalRevenue = 12580.50
	stats.MonthlyRevenue = 3250.00
	stats.DailyRevenue = 125.30
	stats.AverageRevenuePerUser = 45.20

	return stats, nil
}

// GetSystemHealth 获取系统健康状态
func (s *DashboardService) GetSystemHealth() (*SystemHealth, error) {
	health := &SystemHealth{
		DatabaseStatus: "healthy",
		RedisStatus:    "healthy",
		APIStatus:      "healthy",
		LastUpdated:    time.Now(),
	}

	// 检查数据库连接
	sqlDB, err := s.db.DB()
	if err != nil {
		health.DatabaseStatus = "error"
	} else {
		if err := sqlDB.Ping(); err != nil {
			health.DatabaseStatus = "error"
		}
	}

	// 这里可以添加更多健康检查

	return health, nil
}
