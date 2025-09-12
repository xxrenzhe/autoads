package advanced

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gofly-admin-v3/internal/audit"
	"gofly-admin-v3/internal/cache"
	"gofly-admin-v3/internal/security"
	"gofly-admin-v3/utils/gf"
	"gofly-admin-v3/utils/tools/glog"
	"gorm.io/gorm"
)

// AdvancedSecuritySystem 高级安全系统
type AdvancedSecuritySystem struct {
	db               *gorm.DB
	cache            *cache.Cache
	auditService     *audit.AuditService
	encryptService   *security.EncryptionService
	anomalyDetector  *AnomalyDetector
	threatAnalyzer   *ThreatAnalyzer
	securityReporter *SecurityReporter
	mu               sync.RWMutex
}

// AnomalyDetector 异常检测器
type AnomalyDetector struct {
	db         *gorm.DB
	cache      *cache.Cache
	patterns   map[string]*UserBehaviorPattern
	thresholds map[string]float64
	mu         sync.RWMutex
}

// ThreatAnalyzer 威胁分析器
type ThreatAnalyzer struct {
	db          *gorm.DB
	cache       *cache.Cache
	threatRules map[string]*ThreatRule
	ipBlacklist map[string]*BlacklistEntry
	mu          sync.RWMutex
}

// SecurityReporter 安全报告生成器
type SecurityReporter struct {
	db           *gorm.DB
	auditService *audit.AuditService
}

// UserBehaviorPattern 用户行为模式
type UserBehaviorPattern struct {
	UserID              string             `json:"user_id"`
	AvgSessionDuration  float64            `json:"avg_session_duration"`
	AvgRequestsPerHour  float64            `json:"avg_requests_per_hour"`
	CommonIPs           []string           `json:"common_ips"`
	CommonUserAgents    []string           `json:"common_user_agents"`
	LoginTimePattern    []int              `json:"login_time_pattern"` // 24小时分布
	FeatureUsagePattern map[string]float64 `json:"feature_usage_pattern"`
	LastUpdated         time.Time          `json:"last_updated"`
	Confidence          float64            `json:"confidence"` // 0-1, 模式可信度
}

// ThreatRule 威胁规则
type ThreatRule struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Conditions  []ThreatCondition `json:"conditions"`
	Actions     []ThreatAction    `json:"actions"`
	Severity    string            `json:"severity"` // low, medium, high, critical
	Enabled     bool              `json:"enabled"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// ThreatCondition 威胁条件
type ThreatCondition struct {
	Type       string      `json:"type"`     // ip_frequency, request_pattern, anomaly_score
	Operator   string      `json:"operator"` // gt, lt, eq, contains
	Value      interface{} `json:"value"`
	TimeWindow string      `json:"time_window"` // 1m, 5m, 1h, 1d
}

// ThreatAction 威胁动作
type ThreatAction struct {
	Type       string                 `json:"type"` // block_ip, rate_limit, alert, log
	Duration   time.Duration          `json:"duration"`
	Parameters map[string]interface{} `json:"parameters"`
}

// BlacklistEntry 黑名单条目
type BlacklistEntry struct {
	IP        string     `json:"ip"`
	Reason    string     `json:"reason"`
	Severity  string     `json:"severity"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	CreatedBy string     `json:"created_by"`
}

// SecurityEvent 安全事件
type SecurityEvent struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	UserID      string                 `json:"user_id,omitempty"`
	IPAddress   string                 `json:"ip_address"`
	UserAgent   string                 `json:"user_agent"`
	Description string                 `json:"description"`
	Data        map[string]interface{} `json:"data"`
	RiskScore   float64                `json:"risk_score"`
	Status      string                 `json:"status"` // new, investigating, resolved, false_positive
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// SecurityReport 安全报告
type SecurityReport struct {
	ID              string                   `json:"id"`
	Type            string                   `json:"type"` // daily, weekly, monthly, incident
	Period          string                   `json:"period"`
	Summary         SecuritySummary          `json:"summary"`
	ThreatAnalysis  ThreatAnalysis           `json:"threat_analysis"`
	Recommendations []SecurityRecommendation `json:"recommendations"`
	GeneratedAt     time.Time                `json:"generated_at"`
	GeneratedBy     string                   `json:"generated_by"`
}

