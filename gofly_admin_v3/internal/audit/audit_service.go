package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gofly-admin-v3/utils/gf"
	"gorm.io/gorm"
)

// Audit actions
const (
	ActionExecute = "execute"
	ActionCreate  = "create"
	ActionUpdate  = "update"
	ActionDelete  = "delete"
	ActionRead    = "read"
	ActionLogin   = "login"
	ActionLogout  = "logout"
)

// Audit resources
const (
	ResourceTask   = "task"
	ResourceUser   = "user"
	ResourceSystem = "system"
	ResourceConfig = "config"
	ResourceAPI    = "api"
)

var defaultAuditService *AuditService

// InitDefaultAuditService 初始化默认审计服务
func InitDefaultAuditService(db *gorm.DB) {
	defaultAuditService = NewAuditService(db)
}

// LogUserAction 记录用户操作
func LogUserAction(userID, action, resource, resourceID string, details interface{}, ipAddress, userAgent string, success bool, errorMsg string, duration time.Duration) {
	if defaultAuditService != nil {
		defaultAuditService.LogUserAction(userID, action, resource, resourceID, details, ipAddress, userAgent, success, errorMsg, duration)
	}
}

// LogError 记录错误
func LogError(ctx context.Context, component string, err error, details gf.Map) {
	if defaultAuditService != nil {
		errorDetails := gf.Map{
			"error":     err.Error(),
			"component": component,
			"details":   details,
		}
		defaultAuditService.LogUserAction(
			"system",
			"error",
			component,
			"",
			errorDetails,
			"",
			"",
			false,
			err.Error(),
			0,
		)
	}
}

// AuditEvent 审计事件
type AuditEvent struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"user_id" gorm:"index"`
	Action     string    `json:"action" gorm:"index"`
	Resource   string    `json:"resource" gorm:"index"`
	ResourceID string    `json:"resource_id"`
	Details    string    `json:"details" gorm:"type:text"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	Success    bool      `json:"success" gorm:"index"`
	ErrorMsg   string    `json:"error_message"`
	Duration   int64     `json:"duration"` // 毫秒
	CreatedAt  time.Time `json:"created_at" gorm:"index"`
}

// SecurityEvent 安全事件
type SecurityEvent struct {
	ID         uint       `json:"id" gorm:"primaryKey"`
	EventType  string     `json:"event_type" gorm:"index"` // login_failed, suspicious_activity, rate_limit_exceeded
	UserID     string     `json:"user_id" gorm:"index"`
	IPAddress  string     `json:"ip_address" gorm:"index"`
	UserAgent  string     `json:"user_agent"`
	Details    string     `json:"details" gorm:"type:text"`
	Severity   string     `json:"severity" gorm:"index"` // low, medium, high, critical
	Resolved   bool       `json:"resolved" gorm:"index"`
	ResolvedAt *time.Time `json:"resolved_at"`
	ResolvedBy string     `json:"resolved_by"`
	CreatedAt  time.Time  `json:"created_at" gorm:"index"`
}

// AuditService 审计服务
type AuditService struct {
	db *gorm.DB
}

// NewAuditService 创建审计服务
func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

// LogUserAction 记录用户操作
func (a *AuditService) LogUserAction(userID, action, resource, resourceID string, details interface{}, ipAddress, userAgent string, success bool, errorMsg string, duration time.Duration) error {
	detailsJSON, _ := json.Marshal(details)

	event := AuditEvent{
		UserID:     userID,
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		Details:    string(detailsJSON),
		IPAddress:  ipAddress,
		UserAgent:  userAgent,
		Success:    success,
		ErrorMsg:   errorMsg,
		Duration:   duration.Milliseconds(),
		CreatedAt:  time.Now(),
	}

	return a.db.Create(&event).Error
}

// LogSecurityEvent 记录安全事件
func (a *AuditService) LogSecurityEvent(eventType, userID, ipAddress, userAgent string, details interface{}, severity string) error {
	detailsJSON, _ := json.Marshal(details)

	event := SecurityEvent{
		EventType: eventType,
		UserID:    userID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		Details:   string(detailsJSON),
		Severity:  severity,
		Resolved:  false,
		CreatedAt: time.Now(),
	}

	return a.db.Create(&event).Error
}

// GetAuditEvents 获取审计事件
func (a *AuditService) GetAuditEvents(userID string, limit, offset int) ([]AuditEvent, int64, error) {
	var events []AuditEvent
	var total int64

	query := a.db.Model(&AuditEvent{})
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&events).Error

	return events, total, err
}

// GetSecurityEvents 获取安全事件
func (a *AuditService) GetSecurityEvents(severity string, resolved *bool, limit, offset int) ([]SecurityEvent, int64, error) {
	var events []SecurityEvent
	var total int64

	query := a.db.Model(&SecurityEvent{})
	if severity != "" {
		query = query.Where("severity = ?", severity)
	}
	if resolved != nil {
		query = query.Where("resolved = ?", *resolved)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&events).Error

	return events, total, err
}

