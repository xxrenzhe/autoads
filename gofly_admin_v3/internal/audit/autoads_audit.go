package audit

import (
	"time"

	"gorm.io/gorm"
)

// AutoAds专用审计事件类型
const (
	// 用户操作
	ActionCreateBatchTask    = "create_batch_task"
	ActionExecuteBatchTask   = "execute_batch_task"
	ActionTerminateBatchTask = "terminate_batch_task"
	ActionQuerySiteRank      = "query_siterank"
	ActionCreateChengelink   = "create_chengelink"
	ActionExecuteChengelink  = "execute_chengelink"

	// Token操作
	ActionPurchaseTokens = "purchase_tokens"
	ActionConsumeTokens  = "consume_tokens"
	ActionRefundTokens   = "refund_tokens"

	// 邀请和签到
	ActionGenerateInvite = "generate_invite"
	ActionAcceptInvite   = "accept_invite"
	ActionDailyCheckin   = "daily_checkin"

	// 套餐操作
	ActionUpgradePlan   = "upgrade_plan"
	ActionDowngradePlan = "downgrade_plan"
	ActionRenewPlan     = "renew_plan"

	// 管理员操作
	ActionAdminUserManage   = "admin_user_manage"
	ActionAdminTokenManage  = "admin_token_manage"
	ActionAdminPlanManage   = "admin_plan_manage"
	ActionAdminSystemConfig = "admin_system_config"
)

// AutoAds专用安全事件类型
const (
	SecurityEventTokenAbuse       = "token_abuse"
	SecurityEventAPIRateLimit     = "api_rate_limit"
	SecurityEventSuspiciousTask   = "suspicious_task"
	SecurityEventUnauthorizedAPI  = "unauthorized_api"
	SecurityEventDataExfiltration = "data_exfiltration"
	SecurityEventAccountTakeover  = "account_takeover"
)

// AutoAdsAuditService AutoAds专用审计服务
type AutoAdsAuditService struct {
	*AuditService
}

// NewAutoAdsAuditService 创建AutoAds审计服务
func NewAutoAdsAuditService(db *gorm.DB) *AutoAdsAuditService {
	return &AutoAdsAuditService{
		AuditService: NewAuditService(db),
	}
}

// LogBatchTaskAction 记录BatchGo任务操作
func (aas *AutoAdsAuditService) LogBatchTaskAction(userID, action, taskID string, taskDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string, duration time.Duration) error {
	return aas.LogUserAction(userID, action, "batch_task", taskID, taskDetails, ipAddress, userAgent, success, errorMsg, duration)
}

// LogSiteRankQuery 记录SiteRank查询
func (aas *AutoAdsAuditService) LogSiteRankQuery(userID, domain string, queryDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string, duration time.Duration) error {
	details := map[string]interface{}{
		"domain": domain,
	}
	for k, v := range queryDetails {
		details[k] = v
	}

	return aas.LogUserAction(userID, ActionQuerySiteRank, "siterank_query", domain, details, ipAddress, userAgent, success, errorMsg, duration)
}

// LogChengeLinkAction 记录Chengelink操作
func (aas *AutoAdsAuditService) LogChengeLinkAction(userID, action, taskID string, linkDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string, duration time.Duration) error {
	return aas.LogUserAction(userID, action, "chengelink_task", taskID, linkDetails, ipAddress, userAgent, success, errorMsg, duration)
}

// LogTokenTransaction 记录Token交易
func (aas *AutoAdsAuditService) LogTokenTransaction(userID, action string, amount int, balance int, transactionDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string) error {
	details := map[string]interface{}{
		"amount":  amount,
		"balance": balance,
	}
	for k, v := range transactionDetails {
		details[k] = v
	}

	return aas.LogUserAction(userID, action, "token_transaction", "", details, ipAddress, userAgent, success, errorMsg, 0)
}

