package websocket

import (
	"fmt"
	"log"
	"time"
)

// Service WebSocket服务
type Service struct {
	manager *Manager
}

// NewService 创建WebSocket服务
func NewService(manager *Manager) *Service {
	return &Service{
		manager: manager,
	}
}

// NotifyBatchGoStart 通知BatchGo任务开始
func (s *Service) NotifyBatchGoStart(userID, taskID string, totalURLs int) {
	if err := s.manager.SendTaskProgress(
		userID, taskID, "batchgo", "started", 0.0, totalURLs, 0, 0, "任务开始执行",
	); err != nil {
		log.Printf("Failed to send BatchGo start notification: %v", err)
	}
}

// NotifyBatchGoProgress 通知BatchGo任务进度
func (s *Service) NotifyBatchGoProgress(userID, taskID string, total, completed, failed int, message string) {
	progress := float64(completed+failed) / float64(total) * 100
	if err := s.manager.SendTaskProgress(
		userID, taskID, "batchgo", "running", progress, total, completed, failed, message,
	); err != nil {
		log.Printf("Failed to send BatchGo progress notification: %v", err)
	}
}

// NotifyBatchGoComplete 通知BatchGo任务完成
func (s *Service) NotifyBatchGoComplete(userID, taskID string, total, completed, failed int) {
	success := failed == 0
	message := fmt.Sprintf("任务完成，成功: %d, 失败: %d", completed, failed)

	if err := s.manager.SendTaskComplete(userID, taskID, "batchgo", success, message); err != nil {
		log.Printf("Failed to send BatchGo complete notification: %v", err)
	}
}

// NotifyBatchGoOpenURL 通知前端打开URL（Basic模式）
func (s *Service) NotifyBatchGoOpenURL(userID, taskID string, urls []string, delay int) {
	if err := s.manager.SendBatchGoOpenURL(userID, taskID, urls, delay); err != nil {
		log.Printf("Failed to send BatchGo open URL notification: %v", err)
	}
}

// NotifySiteRankStart 通知SiteRank任务开始
func (s *Service) NotifySiteRankStart(userID, taskID string, totalDomains int) {
	if err := s.manager.SendTaskProgress(
		userID, taskID, "siterank", "started", 0.0, totalDomains, 0, 0, "开始查询域名排名",
	); err != nil {
		log.Printf("Failed to send SiteRank start notification: %v", err)
	}
}

// NotifySiteRankProgress 通知SiteRank任务进度
func (s *Service) NotifySiteRankProgress(userID, taskID string, total, completed, failed int, message string) {
	progress := float64(completed+failed) / float64(total) * 100
	if err := s.manager.SendTaskProgress(
		userID, taskID, "siterank", "running", progress, total, completed, failed, message,
	); err != nil {
		log.Printf("Failed to send SiteRank progress notification: %v", err)
	}
}

// NotifySiteRankComplete 通知SiteRank任务完成
func (s *Service) NotifySiteRankComplete(userID, taskID string, total, completed, failed int) {
	success := failed == 0
	message := fmt.Sprintf("排名查询完成，成功: %d, 失败: %d", completed, failed)

	if err := s.manager.SendTaskComplete(userID, taskID, "siterank", success, message); err != nil {
		log.Printf("Failed to send SiteRank complete notification: %v", err)
	}
}

// NotifyAdsCenterStart 通知 AdsCenter 任务开始
func (s *Service) NotifyAdsCenterStart(userID, taskID string, totalLinks int) {
    if err := s.manager.SendTaskProgress(
        userID, taskID, "adscenter", "started", 0.0, totalLinks, 0, 0, "开始链接提取和广告更新",
    ); err != nil {
        log.Printf("Failed to send AdsCenter start notification: %v", err)
    }
}

