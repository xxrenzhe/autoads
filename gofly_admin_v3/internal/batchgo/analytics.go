//go:build autoads_advanced

package batchgo

import (
    "context"
    "fmt"
    "math"
    "sort"
    "strings"
    "time"

    "gofly-admin-v3/internal/store"
    "gofly-admin-v3/utils/gtime"
)

// AnalyticsService BatchGo数据分析服务
type AnalyticsService struct {
	db *store.DB
}

// NewAnalyticsService 创建BatchGo数据分析服务
func NewAnalyticsService(db *store.DB) *AnalyticsService {
	return &AnalyticsService{
		db: db,
	}
}

// TaskExecutionAnalytics 任务执行分析
type TaskExecutionAnalytics struct {
	TotalTasks           int64                    `json:"total_tasks"`
	SuccessTasks         int64                    `json:"success_tasks"`
	FailedTasks          int64                    `json:"failed_tasks"`
	RunningTasks         int64                    `json:"running_tasks"`
	SuccessRate          float64                  `json:"success_rate"`
	AverageExecutionTime float64                  `json:"average_execution_time"`
	TotalURLs            int64                    `json:"total_urls"`
	SuccessURLs          int64                    `json:"success_urls"`
	FailedURLs           int64                    `json:"failed_urls"`
	URLSuccessRate       float64                  `json:"url_success_rate"`
	TaskTypeStats        map[string]*TaskTypeStat `json:"task_type_stats"`
	TimeDistribution     map[string]int64         `json:"time_distribution"`
	ErrorDistribution    map[string]int64         `json:"error_distribution"`
	PerformanceMetrics   *PerformanceMetrics      `json:"performance_metrics"`
	GeneratedAt          time.Time                `json:"generated_at"`
}

// TaskTypeStat 任务类型统计
type TaskTypeStat struct {
	Type               string  `json:"type"`
	Count              int64   `json:"count"`
	SuccessCount       int64   `json:"success_count"`
	FailedCount        int64   `json:"failed_count"`
	SuccessRate        float64 `json:"success_rate"`
	AverageTime        float64 `json:"average_time"`
	TotalURLs          int64   `json:"total_urls"`
	AverageURLsPerTask float64 `json:"average_urls_per_task"`
}

// PerformanceMetrics 性能指标
type PerformanceMetrics struct {
	ResponseTimeStats *ResponseTimeStats `json:"response_time_stats"`
	ThroughputStats   *ThroughputStats   `json:"throughput_stats"`
	ResourceUsage     *ResourceUsage     `json:"resource_usage"`
	ConcurrencyStats  *ConcurrencyStats  `json:"concurrency_stats"`
}

// ResponseTimeStats 响应时间统计
type ResponseTimeStats struct {
	AverageTime      float64          `json:"average_time"`
	MedianTime       float64          `json:"median_time"`
	P95Time          float64          `json:"p95_time"`
	P99Time          float64          `json:"p99_time"`
	MinTime          float64          `json:"min_time"`
	MaxTime          float64          `json:"max_time"`
	TimeDistribution map[string]int64 `json:"time_distribution"`
}

// ThroughputStats 吞吐量统计
type ThroughputStats struct {
	RequestsPerSecond float64 `json:"requests_per_second"`
	RequestsPerMinute float64 `json:"requests_per_minute"`
	RequestsPerHour   float64 `json:"requests_per_hour"`
	PeakThroughput    float64 `json:"peak_throughput"`
}

// ResourceUsage 资源使用情况
type ResourceUsage struct {
	MemoryUsageMB  float64 `json:"memory_usage_mb"`
	CPUUsage       float64 `json:"cpu_usage"`
	NetworkUsageKB float64 `json:"network_usage_kb"`
	DiskUsageKB    float64 `json:"disk_usage_kb"`
}

// ConcurrencyStats 并发统计
type ConcurrencyStats struct {
	MaxConcurrentTasks      int           `json:"max_concurrent_tasks"`
	AverageConcurrentTasks  float64       `json:"average_concurrent_tasks"`
	ConcurrencyDistribution map[int]int64 `json:"concurrency_distribution"`
}

