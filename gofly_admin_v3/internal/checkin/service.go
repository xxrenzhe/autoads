package checkin

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// CheckinService 签到服务
type CheckinService struct {
	db           *gorm.DB
	tokenService TokenService
}

// TokenService Token服务接口
type TokenService interface {
	AddTokens(userID string, amount int, tokenType, description string) error
	GetBalance(userID string) (int, error)
}

// NewCheckinService 创建签到服务
func NewCheckinService(db *gorm.DB, tokenService TokenService) *CheckinService {
	return &CheckinService{
		db:           db,
		tokenService: tokenService,
	}
}

// PerformCheckin 执行签到
func (s *CheckinService) PerformCheckin(userID string) (*CheckinResult, error) {
	today := time.Now().Format("2006-01-02")

	// 检查今天是否已签到
	var existingRecord CheckinRecord
	err := s.db.Where("user_id = ? AND checkin_date = ?", userID, today).First(&existingRecord).Error

	if err == nil {
		// 已经签到过了
		return &CheckinResult{
			Success:     false,
			Message:     "今天已经签到过了",
			TokenReward: 0,
			CheckinDate: today,
			AlreadyDone: true,
		}, nil
	}

	if err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("检查签到记录失败: %w", err)
	}

	// 执行签到
	const dailyTokenReward = 10 // 固定10个Token奖励

	var result *CheckinResult
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 创建签到记录
		checkinRecord := &CheckinRecord{
			UserID:      userID,
			CheckinDate: today,
			TokenReward: dailyTokenReward,
			CreatedAt:   time.Now(),
		}

		if err := tx.Create(checkinRecord).Error; err != nil {
			return fmt.Errorf("创建签到记录失败: %w", err)
		}

		// 2. 给用户添加Token奖励
		if err := s.tokenService.AddTokens(userID, dailyTokenReward, "checkin", "每日签到奖励"); err != nil {
			return fmt.Errorf("添加Token奖励失败: %w", err)
		}

		result = &CheckinResult{
			Success:     true,
			Message:     "签到成功",
			TokenReward: dailyTokenReward,
			CheckinDate: today,
			AlreadyDone: false,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

// GetCheckinStatus 获取签到状态
func (s *CheckinService) GetCheckinStatus(userID string) (*CheckinStatus, error) {
	today := time.Now().Format("2006-01-02")

	// 检查今天是否已签到
	var todayRecord CheckinRecord
	todayChecked := true
	err := s.db.Where("user_id = ? AND checkin_date = ?", userID, today).First(&todayRecord).Error
	if err == gorm.ErrRecordNotFound {
		todayChecked = false
	} else if err != nil {
		return nil, fmt.Errorf("检查今日签到状态失败: %w", err)
	}

	// 获取连续签到天数
	consecutiveDays, err := s.getConsecutiveCheckinDays(userID)
	if err != nil {
		return nil, fmt.Errorf("获取连续签到天数失败: %w", err)
	}

	// 获取本月签到天数
	monthlyDays, err := s.getMonthlyCheckinDays(userID)
	if err != nil {
		return nil, fmt.Errorf("获取本月签到天数失败: %w", err)
	}

	// 获取总签到天数
	totalDays, err := s.getTotalCheckinDays(userID)
	if err != nil {
		return nil, fmt.Errorf("获取总签到天数失败: %w", err)
	}

	return &CheckinStatus{
		TodayChecked:    todayChecked,
		ConsecutiveDays: consecutiveDays,
		MonthlyDays:     monthlyDays,
		TotalDays:       totalDays,
		NextReward:      10, // 固定奖励
	}, nil
}

// getConsecutiveCheckinDays 获取连续签到天数
func (s *CheckinService) getConsecutiveCheckinDays(userID string) (int, error) {
	// 从今天开始往前查找连续签到记录
	consecutiveDays := 0
	currentDate := time.Now()

	for {
		dateStr := currentDate.Format("2006-01-02")

		var record CheckinRecord
		err := s.db.Where("user_id = ? AND checkin_date = ?", userID, dateStr).First(&record).Error

		if err == gorm.ErrRecordNotFound {
			break // 没有找到记录，连续签到中断
		} else if err != nil {
			return 0, err
		}

		consecutiveDays++
		currentDate = currentDate.AddDate(0, 0, -1) // 往前一天
	}

	return consecutiveDays, nil
}

// getMonthlyCheckinDays 获取本月签到天数
func (s *CheckinService) getMonthlyCheckinDays(userID string) (int, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	endOfMonth := startOfMonth.AddDate(0, 1, -1)

	var count int64
	err := s.db.Model(&CheckinRecord{}).
		Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
			userID, startOfMonth.Format("2006-01-02"), endOfMonth.Format("2006-01-02")).
		Count(&count).Error

	return int(count), err
}

// getTotalCheckinDays 获取总签到天数
func (s *CheckinService) getTotalCheckinDays(userID string) (int, error) {
	var count int64
	err := s.db.Model(&CheckinRecord{}).Where("user_id = ?", userID).Count(&count).Error
	return int(count), err
}

