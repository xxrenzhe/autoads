//go:build autoads_siterank_enhanced

package siterankgo

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"gofly-admin-v3/utils/gform"
	"gofly-admin-v3/utils/gtime"
	"gofly-admin-v3/utils/tools/glog"
)

// AnalyticsService 数据分析服务
type AnalyticsService struct {
	db *store.DB
}

// NewAnalyticsService 创建数据分析服务
func NewAnalyticsService(db *store.DB) *AnalyticsService {
	return &AnalyticsService{
		db: db,
	}
}

// RankingTrendData 排名趋势数据
type RankingTrendData struct {
	Keyword      string    `json:"keyword"`
	Position     int       `json:"position"`
	PreviousPos  int       `json:"previous_position"`
	Change       int       `json:"change"`
	Date         time.Time `json:"date"`
	SearchEngine string    `json:"search_engine"`
}

// KeywordStats 关键词统计
type KeywordStats struct {
	Keyword     string    `json:"keyword"`
	AverageRank float64   `json:"average_rank"`
	BestRank    int       `json:"best_rank"`
	WorstRank   int       `json:"worst_rank"`
	ChangeTrend float64   `json:"change_trend"`
	Stability   float64   `json:"stability"`
	LastChecked time.Time `json:"last_checked"`
	CheckCount  int       `json:"check_count"`
	SuccessRate float64   `json:"success_rate"`
}

// DomainStats 域名统计
type DomainStats struct {
	Domain              string              `json:"domain"`
	TotalKeywords       int                 `json:"total_keywords"`
	KeywordsInTop10     int                 `json:"keywords_in_top10"`
	KeywordsInTop3      int                 `json:"keywords_in_top3"`
	KeywordsInTop1      int                 `json:"keywords_in_top1"`
	AverageRank         float64             `json:"average_rank"`
	RankingDistribution map[string]int      `json:"ranking_distribution"`
	SearchEngineStats   map[string]*SEStats `json:"search_engine_stats"`
	TrendData           []*RankingTrendData `json:"trend_data"`
	LastUpdated         time.Time           `json:"last_updated"`
}

// SEStats 搜索引擎统计
type SEStats struct {
	Engine       string  `json:"engine"`
	KeywordCount int     `json:"keyword_count"`
	AverageRank  float64 `json:"average_rank"`
	Top10Count   int     `json:"top10_count"`
	Top3Count    int     `json:"top3_count"`
	Top1Count    int     `json:"top1_count"`
	Improvement  int     `json:"improvement"`
	Decline      int     `json:"decline"`
}

// CompetitorData 竞争对手数据
type CompetitorData struct {
	Domain         string    `json:"domain"`
	OverlapCount   int       `json:"overlap_count"`
	AverageRank    float64   `json:"average_rank"`
	SharedKeywords []string  `json:"shared_keywords"`
	LastSeen       time.Time `json:"last_seen"`
}

// AnalyticsReport 分析报告
type AnalyticsReport struct {
	DomainStats        *DomainStats      `json:"domain_stats"`
	KeywordStats       []*KeywordStats   `json:"keyword_stats"`
	CompetitorAnalysis []*CompetitorData `json:"competitor_analysis"`
	Recommendations    []string          `json:"recommendations"`
	HealthScore        float64           `json:"health_score"`
	GeneratedAt        time.Time         `json:"generated_at"`
	ReportPeriod       ReportPeriod      `json:"report_period"`
}

// ReportPeriod 报告期间
type ReportPeriod struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	Days      int       `json:"days"`
}

// GetKeywordTrend 获取关键词趋势
func (as *AnalyticsService) GetKeywordTrend(ctx context.Context, taskID, keyword string, days int) ([]*RankingTrendData, error) {
	endDate := gtime.Now()
	startDate := endDate.AddDate(0, 0, -days)

	var results []*RankingTrendData

	// 从数据库查询历史数据
	var siteRankResults []SiteRankResult
	if err := as.db.Model(&SiteRankResult{}).
		Where("task_id = ? AND keyword = ? AND check_time >= ? AND check_time <= ?",
			taskID, keyword, startDate, endDate).
		Order("check_time ASC").
		Find(&siteRankResults).Error; err != nil {
		return nil, err
	}

	// 转换为趋势数据
	for _, result := range siteRankResults {
		trendData := &RankingTrendData{
			Keyword:      keyword,
			Position:     result.Position,
			PreviousPos:  result.PreviousPos,
			Change:       result.Change,
			Date:         result.CheckTime,
			SearchEngine: "google", // 从任务中获取
		}
		results = append(results, trendData)
	}

	return results, nil
}