// TrendAnalysis 趋势分析
type TrendAnalysis struct {
	DailyTrends    []*DailyTrend    `json:"daily_trends"`
	HourlyPatterns []*HourlyPattern `json:"hourly_patterns"`
	GrowthRate     float64          `json:"growth_rate"`
	PeakHours      []int            `json:"peak_hours"`
}

// DailyTrend 日趋势
type DailyTrend struct {
	Date        time.Time `json:"date"`
	TaskCount   int64     `json:"task_count"`
	SuccessRate float64   `json:"success_rate"`
	AvgTime     float64   `json:"avg_time"`
}

// HourlyPattern 小时模式
type HourlyPattern struct {
	Hour        int     `json:"hour"`
	TaskCount   int64   `json:"task_count"`
	SuccessRate float64 `json:"success_rate"`
}

// URLAnalysis URL分析
type URLAnalysis struct {
	URL              string           `json:"url"`
	AccessCount      int64            `json:"access_count"`
	SuccessCount     int64            `json:"success_count"`
	FailedCount      int64            `json:"failed_count"`
	SuccessRate      float64          `json:"success_rate"`
	AverageTime      float64          `json:"average_time"`
	LastAccessed     time.Time        `json:"last_accessed"`
	FirstAccessed    time.Time        `json:"first_accessed"`
	ErrorTypes       map[string]int64 `json:"error_types"`
	ResponseCodeDist map[string]int64 `json:"response_code_distribution"`
}

// GenerateTaskAnalytics 生成任务分析报告
func (as *AnalyticsService) GenerateTaskAnalytics(ctx context.Context, userID string, days int) (*TaskExecutionAnalytics, error) {
	endDate := gtime.Now()
	startDate := endDate.AddDate(0, 0, -days)

	analytics := &TaskExecutionAnalytics{
		TaskTypeStats:     make(map[string]*TaskTypeStat),
		TimeDistribution:  make(map[string]int64),
		ErrorDistribution: make(map[string]int64),
		GeneratedAt:       gtime.Now(),
	}

	// 基础统计
	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userID, startDate, endDate).
		Count(&analytics.TotalTasks).Error; err != nil {
		return nil, err
	}

	// 任务状态统计
	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ? AND status = ?",
			userID, startDate, endDate, "COMPLETED").
		Count(&analytics.SuccessTasks).Error; err != nil {
		return nil, err
	}

	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ? AND status = ?",
			userID, startDate, endDate, "FAILED").
		Count(&analytics.FailedTasks).Error; err != nil {
		return nil, err
	}

	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ? AND status = ?",
			userID, startDate, endDate, "RUNNING").
		Count(&analytics.RunningTasks).Error; err != nil {
		return nil, err
	}

	// 计算成功率
	if analytics.TotalTasks > 0 {
		analytics.SuccessRate = float64(analytics.SuccessTasks) / float64(analytics.TotalTasks) * 100
	}

	// URL统计
	var taskResults []BatchTask
	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userID, startDate, endDate).
		Find(&taskResults).Error; err != nil {
		return nil, err
	}

    for _, task := range taskResults {
        urls := task.GetURLs()
        analytics.TotalURLs += int64(len(urls))
        analytics.SuccessURLs += int64(task.SuccessCount)
        analytics.FailedURLs += int64(task.FailedCount)

		// 任务类型统计
        tType := string(task.Mode)
        if _, exists := analytics.TaskTypeStats[tType]; !exists {
            analytics.TaskTypeStats[tType] = &TaskTypeStat{
                Type: tType,
            }
        }
        stat := analytics.TaskTypeStats[tType]
		stat.Count++
		if task.Status == "COMPLETED" {
			stat.SuccessCount++
		} else if task.Status == "FAILED" {
			stat.FailedCount++
		}

        // 获取执行时间
        if task.StartTime != nil && task.EndTime != nil {
            duration := task.EndTime.Sub(*task.StartTime).Seconds()
            stat.AverageTime = (stat.AverageTime*float64(stat.Count-1) + duration) / float64(stat.Count)
        }
		stat.TotalURLs += int64(len(urls))

		// 时间分布
		hour := task.CreatedAt.Hour()
		timeKey := fmt.Sprintf("%02d:00", hour)
		analytics.TimeDistribution[timeKey]++
	}

	// 计算URL成功率
	if analytics.TotalURLs > 0 {
		analytics.URLSuccessRate = float64(analytics.SuccessURLs) / float64(analytics.TotalURLs) * 100
	}

	// 完善任务类型统计
	for _, stat := range analytics.TaskTypeStats {
		if stat.Count > 0 {
			stat.SuccessRate = float64(stat.SuccessCount) / float64(stat.Count) * 100
		}
		if stat.Count > 0 {
			stat.AverageURLsPerTask = float64(stat.TotalURLs) / float64(stat.Count)
		}
	}

	// 错误分布
	as.analyzeErrorDistribution(ctx, userID, startDate, endDate, analytics)

	// 性能指标
	analytics.PerformanceMetrics = as.calculatePerformanceMetrics(ctx, userID, startDate, endDate)

	return analytics, nil
}