// LogInvitationAction 记录邀请操作
func (aas *AutoAdsAuditService) LogInvitationAction(userID, action string, inviteDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string) error {
	return aas.LogUserAction(userID, action, "invitation", "", inviteDetails, ipAddress, userAgent, success, errorMsg, 0)
}

// LogPlanAction 记录套餐操作
func (aas *AutoAdsAuditService) LogPlanAction(userID, action string, planDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string) error {
	return aas.LogUserAction(userID, action, "plan", "", planDetails, ipAddress, userAgent, success, errorMsg, 0)
}

// LogAdminAction 记录管理员操作
func (aas *AutoAdsAuditService) LogAdminAction(adminID, action, resource, resourceID string, actionDetails map[string]interface{}, ipAddress, userAgent string, success bool, errorMsg string) error {
	details := map[string]interface{}{
		"admin_action": true,
	}
	for k, v := range actionDetails {
		details[k] = v
	}

	return aas.LogUserAction(adminID, action, resource, resourceID, details, ipAddress, userAgent, success, errorMsg, 0)
}

// LogSecurityIncident 记录安全事件
func (aas *AutoAdsAuditService) LogSecurityIncident(eventType, userID, ipAddress, userAgent string, incidentDetails map[string]interface{}, severity string) error {
	return aas.LogSecurityEvent(eventType, userID, ipAddress, userAgent, incidentDetails, severity)
}

// GetUserActivitySummary 获取用户活动摘要
func (aas *AutoAdsAuditService) GetUserActivitySummary(userID string, days int) (map[string]interface{}, error) {
	since := time.Now().AddDate(0, 0, -days)

	summary := make(map[string]interface{})

	// 获取操作统计
	actionStats, err := aas.GetUserActionStats(userID, days)
	if err != nil {
		return nil, err
	}
	summary["action_stats"] = actionStats

	// 获取最近活动
	recentEvents, _, err := aas.GetAuditEvents(userID, 10, 0)
	if err != nil {
		return nil, err
	}
	summary["recent_events"] = recentEvents

	// 计算活跃度分数
	var totalActions int64
	for _, count := range actionStats {
		totalActions += count
	}
	summary["activity_score"] = aas.calculateActivityScore(totalActions, days)

	// 获取Token使用统计
	tokenStats := aas.getTokenUsageStats(userID, since)
	summary["token_usage"] = tokenStats

	// 获取任务执行统计
	taskStats := aas.getTaskExecutionStats(userID, since)
	summary["task_stats"] = taskStats

	return summary, nil
}

// GetSystemSecurityReport 获取系统安全报告
func (aas *AutoAdsAuditService) GetSystemSecurityReport(days int) (map[string]interface{}, error) {
	since := time.Now().AddDate(0, 0, -days)

	report := make(map[string]interface{})

	// 获取基础安全统计
	securityStats, err := aas.GetSecurityStats(days)
	if err != nil {
		return nil, err
	}
	report["security_stats"] = securityStats

	// 获取风险IP
	riskyIPs, err := aas.GetTopRiskyIPs(days, 10)
	if err != nil {
		return nil, err
	}
	report["risky_ips"] = riskyIPs

	// 获取异常用户活动
	suspiciousUsers := aas.getSuspiciousUsers(since)
	report["suspicious_users"] = suspiciousUsers

	// 获取API滥用统计
	apiAbuseStats := aas.getAPIAbuseStats(since)
	report["api_abuse"] = apiAbuseStats

	// 计算安全评分
	report["security_score"] = aas.calculateSecurityScore(securityStats, riskyIPs, suspiciousUsers)

	return report, nil
}