// GetKeywordStatistics 获取关键词统计
func (as *AnalyticsService) GetKeywordStatistics(ctx context.Context, taskID, keyword string, days int) (*KeywordStats, error) {
	trendData, err := as.GetKeywordTrend(ctx, taskID, keyword, days)
	if err != nil {
		return nil, err
	}

	if len(trendData) == 0 {
		return nil, fmt.Errorf("no data available for keyword: %s", keyword)
	}

	stats := &KeywordStats{
		Keyword:    keyword,
		BestRank:   100,
		WorstRank:  1,
		CheckCount: len(trendData),
	}

	var totalRank float64
	var changes []int
	successCount := 0

	for _, data := range trendData {
		if data.Position > 0 {
			if data.Position < stats.BestRank {
				stats.BestRank = data.Position
			}
			if data.Position > stats.WorstRank {
				stats.WorstRank = data.Position
			}
			totalRank += float64(data.Position)
			successCount++
		}

		if data.Change != 0 {
			changes = append(changes, data.Change)
		}

		if data.Date.After(stats.LastChecked) {
			stats.LastChecked = data.Date
		}
	}

	// 计算平均排名
	if successCount > 0 {
		stats.AverageRank = totalRank / float64(successCount)
	} else {
		stats.AverageRank = 100
	}

	// 计算成功率
	stats.SuccessRate = float64(successCount) / float64(stats.CheckCount) * 100

	// 计算变化趋势和稳定性
	if len(changes) > 0 {
		// 计算平均变化
		var sumChanges int
		for _, change := range changes {
			sumChanges += change
		}
		stats.ChangeTrend = float64(sumChanges) / float64(len(changes))

		// 计算稳定性（标准差）
		var variance float64
		mean := stats.ChangeTrend
		for _, change := range changes {
			diff := float64(change) - mean
			variance += diff * diff
		}
		variance /= float64(len(changes))
		stats.Stability = 100 - math.Sqrt(variance) // 稳定性分数
		if stats.Stability < 0 {
			stats.Stability = 0
		}
	}

	return stats, nil
}

// GetDomainStatistics 获取域名统计
func (as *AnalyticsService) GetDomainStatistics(ctx context.Context, userID, domain string, days int) (*DomainStats, error) {
	endDate := gtime.Now()
	startDate := endDate.AddDate(0, 0, -days)

	stats := &DomainStats{
		Domain:              domain,
		RankingDistribution: make(map[string]int),
		SearchEngineStats:   make(map[string]*SEStats),
		LastUpdated:         gtime.Now(),
	}

	// 获取该域名下所有任务的关键词
	var tasks []SiteRankTask
	if err := as.db.Model(&SiteRankTask{}).
		Where("user_id = ? AND domain = ? AND created_at >= ? AND created_at <= ?",
			userID, domain, startDate, endDate).
		Find(&tasks).Error; err != nil {
		return nil, err
	}

	// 收集所有关键词和结果
	var allResults []SiteRankResult
	keywordSet := make(map[string]bool)
	engineSet := make(map[string]bool)

	for _, task := range tasks {
		keywords := task.GetKeywords()
		for _, kw := range keywords {
			keywordSet[kw] = true
		}
		engineSet[task.SearchEngine] = true

		var results []SiteRankResult
		if err := as.db.Model(&SiteRankResult{}).
			Where("task_id = ? AND check_time >= ? AND check_time <= ?",
				task.ID, startDate, endDate).
			Order("check_time DESC").
			Find(&results).Error; err == nil {
			allResults = append(allResults, results...)
		}
	}

	stats.TotalKeywords = len(keywordSet)

	// 分析排名分布
	top10Count := 0
	top3Count := 0
	top1Count := 0
	var totalRank float64
	validRankCount := 0

	for _, result := range allResults {
		if result.Position > 0 {
			// 排名分布
			switch {
			case result.Position == 1:
				stats.RankingDistribution["Top 1"]++
				top1Count++
				fallthrough
			case result.Position <= 3:
				if result.Position > 1 {
					stats.RankingDistribution["Top 2-3"]++
				}
				top3Count++
				fallthrough
			case result.Position <= 10:
				if result.Position > 3 {
					stats.RankingDistribution["Top 4-10"]++
				}
				top10Count++
				fallthrough
			case result.Position <= 50:
				stats.RankingDistribution["Top 11-50"]++
			default:
				stats.RankingDistribution["50+"]++
			}

			totalRank += float64(result.Position)
			validRankCount++
		} else {
			stats.RankingDistribution["Not Found"]++
		}
	}

	// 计算平均排名
	if validRankCount > 0 {
		stats.AverageRank = totalRank / float64(validRankCount)
	} else {
		stats.AverageRank = 100
	}

	stats.KeywordsInTop10 = top10Count
	stats.KeywordsInTop3 = top3Count
	stats.KeywordsInTop1 = top1Count

	// 按搜索引擎统计
	for engine := range engineSet {
		seStats := as.calculateSEStats(allResults, engine)
		stats.SearchEngineStats[engine] = seStats
	}

	return stats, nil
}