// analyzeErrorDistribution 分析错误分布
func (as *AnalyticsService) analyzeErrorDistribution(ctx context.Context, userID string, startDate, endDate time.Time, analytics *TaskExecutionAnalytics) {
	var failedTasks []BatchTask
	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ? AND status = ?",
			userID, startDate, endDate, "FAILED").
		Find(&failedTasks).Error; err != nil {
		return
	}

    for _, task := range failedTasks {
        if task.ErrorMessage != "" {
            errorType := as.categorizeError(task.ErrorMessage)
            analytics.ErrorDistribution[errorType]++
        }
    }
}

// categorizeError 分类错误
func (as *AnalyticsService) categorizeError(errorMsg string) string {
	errorMsg = strings.ToLower(errorMsg)

	switch {
	case strings.Contains(errorMsg, "timeout"):
		return "timeout"
	case strings.Contains(errorMsg, "connection"):
		return "connection_error"
	case strings.Contains(errorMsg, "proxy"):
		return "proxy_error"
	case strings.Contains(errorMsg, "dns"):
		return "dns_error"
	case strings.Contains(errorMsg, "certificate"):
		return "ssl_error"
	case strings.Contains(errorMsg, "404"):
		return "not_found"
	case strings.Contains(errorMsg, "403"):
		return "forbidden"
	case strings.Contains(errorMsg, "500"):
		return "server_error"
	default:
		return "other"
	}
}

// calculatePerformanceMetrics 计算性能指标
func (as *AnalyticsService) calculatePerformanceMetrics(ctx context.Context, userID string, startDate, endDate time.Time) *PerformanceMetrics {
	metrics := &PerformanceMetrics{}

	// 响应时间统计
	var results []BatchTaskResult
	if err := as.db.Model(&BatchTaskResult{}).
		Joins("JOIN batch_tasks ON batch_task_results.task_id = batch_tasks.id").
		Where("batch_tasks.user_id = ? AND batch_task_results.created_at >= ? AND batch_task_results.created_at <= ?",
			userID, startDate, endDate).
		Find(&results).Error; err != nil {
		return metrics
	}

	if len(results) == 0 {
		return metrics
	}

	// 计算响应时间统计
	var times []float64
	timeDistribution := make(map[string]int64)

	for _, result := range results {
		if result.ResponseTime > 0 {
			times = append(times, float64(result.ResponseTime))

			// 时间分布
			var bucket string
			switch {
			case result.ResponseTime < 1000:
				bucket = "< 1s"
			case result.ResponseTime < 5000:
				bucket = "1-5s"
			case result.ResponseTime < 10000:
				bucket = "5-10s"
			case result.ResponseTime < 30000:
				bucket = "10-30s"
			default:
				bucket = "> 30s"
			}
			timeDistribution[bucket]++
		}
	}

	if len(times) > 0 {
		sort.Float64s(times)

		metrics.ResponseTimeStats = &ResponseTimeStats{
			AverageTime:      average(times),
			MedianTime:       median(times),
			P95Time:          percentile(times, 95),
			P99Time:          percentile(times, 99),
			MinTime:          times[0],
			MaxTime:          times[len(times)-1],
			TimeDistribution: timeDistribution,
		}
	}

	// 吞吐量统计
	duration := endDate.Sub(startDate).Seconds()
	if duration > 0 {
		requestsPerSecond := float64(len(results)) / duration
		metrics.ThroughputStats = &ThroughputStats{
			RequestsPerSecond: requestsPerSecond,
			RequestsPerMinute: requestsPerSecond * 60,
			RequestsPerHour:   requestsPerSecond * 3600,
			PeakThroughput:    requestsPerSecond * 2, // 简化计算
		}
	}

	// 并发统计
	metrics.ConcurrencyStats = as.calculateConcurrencyStats(ctx, userID, startDate, endDate)

	return metrics
}