// SecuritySummary 安全摘要
type SecuritySummary struct {
	TotalEvents      int            `json:"total_events"`
	CriticalEvents   int            `json:"critical_events"`
	BlockedIPs       int            `json:"blocked_ips"`
	AnomalousUsers   int            `json:"anomalous_users"`
	EventsByType     map[string]int `json:"events_by_type"`
	EventsBySeverity map[string]int `json:"events_by_severity"`
	TopThreats       []string       `json:"top_threats"`
}

// ThreatAnalysis 威胁分析
type ThreatAnalysis struct {
	TrendAnalysis       map[string]float64 `json:"trend_analysis"`
	GeographicAnalysis  map[string]int     `json:"geographic_analysis"`
	TimePatternAnalysis map[string]int     `json:"time_pattern_analysis"`
	RiskAssessment      string             `json:"risk_assessment"`
}

// SecurityRecommendation 安全建议
type SecurityRecommendation struct {
	Type        string `json:"type"`
	Priority    string `json:"priority"`
	Description string `json:"description"`
	Action      string `json:"action"`
}

// NewAdvancedSecuritySystem 创建高级安全系统
func NewAdvancedSecuritySystem(
	db *gorm.DB,
	cache *cache.Cache,
	auditService *audit.AuditService,
	encryptService *security.EncryptionService,
) *AdvancedSecuritySystem {

	anomalyDetector := &AnomalyDetector{
		db:         db,
		cache:      cache,
		patterns:   make(map[string]*UserBehaviorPattern),
		thresholds: make(map[string]float64),
	}

	threatAnalyzer := &ThreatAnalyzer{
		db:          db,
		cache:       cache,
		threatRules: make(map[string]*ThreatRule),
		ipBlacklist: make(map[string]*BlacklistEntry),
	}

	securityReporter := &SecurityReporter{
		db:           db,
		auditService: auditService,
	}

	system := &AdvancedSecuritySystem{
		db:               db,
		cache:            cache,
		auditService:     auditService,
		encryptService:   encryptService,
		anomalyDetector:  anomalyDetector,
		threatAnalyzer:   threatAnalyzer,
		securityReporter: securityReporter,
	}

	// 初始化系统
	system.initialize()

	// 启动后台任务
	go system.startBackgroundTasks()

	return system
}

// initialize 初始化系统
func (ass *AdvancedSecuritySystem) initialize() {
	// 加载威胁规则
	ass.threatAnalyzer.loadThreatRules()

	// 加载黑名单
	ass.threatAnalyzer.loadBlacklist()

	// 设置异常检测阈值
	ass.anomalyDetector.setDefaultThresholds()
}

// AnalyzeRequest 分析请求
func (ass *AdvancedSecuritySystem) AnalyzeRequest(ctx context.Context, userID, ipAddress, userAgent string, requestData map[string]interface{}) (*SecurityAnalysisResult, error) {
	result := &SecurityAnalysisResult{
		UserID:    userID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		RiskScore: 0.0,
		Threats:   []string{},
		Actions:   []string{},
		Timestamp: time.Now(),
	}

	// 检查IP黑名单
	if ass.threatAnalyzer.isIPBlacklisted(ipAddress) {
		result.RiskScore += 0.8
		result.Threats = append(result.Threats, "blacklisted_ip")
		result.Actions = append(result.Actions, "block_request")
		return result, nil
	}

	// 异常检测
	anomalyScore, err := ass.anomalyDetector.detectAnomaly(userID, ipAddress, userAgent, requestData)
	if err != nil {
		glog.Error(ctx, "anomaly_detection_failed", gf.Map{
			"user_id": userID,
			"error":   err.Error(),
		})
	} else {
		result.RiskScore += anomalyScore
		if anomalyScore > 0.6 {
			result.Threats = append(result.Threats, "behavioral_anomaly")
		}
	}

	// 威胁规则检查
	threats := ass.threatAnalyzer.analyzeThreat(ipAddress, userAgent, requestData)
	for _, threat := range threats {
		result.RiskScore += threat.Score
		result.Threats = append(result.Threats, threat.Type)
		result.Actions = append(result.Actions, threat.Action)
	}

	// 记录安全事件
	if result.RiskScore > 0.5 {
		ass.recordSecurityEvent(ctx, result)
	}

	return result, nil
}