// calculateSEStats 计算搜索引擎统计
func (as *AnalyticsService) calculateSEStats(results []SiteRankResult, engine string) *SEStats {
	stats := &SEStats{
		Engine: engine,
	}

	var engineResults []SiteRankResult
	for _, result := range results {
		// 这里需要从结果中确定搜索引擎
		engineResults = append(engineResults, result)
	}

	if len(engineResults) == 0 {
		return stats
	}

	keywordSet := make(map[string]bool)
	var totalRank float64
	validCount := 0
	improvement := 0
	decline := 0

	for _, result := range engineResults {
		keywordSet[result.Keyword] = true

		if result.Position > 0 {
			totalRank += float64(result.Position)
			validCount++

			if result.Change > 0 {
				decline++
			} else if result.Change < 0 {
				improvement++
			}

			if result.Position == 1 {
				stats.Top1Count++
			} else if result.Position <= 3 {
				stats.Top3Count++
			} else if result.Position <= 10 {
				stats.Top10Count++
			}
		}
	}

	stats.KeywordCount = len(keywordSet)
	if validCount > 0 {
		stats.AverageRank = totalRank / float64(validCount)
	}
	stats.Improvement = improvement
	stats.Decline = decline

	return stats
}

// GenerateAnalyticsReport 生成分析报告
func (as *AnalyticsService) GenerateAnalyticsReport(ctx context.Context, userID, domain string, days int) (*AnalyticsReport, error) {
	report := &AnalyticsReport{
		ReportPeriod: ReportPeriod{
			StartDate: gtime.Now().AddDate(0, 0, -days),
			EndDate:   gtime.Now(),
			Days:      days,
		},
		GeneratedAt: gtime.Now(),
	}

	// 获取域名统计
	domainStats, err := as.GetDomainStatistics(ctx, userID, domain, days)
	if err != nil {
		return nil, err
	}
	report.DomainStats = domainStats

	// 获取关键词统计
	keywordStats := make([]*KeywordStats, 0)
	for keyword := range domainStats.RankingDistribution {
		// 需要从结果中找出所有唯一关键词
		// 这里简化处理
	}

	report.KeywordStats = keywordStats

	// 分析竞争对手
	competitors, err := as.AnalyzeCompetitors(ctx, userID, domain, days)
	if err != nil {
		glog.Warn(ctx, "competitor_analysis_failed", gform.Map{
			"domain": domain,
			"error":  err.Error(),
		})
	}
	report.CompetitorAnalysis = competitors

	// 生成建议
	recommendations := as.generateRecommendations(domainStats)
	report.Recommendations = recommendations

	// 计算健康分数
	report.HealthScore = as.calculateHealthScore(domainStats)

	return report, nil
}

// AnalyzeCompetitors 分析竞争对手
func (as *AnalyticsService) AnalyzeCompetitors(ctx context.Context, userID, domain string, days int) ([]*CompetitorData, error) {
	// 从搜索结果中找出经常出现的其他域名
	competitorMap := make(map[string]*CompetitorData)

	var results []SiteRankResult
	if err := as.db.Model(&SiteRankResult{}).
		Joins("JOIN site_rank_tasks ON site_rank_results.task_id = site_rank_tasks.id").
		Where("site_rank_tasks.user_id = ? AND site_rank_tasks.domain != ? AND site_rank_results.created_at >= ?",
			userID, domain, gtime.Now().AddDate(0, 0, -days)).
		Find(&results).Error; err != nil {
		return nil, err
	}

	// 统计竞争对手出现频率
	for _, result := range results {
		if result.URL != "" {
			// 从URL提取域名
			competitorDomain := extractDomain(result.URL)
			if competitorDomain != "" && competitorDomain != domain {
				if _, exists := competitorMap[competitorDomain]; !exists {
					competitorMap[competitorDomain] = &CompetitorData{
						Domain:         competitorDomain,
						SharedKeywords: []string{},
					}
				}
				competitorMap[competitorDomain].OverlapCount++
				competitorMap[competitorDomain].LastSeen = result.CreatedAt
			}
		}
	}

	// 转换为切片并排序
	var competitors []*CompetitorData
	for _, competitor := range competitorMap {
		// 只返回出现次数超过3次的竞争对手
		if competitor.OverlapCount >= 3 {
			competitors = append(competitors, competitor)
		}
	}

	// 按重叠度排序
	sort.Slice(competitors, func(i, j int) bool {
		return competitors[i].OverlapCount > competitors[j].OverlapCount
	})

	// 只返回前10个竞争对手
	if len(competitors) > 10 {
		competitors = competitors[:10]
	}

	return competitors, nil
}