// calculateConcurrencyStats 计算并发统计
func (as *AnalyticsService) calculateConcurrencyStats(ctx context.Context, userID string, startDate, endDate time.Time) *ConcurrencyStats {
	stats := &ConcurrencyStats{
		ConcurrencyDistribution: make(map[int]int64),
	}

	// 获取所有运行中的任务时间段
	var tasks []BatchTask
	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ? AND (status = ? OR status = ?)",
			userID, startDate, endDate, "RUNNING", "COMPLETED").
		Find(&tasks).Error; err != nil {
		return stats
	}

	// 简化：计算最大并发数
	concurrentCount := make(map[int64]int64)
    for _, task := range tasks {
        if task.StartTime != nil {
            timestamp := task.StartTime.Unix()
            concurrentCount[timestamp]++
        }
    }

	var maxConcurrent int64
	for _, count := range concurrentCount {
		if count > maxConcurrent {
			maxConcurrent = count
		}
	}

	stats.MaxConcurrentTasks = int(maxConcurrent)

	return stats
}

// GetTrendAnalysis 获取趋势分析
func (as *AnalyticsService) GetTrendAnalysis(ctx context.Context, userID string, days int) (*TrendAnalysis, error) {
	endDate := gtime.Now()
	startDate := endDate.AddDate(0, 0, -days)

	analysis := &TrendAnalysis{
		DailyTrends:    make([]*DailyTrend, 0),
		HourlyPatterns: make([]*HourlyPattern, 0),
	}

	// 日趋势数据
	dailyData := make(map[string]*DailyTrend)
	var tasks []BatchTask
	if err := as.db.Model(&BatchTask{}).
		Where("user_id = ? AND created_at >= ? AND created_at <= ?", userID, startDate, endDate).
		Find(&tasks).Error; err != nil {
		return nil, err
	}

	for _, task := range tasks {
		dateKey := task.CreatedAt.Format("2006-01-02")
		if _, exists := dailyData[dateKey]; !exists {
			dailyData[dateKey] = &DailyTrend{
				Date:      time.Date(task.CreatedAt.Year(), task.CreatedAt.Month(), task.CreatedAt.Day(), 0, 0, 0, 0, task.CreatedAt.Location()),
				TaskCount: 0,
			}
		}
		trend := dailyData[dateKey]
		trend.TaskCount++
		if task.Status == "COMPLETED" {
			trend.SuccessRate = (trend.SuccessRate*float64(trend.TaskCount-1) + 100) / float64(trend.TaskCount)
		}
	}

	// 转换为切片
	for _, trend := range dailyData {
		analysis.DailyTrends = append(analysis.DailyTrends, trend)
	}
	sort.Slice(analysis.DailyTrends, func(i, j int) bool {
		return analysis.DailyTrends[i].Date.Before(analysis.DailyTrends[j].Date)
	})

	// 计算增长率
	if len(analysis.DailyTrends) >= 2 {
		first := analysis.DailyTrends[0]
		last := analysis.DailyTrends[len(analysis.DailyTrends)-1]
		if first.TaskCount > 0 {
			analysis.GrowthRate = float64(last.TaskCount-first.TaskCount) / float64(first.TaskCount) * 100
		}
	}

	// 小时模式
	hourlyData := make(map[int]*HourlyPattern)
	for i := 0; i < 24; i++ {
		hourlyData[i] = &HourlyPattern{
			Hour: i,
		}
	}

    for _, task := range tasks {
        hour := task.CreatedAt.Hour()
        hourlyData[hour].TaskCount++
        if string(task.Status) == "completed" || string(task.Status) == "COMPLETED" {
            pattern := hourlyData[hour]
            pattern.SuccessRate = (pattern.SuccessRate*float64(pattern.TaskCount-1) + 100) / float64(pattern.TaskCount)
        }
    }

	for _, pattern := range hourlyData {
		analysis.HourlyPatterns = append(analysis.HourlyPatterns, pattern)
	}

	// 找出高峰时段
	var totalTasks int64
	for _, pattern := range analysis.HourlyPatterns {
		totalTasks += pattern.TaskCount
	}
	averageTasksPerHour := float64(totalTasks) / 24

	for _, pattern := range analysis.HourlyPatterns {
		if float64(pattern.TaskCount) > averageTasksPerHour*1.5 {
			analysis.PeakHours = append(analysis.PeakHours, pattern.Hour)
		}
	}

	return analysis, nil
}