// SecurityAnalysisResult 安全分析结果
type SecurityAnalysisResult struct {
	UserID    string    `json:"user_id"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	RiskScore float64   `json:"risk_score"`
	Threats   []string  `json:"threats"`
	Actions   []string  `json:"actions"`
	Timestamp time.Time `json:"timestamp"`
}

// ThreatResult 威胁结果
type ThreatResult struct {
	Type   string  `json:"type"`
	Score  float64 `json:"score"`
	Action string  `json:"action"`
}

// detectAnomaly 检测异常
func (ad *AnomalyDetector) detectAnomaly(userID, ipAddress, userAgent string, requestData map[string]interface{}) (float64, error) {
	// 获取用户行为模式
	pattern, err := ad.getUserBehaviorPattern(userID)
	if err != nil {
		return 0.0, err
	}

	if pattern == nil {
		// 新用户，返回低异常分数
		return 0.1, nil
	}

	anomalyScore := 0.0

	// 检查IP异常
	if !contains(pattern.CommonIPs, ipAddress) {
		anomalyScore += 0.3
	}

	// 检查User-Agent异常
	if !contains(pattern.CommonUserAgents, userAgent) {
		anomalyScore += 0.2
	}

	// 检查时间模式异常
	currentHour := time.Now().Hour()
	if pattern.LoginTimePattern[currentHour] == 0 {
		anomalyScore += 0.2
	}

	// 检查请求频率异常
	if requestFreq, ok := requestData["request_frequency"].(float64); ok {
		if requestFreq > pattern.AvgRequestsPerHour*2 {
			anomalyScore += 0.4
		}
	}

	return math.Min(anomalyScore, 1.0), nil
}

// getUserBehaviorPattern 获取用户行为模式
func (ad *AnomalyDetector) getUserBehaviorPattern(userID string) (*UserBehaviorPattern, error) {
	ad.mu.RLock()
	pattern, exists := ad.patterns[userID]
	ad.mu.RUnlock()

	if exists && time.Since(pattern.LastUpdated) < 24*time.Hour {
		return pattern, nil
	}

	// 从缓存获取
	cacheKey := fmt.Sprintf("behavior_pattern:%s", userID)
	if cached, err := ad.cache.Get(cacheKey); err == nil {
		if p, ok := cached.(*UserBehaviorPattern); ok {
			ad.mu.Lock()
			ad.patterns[userID] = p
			ad.mu.Unlock()
			return p, nil
		}
	}

	// 从数据库分析
	pattern, err := ad.analyzeBehaviorPattern(userID)
	if err != nil {
		return nil, err
	}

	if pattern != nil {
		// 缓存结果
		ad.cache.Set(cacheKey, pattern, 24*time.Hour)
		ad.mu.Lock()
		ad.patterns[userID] = pattern
		ad.mu.Unlock()
	}

	return pattern, nil
}

// analyzeBehaviorPattern 分析行为模式
func (ad *AnomalyDetector) analyzeBehaviorPattern(userID string) (*UserBehaviorPattern, error) {
	// 查询最近30天的审计日志
	var events []audit.AuditEvent
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	if err := ad.db.Where("user_id = ? AND created_at > ?", userID, thirtyDaysAgo).
		Order("created_at ASC").
		Find(&events).Error; err != nil {
		return nil, err
	}

	if len(events) < 10 {
		// 数据不足，无法建立模式
		return nil, nil
	}

	pattern := &UserBehaviorPattern{
		UserID:              userID,
		CommonIPs:           []string{},
		CommonUserAgents:    []string{},
		LoginTimePattern:    make([]int, 24),
		FeatureUsagePattern: make(map[string]float64),
		LastUpdated:         time.Now(),
	}

	// 分析IP分布
	ipCount := make(map[string]int)
	uaCount := make(map[string]int)
	actionCount := make(map[string]int)
	totalRequests := 0
	totalDuration := time.Duration(0)

	for _, event := range events {
		// IP统计
		ipCount[event.IPAddress]++

		// User-Agent统计
		uaCount[event.UserAgent]++

		// 动作统计
		actionCount[event.Action]++

		// 时间模式
		hour := event.CreatedAt.Hour()
		pattern.LoginTimePattern[hour]++

		// 总请求数
		totalRequests++

		// 总时长
		totalDuration += time.Duration(event.Duration) * time.Millisecond
	}

	// 提取常用IP（出现频率>10%）
	for ip, count := range ipCount {
		if float64(count)/float64(totalRequests) > 0.1 {
			pattern.CommonIPs = append(pattern.CommonIPs, ip)
		}
	}

	// 提取常用User-Agent
	for ua, count := range uaCount {
		if float64(count)/float64(totalRequests) > 0.1 {
			pattern.CommonUserAgents = append(pattern.CommonUserAgents, ua)
		}
	}

	// 计算平均请求频率
	if len(events) > 0 {
		timeSpan := events[len(events)-1].CreatedAt.Sub(events[0].CreatedAt)
		if timeSpan > 0 {
			pattern.AvgRequestsPerHour = float64(totalRequests) / timeSpan.Hours()
		}
	}

	// 计算平均会话时长
	if totalRequests > 0 {
		pattern.AvgSessionDuration = totalDuration.Seconds() / float64(totalRequests)
	}

	// 功能使用模式
	for action, count := range actionCount {
		pattern.FeatureUsagePattern[action] = float64(count) / float64(totalRequests)
	}

	// 计算可信度
	pattern.Confidence = math.Min(float64(len(events))/100.0, 1.0)

	return pattern, nil
}

// setDefaultThresholds 设置默认阈值
func (ad *AnomalyDetector) setDefaultThresholds() {
	ad.mu.Lock()
	defer ad.mu.Unlock()

	ad.thresholds["ip_anomaly"] = 0.3
	ad.thresholds["ua_anomaly"] = 0.2
	ad.thresholds["time_anomaly"] = 0.2
	ad.thresholds["frequency_anomaly"] = 0.4
}

// analyzeThreat 分析威胁
func (ta *ThreatAnalyzer) analyzeThreat(ipAddress, userAgent string, requestData map[string]interface{}) []ThreatResult {
	var results []ThreatResult

	ta.mu.RLock()
	defer ta.mu.RUnlock()

	for _, rule := range ta.threatRules {
		if !rule.Enabled {
			continue
		}

		if ta.evaluateThreatRule(rule, ipAddress, userAgent, requestData) {
			score := ta.calculateThreatScore(rule.Severity)
			action := ta.determineThreatAction(rule.Actions)

			results = append(results, ThreatResult{
				Type:   rule.ID,
				Score:  score,
				Action: action,
			})
		}
	}

	return results
}

// evaluateThreatRule 评估威胁规则
func (ta *ThreatAnalyzer) evaluateThreatRule(rule *ThreatRule, ipAddress, userAgent string, requestData map[string]interface{}) bool {
	for _, condition := range rule.Conditions {
		if !ta.evaluateThreatCondition(condition, ipAddress, userAgent, requestData) {
			return false
		}
	}
	return true
}

// evaluateThreatCondition 评估威胁条件
func (ta *ThreatAnalyzer) evaluateThreatCondition(condition ThreatCondition, ipAddress, userAgent string, requestData map[string]interface{}) bool {
	switch condition.Type {
	case "ip_frequency":
		// 检查IP请求频率
		return ta.checkIPFrequency(ipAddress, condition)
	case "suspicious_ua":
		// 检查可疑User-Agent
		return ta.checkSuspiciousUserAgent(userAgent, condition)
	case "request_pattern":
		// 检查请求模式
		return ta.checkRequestPattern(requestData, condition)
	}
	return false
}

// checkIPFrequency 检查IP频率
func (ta *ThreatAnalyzer) checkIPFrequency(ipAddress string, condition ThreatCondition) bool {
	// 从缓存获取IP请求计数
	cacheKey := fmt.Sprintf("ip_freq:%s", ipAddress)
	count, err := ta.cache.Get(cacheKey)
	if err != nil {
		return false
	}

	if requestCount, ok := count.(int); ok {
		threshold, _ := condition.Value.(float64)
		return float64(requestCount) > threshold
	}

	return false
}

// checkSuspiciousUserAgent 检查可疑User-Agent
func (ta *ThreatAnalyzer) checkSuspiciousUserAgent(userAgent string, condition ThreatCondition) bool {
	suspiciousPatterns, ok := condition.Value.([]string)
	if !ok {
		return false
	}

	userAgentLower := strings.ToLower(userAgent)
	for _, pattern := range suspiciousPatterns {
		if strings.Contains(userAgentLower, strings.ToLower(pattern)) {
			return true
		}
	}

	return false
}

// checkRequestPattern 检查请求模式
func (ta *ThreatAnalyzer) checkRequestPattern(requestData map[string]interface{}, condition ThreatCondition) bool {
	// 简化实现
	return false
}

// calculateThreatScore 计算威胁分数
func (ta *ThreatAnalyzer) calculateThreatScore(severity string) float64 {
	switch severity {
	case "critical":
		return 0.9
	case "high":
		return 0.7
	case "medium":
		return 0.5
	case "low":
		return 0.3
	default:
		return 0.1
	}
}

// determineThreatAction 确定威胁动作
func (ta *ThreatAnalyzer) determineThreatAction(actions []ThreatAction) string {
	if len(actions) == 0 {
		return "log"
	}

	// 返回第一个动作的类型
	return actions[0].Type
}

// isIPBlacklisted 检查IP是否在黑名单
func (ta *ThreatAnalyzer) isIPBlacklisted(ipAddress string) bool {
	ta.mu.RLock()
	defer ta.mu.RUnlock()

	entry, exists := ta.ipBlacklist[ipAddress]
	if !exists {
		return false
	}

	// 检查是否过期
	if entry.ExpiresAt != nil && time.Now().After(*entry.ExpiresAt) {
		delete(ta.ipBlacklist, ipAddress)
		return false
	}

	return true
}

// loadThreatRules 加载威胁规则
func (ta *ThreatAnalyzer) loadThreatRules() {
	// 内置威胁规则
	rules := map[string]*ThreatRule{
		"high_frequency_requests": {
			ID:          "high_frequency_requests",
			Name:        "高频请求检测",
			Description: "检测异常高频的API请求",
			Conditions: []ThreatCondition{
				{
					Type:       "ip_frequency",
					Operator:   "gt",
					Value:      100.0,
					TimeWindow: "1m",
				},
			},
			Actions: []ThreatAction{
				{
					Type:     "rate_limit",
					Duration: 10 * time.Minute,
				},
			},
			Severity:  "medium",
			Enabled:   true,
			CreatedAt: time.Now(),
		},
		"suspicious_user_agent": {
			ID:          "suspicious_user_agent",
			Name:        "可疑User-Agent检测",
			Description: "检测可疑的User-Agent字符串",
			Conditions: []ThreatCondition{
				{
					Type:     "suspicious_ua",
					Operator: "contains",
					Value:    []string{"bot", "crawler", "scanner", "hack"},
				},
			},
			Actions: []ThreatAction{
				{
					Type:     "alert",
					Duration: 0,
				},
			},
			Severity:  "low",
			Enabled:   true,
			CreatedAt: time.Now(),
		},
	}

	ta.mu.Lock()
	ta.threatRules = rules
	ta.mu.Unlock()
}

// loadBlacklist 加载黑名单
func (ta *ThreatAnalyzer) loadBlacklist() {
	// 从数据库加载黑名单
	// 这里简化处理
	ta.mu.Lock()
	ta.ipBlacklist = make(map[string]*BlacklistEntry)
	ta.mu.Unlock()
}

// recordSecurityEvent 记录安全事件
func (ass *AdvancedSecuritySystem) recordSecurityEvent(ctx context.Context, result *SecurityAnalysisResult) {
	event := &SecurityEvent{
		ID:          generateSecurityEventID(),
		Type:        "security_analysis",
		Severity:    determineSeverity(result.RiskScore),
		UserID:      result.UserID,
		IPAddress:   result.IPAddress,
		UserAgent:   result.UserAgent,
		Description: fmt.Sprintf("Security analysis detected threats: %v", result.Threats),
		Data: map[string]interface{}{
			"risk_score": result.RiskScore,
			"threats":    result.Threats,
			"actions":    result.Actions,
		},
		RiskScore: result.RiskScore,
		Status:    "new",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// 记录到审计日志
	if ass.auditService != nil {
		ass.auditService.LogSecurityEvent(
			event.Type,
			event.UserID,
			event.IPAddress,
			event.UserAgent,
			event.Data,
			event.Severity,
		)
	}

	glog.Warn(ctx, "security_event_recorded", gf.Map{
		"event_id":   event.ID,
		"type":       event.Type,
		"severity":   event.Severity,
		"risk_score": event.RiskScore,
		"user_id":    event.UserID,
		"ip_address": event.IPAddress,
	})
}

// startBackgroundTasks 启动后台任务
func (ass *AdvancedSecuritySystem) startBackgroundTasks() {
	// 定期更新用户行为模式
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				ass.updateBehaviorPatterns()
			}
		}
	}()

	// 定期生成安全报告
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				ass.generateDailySecurityReport()
			}
		}
	}()
}

// updateBehaviorPatterns 更新行为模式
func (ass *AdvancedSecuritySystem) updateBehaviorPatterns() {
	// 获取活跃用户列表
	var userIDs []string
	if err := ass.db.Model(&audit.AuditEvent{}).
		Where("created_at > ?", time.Now().AddDate(0, 0, -1)).
		Distinct("user_id").
		Pluck("user_id", &userIDs).Error; err != nil {
		return
	}

	// 更新每个用户的行为模式
	for _, userID := range userIDs {
		pattern, err := ass.anomalyDetector.analyzeBehaviorPattern(userID)
		if err != nil {
			continue
		}

		if pattern != nil {
			cacheKey := fmt.Sprintf("behavior_pattern:%s", userID)
			ass.cache.Set(cacheKey, pattern, 24*time.Hour)
		}
	}
}

// generateDailySecurityReport 生成每日安全报告
func (ass *AdvancedSecuritySystem) generateDailySecurityReport() {
	report, err := ass.securityReporter.GenerateDailyReport()
	if err != nil {
		glog.Error(context.Background(), "failed_to_generate_security_report", gf.Map{
			"error": err.Error(),
		})
		return
	}

	// 保存报告
	// 这里简化处理，实际应该保存到数据库

	glog.Info(context.Background(), "daily_security_report_generated", gf.Map{
		"report_id":       report.ID,
		"total_events":    report.Summary.TotalEvents,
		"critical_events": report.Summary.CriticalEvents,
	})
}

// GenerateDailyReport 生成每日报告
func (sr *SecurityReporter) GenerateDailyReport() (*SecurityReport, error) {
	yesterday := time.Now().AddDate(0, 0, -1)
	today := time.Now()

	// 查询安全事件
	var securityEvents []audit.SecurityEvent
	if err := sr.db.Where("created_at BETWEEN ? AND ?", yesterday, today).
		Find(&securityEvents).Error; err != nil {
		return nil, err
	}

	// 生成摘要
	summary := SecuritySummary{
		TotalEvents:      len(securityEvents),
		EventsByType:     make(map[string]int),
		EventsBySeverity: make(map[string]int),
	}

	for _, event := range securityEvents {
		summary.EventsByType[event.EventType]++
		summary.EventsBySeverity[event.Severity]++

		if event.Severity == "critical" {
			summary.CriticalEvents++
		}
	}

	// 生成威胁分析
	threatAnalysis := ThreatAnalysis{
		TrendAnalysis:       make(map[string]float64),
		GeographicAnalysis:  make(map[string]int),
		TimePatternAnalysis: make(map[string]int),
		RiskAssessment:      "low",
	}

	// 生成建议
	recommendations := []SecurityRecommendation{}
	if summary.CriticalEvents > 0 {
		recommendations = append(recommendations, SecurityRecommendation{
			Type:        "immediate_action",
			Priority:    "high",
			Description: "检测到严重安全事件，需要立即处理",
			Action:      "review_critical_events",
		})
	}

	report := &SecurityReport{
		ID:              generateReportID(),
		Type:            "daily",
		Period:          yesterday.Format("2006-01-02"),
		Summary:         summary,
		ThreatAnalysis:  threatAnalysis,
		Recommendations: recommendations,
		GeneratedAt:     time.Now(),
		GeneratedBy:     "system",
	}

	return report, nil
}

// 辅助函数
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func generateSecurityEventID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return "se_" + hex.EncodeToString(bytes)
}

func generateReportID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return "sr_" + hex.EncodeToString(bytes)
}

func determineSeverity(riskScore float64) string {
	if riskScore >= 0.8 {
		return "critical"
	} else if riskScore >= 0.6 {
		return "high"
	} else if riskScore >= 0.4 {
		return "medium"
	}
	return "low"
}

// RegisterSecurityRoutes 注册安全系统路由
func RegisterSecurityRoutes(r *gin.RouterGroup, system *AdvancedSecuritySystem) {
	security := r.Group("/security")
	{
		// 分析请求
		security.POST("/analyze", func(c *gin.Context) {
			var req struct {
				UserID      string                 `json:"user_id"`
				IPAddress   string                 `json:"ip_address"`
				UserAgent   string                 `json:"user_agent"`
				RequestData map[string]interface{} `json:"request_data"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(200, gin.H{
					"code":    1001,
					"message": "Invalid request body",
				})
				return
			}

			result, err := system.AnalyzeRequest(
				c.Request.Context(),
				req.UserID,
				req.IPAddress,
				req.UserAgent,
				req.RequestData,
			)
			if err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": result,
			})
		})

		// 获取用户行为模式
		security.GET("/behavior-pattern/:userID", func(c *gin.Context) {
			userID := c.Param("userID")

			pattern, err := system.anomalyDetector.getUserBehaviorPattern(userID)
			if err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": pattern,
			})
		})

		// 生成安全报告
		security.POST("/reports/generate", func(c *gin.Context) {
			report, err := system.securityReporter.GenerateDailyReport()
			if err != nil {
				c.JSON(200, gin.H{
					"code":    5001,
					"message": err.Error(),
				})
				return
			}

			c.JSON(200, gin.H{
				"code": 0,
				"data": report,
			})
		})
	}
}