// ResolveSecurityEvent 解决安全事件
func (a *AuditService) ResolveSecurityEvent(eventID uint, resolvedBy string) error {
	now := time.Now()
	return a.db.Model(&SecurityEvent{}).
		Where("id = ?", eventID).
		Updates(map[string]interface{}{
			"resolved":    true,
			"resolved_at": &now,
			"resolved_by": resolvedBy,
		}).Error
}

// GetUserActionStats 获取用户操作统计
func (a *AuditService) GetUserActionStats(userID string, days int) (map[string]int64, error) {
	var results []struct {
		Action string
		Count  int64
	}

	since := time.Now().AddDate(0, 0, -days)
	err := a.db.Model(&AuditEvent{}).
		Select("action, COUNT(*) as count").
		Where("user_id = ? AND created_at > ?", userID, since).
		Group("action").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	stats := make(map[string]int64)
	for _, result := range results {
		stats[result.Action] = result.Count
	}

	return stats, nil
}

// GetSecurityStats 获取安全统计
func (a *AuditService) GetSecurityStats(days int) (map[string]interface{}, error) {
	since := time.Now().AddDate(0, 0, -days)

	stats := make(map[string]interface{})

	// 按事件类型统计
	var eventTypeStats []struct {
		EventType string
		Count     int64
	}
	err := a.db.Model(&SecurityEvent{}).
		Select("event_type, COUNT(*) as count").
		Where("created_at > ?", since).
		Group("event_type").
		Scan(&eventTypeStats).Error
	if err != nil {
		return nil, err
	}

	eventTypes := make(map[string]int64)
	for _, stat := range eventTypeStats {
		eventTypes[stat.EventType] = stat.Count
	}
	stats["event_types"] = eventTypes

	// 按严重程度统计
	var severityStats []struct {
		Severity string
		Count    int64
	}
	err = a.db.Model(&SecurityEvent{}).
		Select("severity, COUNT(*) as count").
		Where("created_at > ?", since).
		Group("severity").
		Scan(&severityStats).Error
	if err != nil {
		return nil, err
	}

	severities := make(map[string]int64)
	for _, stat := range severityStats {
		severities[stat.Severity] = stat.Count
	}
	stats["severities"] = severities

	// 未解决事件数
	var unresolvedCount int64
	err = a.db.Model(&SecurityEvent{}).
		Where("resolved = ? AND created_at > ?", false, since).
		Count(&unresolvedCount).Error
	if err != nil {
		return nil, err
	}
	stats["unresolved_count"] = unresolvedCount

	return stats, nil
}

// GetTopRiskyIPs 获取风险IP地址
func (a *AuditService) GetTopRiskyIPs(days int, limit int) ([]map[string]interface{}, error) {
	since := time.Now().AddDate(0, 0, -days)

	var results []struct {
		IPAddress  string
		EventCount int64
		LastEvent  time.Time
		Severities string
	}

	err := a.db.Model(&SecurityEvent{}).
		Select("ip_address, COUNT(*) as event_count, MAX(created_at) as last_event, GROUP_CONCAT(DISTINCT severity) as severities").
		Where("created_at > ?", since).
		Group("ip_address").
		Having("event_count > 1").
		Order("event_count DESC").
		Limit(limit).
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	var riskyIPs []map[string]interface{}
	for _, result := range results {
		riskyIPs = append(riskyIPs, map[string]interface{}{
			"ip_address":  result.IPAddress,
			"event_count": result.EventCount,
			"last_event":  result.LastEvent,
			"severities":  result.Severities,
		})
	}

	return riskyIPs, nil
}

// CleanupOldEvents 清理旧事件
func (a *AuditService) CleanupOldEvents(auditDays, securityDays int) error {
	// 清理旧的审计事件
	auditCutoff := time.Now().AddDate(0, 0, -auditDays)
	if err := a.db.Where("created_at < ?", auditCutoff).Delete(&AuditEvent{}).Error; err != nil {
		return fmt.Errorf("failed to cleanup audit events: %w", err)
	}

	// 清理旧的安全事件（只清理已解决的）
	securityCutoff := time.Now().AddDate(0, 0, -securityDays)
	if err := a.db.Where("created_at < ? AND resolved = ?", securityCutoff, true).Delete(&SecurityEvent{}).Error; err != nil {
		return fmt.Errorf("failed to cleanup security events: %w", err)
	}

	return nil
}

// 预定义的操作类型
const (
	ActionCreateTask     = "create_task"
	ActionUpdateTask     = "update_task"
	ActionDeleteTask     = "delete_task"
	ActionConsumeToken   = "consume_token"
	ActionRechargeToken  = "recharge_token"
	ActionUpdateProfile  = "update_profile"
	ActionChangePassword = "change_password"
	ActionInviteUser     = "invite_user"
	ActionCheckin        = "checkin"
)

// 预定义的安全事件类型
const (
	SecurityEventLoginFailed        = "login_failed"
	SecurityEventSuspiciousActivity = "suspicious_activity"
	SecurityEventRateLimitExceeded  = "rate_limit_exceeded"
	SecurityEventUnauthorizedAccess = "unauthorized_access"
	SecurityEventDataBreach         = "data_breach"
	SecurityEventMaliciousRequest   = "malicious_request"
)

// 预定义的严重程度
const (
	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)