// AnalyzeURLs 分析URL
func (as *AnalyticsService) AnalyzeURLs(ctx context.Context, userID string, days int) ([]*URLAnalysis, error) {
	endDate := gtime.Now()
	startDate := endDate.AddDate(0, 0, -days)

	// 获取所有URL结果
	var results []BatchTaskResult
	if err := as.db.Model(&BatchTaskResult{}).
		Joins("JOIN batch_tasks ON batch_task_results.task_id = batch_tasks.id").
		Where("batch_tasks.user_id = ? AND batch_task_results.created_at >= ? AND batch_task_results.created_at <= ?",
			userID, startDate, endDate).
		Find(&results).Error; err != nil {
		return nil, err
	}

	// 按URL分组统计
	urlMap := make(map[string]*URLAnalysis)
	for _, result := range results {
		if _, exists := urlMap[result.URL]; !exists {
			urlMap[result.URL] = &URLAnalysis{
				URL:              result.URL,
				ErrorTypes:       make(map[string]int64),
				ResponseCodeDist: make(map[string]int64),
				FirstAccessed:    result.CreatedAt,
			}
		}
		analysis := urlMap[result.URL]

		analysis.AccessCount++
		analysis.LastAccessed = result.CreatedAt

		if result.Status == "SUCCESS" {
			analysis.SuccessCount++
		} else {
			analysis.FailedCount++
			if result.Error != "" {
				errorType := as.categorizeError(result.Error)
				analysis.ErrorTypes[errorType]++
			}
		}

		if result.ResponseTime > 0 {
			analysis.AverageTime = (analysis.AverageTime*float64(analysis.AccessCount-1) + float64(result.ResponseTime)) / float64(analysis.AccessCount)
		}

		if result.StatusCode > 0 {
			statusKey := fmt.Sprintf("%d", result.StatusCode)
			analysis.ResponseCodeDist[statusKey]++
		}
	}

	// 计算成功率并转换为切片
	var urlAnalyses []*URLAnalysis
	for _, analysis := range urlMap {
		if analysis.AccessCount > 0 {
			analysis.SuccessRate = float64(analysis.SuccessCount) / float64(analysis.AccessCount) * 100
		}
		urlAnalyses = append(urlAnalyses, analysis)
	}

	// 按访问次数排序
	sort.Slice(urlAnalyses, func(i, j int) bool {
		return urlAnalyses[i].AccessCount > urlAnalyses[j].AccessCount
	})

	return urlAnalyses, nil
}

// Helper functions

func average(numbers []float64) float64 {
	if len(numbers) == 0 {
		return 0
	}
	sum := 0.0
	for _, num := range numbers {
		sum += num
	}
	return sum / float64(len(numbers))
}

func median(numbers []float64) float64 {
	if len(numbers) == 0 {
		return 0
	}
	sort.Float64s(numbers)
	n := len(numbers)
	if n%2 == 1 {
		return numbers[n/2]
	}
	return (numbers[n/2-1] + numbers[n/2]) / 2
}

func percentile(numbers []float64, p int) float64 {
	if len(numbers) == 0 {
		return 0
	}
	sort.Float64s(numbers)
	n := len(numbers)
	index := int(math.Ceil(float64(n)*float64(p)/100)) - 1
	if index < 0 {
		index = 0
	}
	if index >= n {
		index = n - 1
	}
	return numbers[index]
}