// GetComplianceReport 获取合规报告
func (aas *AutoAdsAuditService) GetComplianceReport(startDate, endDate time.Time) (map[string]interface{}, error) {
	report := make(map[string]interface{})

	// 数据访问记录
	dataAccessEvents := aas.getDataAccessEvents(startDate, endDate)
	report["data_access"] = dataAccessEvents

	// 用户权限变更记录
	permissionChanges := aas.getPermissionChanges(startDate, endDate)
	report["permission_changes"] = permissionChanges

	// 数据导出记录
	dataExports := aas.getDataExportEvents(startDate, endDate)
	report["data_exports"] = dataExports

	// 管理员操作记录
	adminActions := aas.getAdminActions(startDate, endDate)
	report["admin_actions"] = adminActions

	// 合规性检查结果
	complianceChecks := aas.runComplianceChecks(startDate, endDate)
	report["compliance_checks"] = complianceChecks

	return report, nil
}

// DetectAnomalousActivity 检测异常活动
func (aas *AutoAdsAuditService) DetectAnomalousActivity(userID string) ([]map[string]interface{}, error) {
	var anomalies []map[string]interface{}

	// 检测异常登录模式
	loginAnomalies := aas.detectLoginAnomalies(userID)
	anomalies = append(anomalies, loginAnomalies...)

	// 检测异常API使用
	apiAnomalies := aas.detectAPIAnomalies(userID)
	anomalies = append(anomalies, apiAnomalies...)

	// 检测异常Token消费
	tokenAnomalies := aas.detectTokenAnomalies(userID)
	anomalies = append(anomalies, tokenAnomalies...)

	// 检测异常任务模式
	taskAnomalies := aas.detectTaskAnomalies(userID)
	anomalies = append(anomalies, taskAnomalies...)

	return anomalies, nil
}

// 辅助方法

func (aas *AutoAdsAuditService) calculateActivityScore(totalActions int64, days int) float64 {
	if days == 0 {
		return 0
	}

	avgActionsPerDay := float64(totalActions) / float64(days)

	// 简单的活跃度评分算法
	switch {
	case avgActionsPerDay >= 50:
		return 100.0
	case avgActionsPerDay >= 20:
		return 80.0
	case avgActionsPerDay >= 10:
		return 60.0
	case avgActionsPerDay >= 5:
		return 40.0
	case avgActionsPerDay >= 1:
		return 20.0
	default:
		return 0.0
	}
}

func (aas *AutoAdsAuditService) getTokenUsageStats(userID string, since time.Time) map[string]interface{} {
	// TODO: 实现Token使用统计查询
	return map[string]interface{}{
		"total_consumed":    1000,
		"total_purchased":   2000,
		"avg_daily_usage":   33,
		"most_used_feature": "BatchGo",
	}
}

func (aas *AutoAdsAuditService) getTaskExecutionStats(userID string, since time.Time) map[string]interface{} {
	// TODO: 实现任务执行统计查询
	return map[string]interface{}{
		"total_tasks":      50,
		"successful_tasks": 45,
		"failed_tasks":     5,
		"success_rate":     90.0,
	}
}

func (aas *AutoAdsAuditService) getSuspiciousUsers(since time.Time) []map[string]interface{} {
	// TODO: 实现可疑用户检测
	return []map[string]interface{}{
		{
			"user_id":    "user123",
			"risk_score": 85,
			"reasons":    []string{"high_api_usage", "unusual_login_pattern"},
			"last_seen":  time.Now().Add(-2 * time.Hour),
		},
	}
}

func (aas *AutoAdsAuditService) getAPIAbuseStats(since time.Time) map[string]interface{} {
	// TODO: 实现API滥用统计
	return map[string]interface{}{
		"rate_limit_violations": 25,
		"blocked_requests":      100,
		"top_abusers":           []string{"192.168.1.100", "10.0.0.50"},
	}
}