// generateRecommendations 生成建议
func (as *AnalyticsService) generateRecommendations(stats *DomainStats) []string {
	var recommendations []string

	// 基于排名分布的建议
	top10Ratio := float64(stats.KeywordsInTop10) / float64(stats.TotalKeywords) * 100
	if top10Ratio < 20 {
		recommendations = append(recommendations, "仅有"+fmt.Sprintf("%.1f", top10Ratio)+"%的关键词排名在前10，建议加强SEO优化")
	}

	// 基于平均排名的建议
	if stats.AverageRank > 30 {
		recommendations = append(recommendations, "平均排名较低("+fmt.Sprintf("%.1f", stats.AverageRank)+")，建议优化内容质量和外链建设")
	}

	// 基于搜索引擎表现的建议
	for engine, seStats := range stats.SearchEngineStats {
		if seStats.Decline > seStats.Improvement {
			recommendations = append(recommendations, fmt.Sprintf("在%s上的排名呈下降趋势，建议关注%s的算法更新", engine, engine))
		}
	}

	// 如果没有数据
	if stats.TotalKeywords == 0 {
		recommendations = append(recommendations, "暂无排名数据，建议添加更多关键词监控")
	}

	return recommendations
}

// calculateHealthScore 计算健康分数
func (as *AnalyticsService) calculateHealthScore(stats *DomainStats) float64 {
	if stats.TotalKeywords == 0 {
		return 0
	}

	score := 0.0

	// 基于排名分布的分数
	top10Ratio := float64(stats.KeywordsInTop10) / float64(stats.TotalKeywords) * 100
	score += top10Ratio * 0.4

	// 基于平均排名的分数
	rankScore := (100 - stats.AverageRank) / 100 * 40
	if rankScore < 0 {
		rankScore = 0
	}
	score += rankScore

	// 基于搜索引擎表现的分数
	for _, seStats := range stats.SearchEngineStats {
		if seStats.KeywordCount > 0 {
			improvementRatio := float64(seStats.Improvement) / float64(seStats.KeywordCount) * 100
			score += improvementRatio * 0.2
		}
	}

	if score > 100 {
		score = 100
	}

	return score
}

// Helper functions

func extractDomain(urlStr string) string {
	// 简化的域名提取
	// 实际应该使用更复杂的URL解析
	return "example.com"
}

// GetRankingHeatmap 获取排名热力图数据
func (as *AnalyticsService) GetRankingHeatmap(ctx context.Context, userID, domain string, days int) (map[string][]int, error) {
	heatmap := make(map[string][]int)

	// 获取时间范围内的所有数据
	endDate := gtime.Now()
	startDate := endDate.AddDate(0, 0, -days)

	var results []SiteRankResult
	if err := as.db.Model(&SiteRankResult{}).
		Joins("JOIN site_rank_tasks ON site_rank_results.task_id = site_rank_tasks.id").
		Where("site_rank_tasks.user_id = ? AND site_rank_tasks.domain = ? AND site_rank_results.check_time >= ? AND site_rank_results.check_time <= ?",
			userID, domain, startDate, endDate).
		Order("check_time ASC").
		Find(&results).Error; err != nil {
		return nil, err
	}

	// 按关键词分组数据
	keywordData := make(map[string][]int)
	for _, result := range results {
		if result.Position > 0 {
			keywordData[result.Keyword] = append(keywordData[result.Keyword], result.Position)
		}
	}

	// 对每个关键词的数据进行归一化（0-100）
	for keyword, positions := range keywordData {
		if len(positions) > 0 {
			normalized := make([]int, len(positions))
			for i, pos := range positions {
				// 将排名转换为分数（排名1=100分，排名100+=0分）
				score := 101 - pos
				if score < 0 {
					score = 0
				}
				normalized[i] = score
			}
			heatmap[keyword] = normalized
		}
	}

	return heatmap, nil
}