// GetCheckinCalendar 获取签到日历
func (s *CheckinService) GetCheckinCalendar(userID string, year, month int) (*CheckinCalendar, error) {
	// 构建查询时间范围
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, -1) // 月末

	// 获取该月的签到记录
	var records []CheckinRecord
	err := s.db.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).
		Find(&records).Error

	if err != nil {
		return nil, fmt.Errorf("获取签到记录失败: %w", err)
	}

	// 构建签到日历
	calendar := &CheckinCalendar{
		Year:        year,
		Month:       month,
		CheckinDays: make([]int, 0),
		TotalDays:   len(records),
	}

	for _, record := range records {
		// 解析日期并提取日
		date, err := time.Parse("2006-01-02", record.CheckinDate)
		if err != nil {
			continue
		}
		calendar.CheckinDays = append(calendar.CheckinDays, date.Day())
	}

	return calendar, nil
}

// GetCheckinHistory 获取签到历史
func (s *CheckinService) GetCheckinHistory(userID string, page, size int) ([]CheckinRecord, int64, error) {
	var records []CheckinRecord
	var total int64

	query := s.db.Where("user_id = ?", userID)

	// 获取总数
	if err := query.Model(&CheckinRecord{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("获取签到历史总数失败: %w", err)
	}

	// 获取分页数据
	offset := (page - 1) * size
	if err := query.Order("checkin_date DESC").Offset(offset).Limit(size).Find(&records).Error; err != nil {
		return nil, 0, fmt.Errorf("获取签到历史失败: %w", err)
	}

	return records, total, nil
}

// GetCheckinStats 获取签到统计
func (s *CheckinService) GetCheckinStats(userID string) (*CheckinStats, error) {
	// 获取总签到天数
	totalDays, err := s.getTotalCheckinDays(userID)
	if err != nil {
		return nil, err
	}

	// 获取连续签到天数
	consecutiveDays, err := s.getConsecutiveCheckinDays(userID)
	if err != nil {
		return nil, err
	}

	// 获取本月签到天数
	monthlyDays, err := s.getMonthlyCheckinDays(userID)
	if err != nil {
		return nil, err
	}

	// 计算总Token奖励
	var totalTokens int
	err = s.db.Model(&CheckinRecord{}).
		Select("SUM(token_reward)").
		Where("user_id = ?", userID).
		Scan(&totalTokens).Error
	if err != nil {
		return nil, fmt.Errorf("计算总Token奖励失败: %w", err)
	}

	// 获取最长连续签到记录
	maxConsecutive, err := s.getMaxConsecutiveCheckinDays(userID)
	if err != nil {
		return nil, err
	}

	return &CheckinStats{
		TotalDays:       totalDays,
		ConsecutiveDays: consecutiveDays,
		MonthlyDays:     monthlyDays,
		TotalTokens:     totalTokens,
		MaxConsecutive:  maxConsecutive,
	}, nil
}

// getMaxConsecutiveCheckinDays 获取最长连续签到天数
func (s *CheckinService) getMaxConsecutiveCheckinDays(userID string) (int, error) {
	// 获取所有签到记录，按日期排序
	var records []CheckinRecord
	err := s.db.Where("user_id = ?", userID).
		Order("checkin_date ASC").
		Find(&records).Error

	if err != nil {
		return 0, err
	}

	if len(records) == 0 {
		return 0, nil
	}

	maxConsecutive := 1
	currentConsecutive := 1

	for i := 1; i < len(records); i++ {
		prevDate, _ := time.Parse("2006-01-02", records[i-1].CheckinDate)
		currDate, _ := time.Parse("2006-01-02", records[i].CheckinDate)

		// 检查是否是连续的日期
		if currDate.Sub(prevDate).Hours() == 24 {
			currentConsecutive++
		} else {
			if currentConsecutive > maxConsecutive {
				maxConsecutive = currentConsecutive
			}
			currentConsecutive = 1
		}
	}

	// 检查最后一段连续记录
	if currentConsecutive > maxConsecutive {
		maxConsecutive = currentConsecutive
	}

	return maxConsecutive, nil
}

// GetCheckinLeaderboard 获取签到排行榜
func (s *CheckinService) GetCheckinLeaderboard(limit int) ([]CheckinLeaderboardEntry, error) {
	var entries []CheckinLeaderboardEntry

	query := `
		SELECT 
			u.id,
			u.username,
			u.email,
			COUNT(c.checkin_date) as total_days,
			SUM(c.token_reward) as total_tokens
		FROM users u
		LEFT JOIN checkin_records c ON u.id = c.user_id
		GROUP BY u.id, u.username, u.email
		HAVING total_days > 0
		ORDER BY total_days DESC, total_tokens DESC
		LIMIT ?
	`

	if err := s.db.Raw(query, limit).Scan(&entries).Error; err != nil {
		return nil, fmt.Errorf("获取签到排行榜失败: %w", err)
	}

	return entries, nil
}