func (aas *AutoAdsAuditService) calculateSecurityScore(securityStats map[string]interface{}, riskyIPs []map[string]interface{}, suspiciousUsers []map[string]interface{}) float64 {
	// 简单的安全评分算法
	baseScore := 100.0

	// 根据安全事件数量扣分
	if eventTypes, ok := securityStats["event_types"].(map[string]int64); ok {
		var totalEvents int64
		for _, count := range eventTypes {
			totalEvents += count
		}
		baseScore -= float64(totalEvents) * 0.5
	}

	// 根据风险IP数量扣分
	baseScore -= float64(len(riskyIPs)) * 2.0

	// 根据可疑用户数量扣分
	baseScore -= float64(len(suspiciousUsers)) * 5.0

	if baseScore < 0 {
		baseScore = 0
	}

	return baseScore
}

func (aas *AutoAdsAuditService) getDataAccessEvents(startDate, endDate time.Time) []map[string]interface{} {
	// TODO: 实现数据访问事件查询
	return []map[string]interface{}{
		{
			"user_id":    "admin1",
			"resource":   "user_data",
			"action":     "export",
			"timestamp":  time.Now(),
			"ip_address": "192.168.1.1",
		},
	}
}

func (aas *AutoAdsAuditService) getPermissionChanges(startDate, endDate time.Time) []map[string]interface{} {
	// TODO: 实现权限变更记录查询
	return []map[string]interface{}{
		{
			"admin_id":    "admin1",
			"target_user": "user123",
			"old_role":    "user",
			"new_role":    "pro_user",
			"timestamp":   time.Now(),
		},
	}
}

func (aas *AutoAdsAuditService) getDataExportEvents(startDate, endDate time.Time) []map[string]interface{} {
	// TODO: 实现数据导出事件查询
	return []map[string]interface{}{
		{
			"user_id":     "user123",
			"export_type": "task_results",
			"file_size":   "2.5MB",
			"timestamp":   time.Now(),
		},
	}
}

func (aas *AutoAdsAuditService) getAdminActions(startDate, endDate time.Time) []map[string]interface{} {
	// TODO: 实现管理员操作记录查询
	return []map[string]interface{}{
		{
			"admin_id":  "admin1",
			"action":    "user_suspend",
			"target":    "user456",
			"reason":    "policy_violation",
			"timestamp": time.Now(),
		},
	}
}

func (aas *AutoAdsAuditService) runComplianceChecks(startDate, endDate time.Time) map[string]interface{} {
	// TODO: 实现合规性检查
	return map[string]interface{}{
		"data_retention_check": "passed",
		"access_control_check": "passed",
		"audit_log_integrity":  "passed",
		"encryption_check":     "passed",
		"backup_verification":  "passed",
		"compliance_score":     95.0,
	}
}

func (aas *AutoAdsAuditService) detectLoginAnomalies(userID string) []map[string]interface{} {
	// TODO: 实现登录异常检测
	return []map[string]interface{}{
		{
			"type":        "unusual_location",
			"description": "Login from new geographic location",
			"severity":    "medium",
			"timestamp":   time.Now(),
		},
	}
}

func (aas *AutoAdsAuditService) detectAPIAnomalies(userID string) []map[string]interface{} {
	// TODO: 实现API异常检测
	return []map[string]interface{}{
		{
			"type":        "high_frequency_requests",
			"description": "Unusually high API request frequency",
			"severity":    "high",
			"timestamp":   time.Now(),
		},
	}
}

func (aas *AutoAdsAuditService) detectTokenAnomalies(userID string) []map[string]interface{} {
	// TODO: 实现Token异常检测
	return []map[string]interface{}{
		{
			"type":        "rapid_token_consumption",
			"description": "Tokens consumed faster than usual",
			"severity":    "medium",
			"timestamp":   time.Now(),
		},
	}
}

func (aas *AutoAdsAuditService) detectTaskAnomalies(userID string) []map[string]interface{} {
	// TODO: 实现任务异常检测
	return []map[string]interface{}{
		{
			"type":        "unusual_task_pattern",
			"description": "Task execution pattern differs from normal behavior",
			"severity":    "low",
			"timestamp":   time.Now(),
		},
	}
}