// NotifyAdsCenterProgress 通知 AdsCenter 任务进度
func (s *Service) NotifyAdsCenterProgress(userID, taskID string, total, completed, failed int, message string) {
    progress := float64(completed+failed) / float64(total) * 100
    if err := s.manager.SendTaskProgress(
        userID, taskID, "adscenter", "running", progress, total, completed, failed, message,
    ); err != nil {
        log.Printf("Failed to send AdsCenter progress notification: %v", err)
    }
}

// NotifyAdsCenterComplete 通知 AdsCenter 任务完成
func (s *Service) NotifyAdsCenterComplete(userID, taskID string, total, completed, failed int) {
    success := failed == 0
    message := fmt.Sprintf("链接更新完成，成功: %d, 失败: %d", completed, failed)

    if err := s.manager.SendTaskComplete(userID, taskID, "adscenter", success, message); err != nil {
        log.Printf("Failed to send AdsCenter complete notification: %v", err)
    }
}

// NotifyTokenInsufficient 通知Token不足
func (s *Service) NotifyTokenInsufficient(userID string, currentBalance, requiredTokens int, taskType string) {
	if err := s.manager.SendTokenInsufficientNotification(userID, currentBalance, requiredTokens, taskType); err != nil {
		log.Printf("Failed to send token insufficient notification: %v", err)
	}
}

// NotifyPlanExpiring 通知套餐即将过期
func (s *Service) NotifyPlanExpiring(userID, planName string, daysLeft int, expiresAt time.Time) {
	if err := s.manager.SendPlanExpiringNotification(userID, planName, daysLeft, expiresAt.Unix()); err != nil {
		log.Printf("Failed to send plan expiring notification: %v", err)
	}
}

// NotifyPlanExpired 通知套餐已过期
func (s *Service) NotifyPlanExpired(userID, planName string, expiresAt time.Time) {
	if err := s.manager.SendPlanExpiringNotification(userID, planName, 0, expiresAt.Unix()); err != nil {
		log.Printf("Failed to send plan expired notification: %v", err)
	}
}

// SendToUser 发送消息给指定用户
func (s *Service) SendToUser(userID string, message interface{}) error {
	return s.manager.SendToUser(userID, message)
}

// NotifySystemMessage 发送系统消息
func (s *Service) NotifySystemMessage(userID, title, message, level string) {
	if err := s.manager.SendSystemNotification(userID, title, message, level); err != nil {
		log.Printf("Failed to send system notification: %v", err)
	}
}

// BroadcastSystemMessage 广播系统消息
func (s *Service) BroadcastSystemMessage(title, message, level string) {
	notification := SystemNotificationData{
		Title:   title,
		Message: message,
		Level:   level,
	}

	msg := Message{
		Type:      MessageTypeSystemNotification,
		Data:      notification,
		Timestamp: time.Now().Unix(),
	}

	if err := s.manager.Broadcast(msg); err != nil {
		log.Printf("Failed to broadcast system message: %v", err)
	}
}

// GetOnlineUsers 获取在线用户列表
func (s *Service) GetOnlineUsers() []string {
	return s.manager.GetConnectedUsers()
}

// GetConnectionCount 获取连接数量
func (s *Service) GetConnectionCount() int {
	return s.manager.GetConnectionCount()
}

// IsUserOnline 检查用户是否在线
func (s *Service) IsUserOnline(userID string) bool {
	return s.manager.IsUserOnline(userID)
}

// SendCustomMessage 发送自定义消息
func (s *Service) SendCustomMessage(userID, messageType string, data interface{}) {
	msg := Message{
		Type:      messageType,
		Data:      data,
		Timestamp: time.Now().Unix(),
	}

	if err := s.manager.SendToUser(userID, msg); err != nil {
		log.Printf("Failed to send custom message: %v", err)
	}
}

// BroadcastCustomMessage 广播自定义消息
func (s *Service) BroadcastCustomMessage(messageType string, data interface{}) {
	msg := Message{
		Type:      messageType,
		Data:      data,
		Timestamp: time.Now().Unix(),
	}

	if err := s.manager.Broadcast(msg); err != nil {
		log.Printf("Failed to broadcast custom message: %v", err)
	}
}
