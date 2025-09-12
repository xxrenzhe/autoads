package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Manager WebSocket管理器
type Manager struct {
	clients    map[string]*Client // userID -> Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	mutex      sync.RWMutex
}

// Client WebSocket客户端
type Client struct {
	ID       string
	UserID   string
	Conn     *websocket.Conn
	Send     chan []byte
	Manager  *Manager
	LastPing time.Time
	IsActive bool
}

// Message WebSocket消息
type Message struct {
	Type      string      `json:"type"`
	UserID    string      `json:"user_id,omitempty"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
	MessageID string      `json:"message_id,omitempty"`
}

// MessageType 消息类型常量
const (
	// BatchGo相关
	MessageTypeBatchGoStart    = "batchgo_start"
	MessageTypeBatchGoProgress = "batchgo_progress"
	MessageTypeBatchGoComplete = "batchgo_complete"
	MessageTypeBatchGoOpenURL  = "batchgo_open_url"

	// SiteRank相关
	MessageTypeSiteRankStart    = "siterank_start"
	MessageTypeSiteRankProgress = "siterank_progress"
	MessageTypeSiteRankComplete = "siterank_complete"

	// Chengelink相关
	MessageTypeChengeLinkStart    = "chengelink_start"
	MessageTypeChengeLinkProgress = "chengelink_progress"
	MessageTypeChengeLinkComplete = "chengelink_complete"

	// 系统通知
	MessageTypeSystemNotification = "system_notification"
	MessageTypeTokenInsufficient  = "token_insufficient"
	MessageTypePlanExpiring       = "plan_expiring"
	MessageTypePlanExpired        = "plan_expired"

	// 连接管理
	MessageTypePing         = "ping"
	MessageTypePong         = "pong"
	MessageTypeConnected    = "connected"
	MessageTypeDisconnected = "disconnected"
	MessageTypeError        = "error"
)

// BatchGoOpenURLData BatchGo打开URL数据
type BatchGoOpenURLData struct {
	TaskID string   `json:"task_id"`
	URLs   []string `json:"urls"`
	Delay  int      `json:"delay"` // 延迟时间（毫秒）
}

// TaskProgressData 任务进度数据
type TaskProgressData struct {
	TaskID    string  `json:"task_id"`
	TaskType  string  `json:"task_type"`
	Status    string  `json:"status"`
	Progress  float64 `json:"progress"`
	Total     int     `json:"total"`
	Completed int     `json:"completed"`
	Failed    int     `json:"failed"`
	Message   string  `json:"message,omitempty"`
	StartTime int64   `json:"start_time,omitempty"`
	EndTime   int64   `json:"end_time,omitempty"`
}

// SystemNotificationData 系统通知数据
type SystemNotificationData struct {
	Title     string `json:"title"`
	Message   string `json:"message"`
	Level     string `json:"level"` // info, warning, error, success
	Action    string `json:"action,omitempty"`
	ActionURL string `json:"action_url,omitempty"`
}

// TokenInsufficientData Token不足通知数据
type TokenInsufficientData struct {
	CurrentBalance int    `json:"current_balance"`
	RequiredTokens int    `json:"required_tokens"`
	TaskType       string `json:"task_type"`
	Message        string `json:"message"`
}

// PlanExpiringData 套餐过期通知数据
type PlanExpiringData struct {
	PlanName   string `json:"plan_name"`
	DaysLeft   int    `json:"days_left"`
	ExpiresAt  int64  `json:"expires_at"`
	Message    string `json:"message"`
	UpgradeURL string `json:"upgrade_url,omitempty"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许跨域，生产环境需要更严格的检查
	},
}

// NewManager 创建WebSocket管理器
func NewManager() *Manager {
	manager := &Manager{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte),
	}

	// 启动心跳检查
	go manager.startHeartbeat()

	return manager
}

// startHeartbeat 启动心跳检查
func (m *Manager) startHeartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.checkClientHealth()
		}
	}
}

// checkClientHealth 检查客户端健康状态
func (m *Manager) checkClientHealth() {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	now := time.Now()
	for userID, client := range m.clients {
		// 如果超过60秒没有收到ping，认为连接已断开
		if now.Sub(client.LastPing) > 60*time.Second {
			log.Printf("Client %s heartbeat timeout, removing", userID)
			close(client.Send)
			delete(m.clients, userID)
		}
	}
}

// Run 运行WebSocket管理器
func (m *Manager) Run() {
	for {
		select {
		case client := <-m.register:
			m.mutex.Lock()
			m.clients[client.UserID] = client
			m.mutex.Unlock()
			log.Printf("WebSocket client connected: %s", client.UserID)

		case client := <-m.unregister:
			m.mutex.Lock()
			if _, ok := m.clients[client.UserID]; ok {
				delete(m.clients, client.UserID)
				close(client.Send)
			}
			m.mutex.Unlock()
			log.Printf("WebSocket client disconnected: %s", client.UserID)

		case message := <-m.broadcast:
			m.mutex.RLock()
			for _, client := range m.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(m.clients, client.UserID)
				}
			}
			m.mutex.RUnlock()
		}
	}
}

// HandleWebSocket 处理WebSocket连接
func (m *Manager) HandleWebSocket(ctx *gin.Context) {
	// 获取用户ID
	userID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
		})
		return
	}

	// 升级连接
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// 创建客户端
	client := &Client{
		ID:       generateClientID(),
		UserID:   userID.(string),
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Manager:  m,
		LastPing: time.Now(),
		IsActive: true,
	}

	// 注册客户端
	m.register <- client

	// 启动读写协程
	go client.writePump()
	go client.readPump()
}

// SendToUser 发送消息给指定用户
func (m *Manager) SendToUser(userID string, message interface{}) error {
	m.mutex.RLock()
	client, exists := m.clients[userID]
	m.mutex.RUnlock()

	if !exists {
		return nil // 用户不在线，忽略消息
	}

	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	select {
	case client.Send <- data:
		return nil
	default:
		// 发送缓冲区满，关闭连接
		m.unregister <- client
		return nil
	}
}

// BroadcastToUser 广播消息给指定用户（别名）
func (m *Manager) BroadcastToUser(userID string, message interface{}) error {
	return m.SendToUser(userID, message)
}

// Broadcast 广播消息给所有用户
func (m *Manager) Broadcast(message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	m.broadcast <- data
	return nil
}

// readPump 读取消息
func (c *Client) readPump() {
	defer func() {
		c.Manager.unregister <- c
		c.Conn.Close()
	}()

	// 设置读取超时
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.LastPing = time.Now()
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		messageType, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// 处理接收到的消息
		if messageType == websocket.TextMessage {
			c.handleMessage(message)
		}

		// 更新最后活动时间
		c.LastPing = time.Now()
	}
}

// handleMessage 处理接收到的消息
func (c *Client) handleMessage(message []byte) {
	var msg Message
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Failed to unmarshal message: %v", err)
		return
	}

	switch msg.Type {
	case MessageTypePing:
		// 响应ping消息
		pongMsg := Message{
			Type:      MessageTypePong,
			Timestamp: time.Now().Unix(),
		}
		c.sendMessage(pongMsg)

	case "client_ready":
		// 客户端准备就绪
		log.Printf("Client %s is ready", c.UserID)

	default:
		log.Printf("Unknown message type: %s from user %s", msg.Type, c.UserID)
	}
}

// sendMessage 发送消息给客户端
func (c *Client) sendMessage(message Message) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	select {
	case c.Send <- data:
		return nil
	default:
		return nil
	}
}

// writePump 发送消息
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second) // 心跳间隔
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Failed to write message: %v", err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Failed to write ping: %v", err)
				return
			}
		}
	}
}

// SendBatchGoOpenURL 发送BatchGo打开URL指令
func (m *Manager) SendBatchGoOpenURL(userID, taskID string, urls []string, delay int) error {
	message := Message{
		Type: MessageTypeBatchGoOpenURL,
		Data: BatchGoOpenURLData{
			TaskID: taskID,
			URLs:   urls,
			Delay:  delay,
		},
		Timestamp: time.Now().Unix(),
		MessageID: uuid.New().String(),
	}

	return m.SendToUser(userID, message)
}

// SendTaskProgress 发送任务进度更新
func (m *Manager) SendTaskProgress(userID, taskID, taskType, status string, progress float64, total, completed, failed int, message string) error {
	progressData := TaskProgressData{
		TaskID:    taskID,
		TaskType:  taskType,
		Status:    status,
		Progress:  progress,
		Total:     total,
		Completed: completed,
		Failed:    failed,
		Message:   message,
	}

	var messageType string
	switch taskType {
	case "batchgo":
		messageType = MessageTypeBatchGoProgress
	case "siterank":
		messageType = MessageTypeSiteRankProgress
	case "chengelink":
		messageType = MessageTypeChengeLinkProgress
	default:
		messageType = "task_progress"
	}

	msg := Message{
		Type:      messageType,
		Data:      progressData,
		Timestamp: time.Now().Unix(),
		MessageID: uuid.New().String(),
	}

	return m.SendToUser(userID, msg)
}

// SendTaskComplete 发送任务完成通知
func (m *Manager) SendTaskComplete(userID, taskID, taskType string, success bool, message string) error {
	progressData := TaskProgressData{
		TaskID:   taskID,
		TaskType: taskType,
		Status:   "completed",
		Progress: 100.0,
		Message:  message,
		EndTime:  time.Now().Unix(),
	}

	var messageType string
	switch taskType {
	case "batchgo":
		messageType = MessageTypeBatchGoComplete
	case "siterank":
		messageType = MessageTypeSiteRankComplete
	case "chengelink":
		messageType = MessageTypeChengeLinkComplete
	default:
		messageType = "task_complete"
	}

	msg := Message{
		Type:      messageType,
		Data:      progressData,
		Timestamp: time.Now().Unix(),
		MessageID: uuid.New().String(),
	}

	return m.SendToUser(userID, msg)
}

// SendSystemNotification 发送系统通知
func (m *Manager) SendSystemNotification(userID, title, message, level string) error {
	notificationData := SystemNotificationData{
		Title:   title,
		Message: message,
		Level:   level,
	}

	msg := Message{
		Type:      MessageTypeSystemNotification,
		Data:      notificationData,
		Timestamp: time.Now().Unix(),
		MessageID: uuid.New().String(),
	}

	return m.SendToUser(userID, msg)
}

// SendTokenInsufficientNotification 发送Token不足通知
func (m *Manager) SendTokenInsufficientNotification(userID string, currentBalance, requiredTokens int, taskType string) error {
	tokenData := TokenInsufficientData{
		CurrentBalance: currentBalance,
		RequiredTokens: requiredTokens,
		TaskType:       taskType,
		Message:        "Token余额不足，请充值后继续使用",
	}

	msg := Message{
		Type:      MessageTypeTokenInsufficient,
		Data:      tokenData,
		Timestamp: time.Now().Unix(),
		MessageID: uuid.New().String(),
	}

	return m.SendToUser(userID, msg)
}

// SendPlanExpiringNotification 发送套餐过期通知
func (m *Manager) SendPlanExpiringNotification(userID, planName string, daysLeft int, expiresAt int64) error {
	planData := PlanExpiringData{
		PlanName:   planName,
		DaysLeft:   daysLeft,
		ExpiresAt:  expiresAt,
		Message:    "您的套餐即将过期，请及时续费",
		UpgradeURL: "/dashboard/subscription",
	}

	var messageType string
	if daysLeft <= 0 {
		messageType = MessageTypePlanExpired
		planData.Message = "您的套餐已过期，请续费后继续使用"
	} else {
		messageType = MessageTypePlanExpiring
	}

	msg := Message{
		Type:      messageType,
		Data:      planData,
		Timestamp: time.Now().Unix(),
		MessageID: uuid.New().String(),
	}

	return m.SendToUser(userID, msg)
}

// GetConnectedUsers 获取在线用户列表
func (m *Manager) GetConnectedUsers() []string {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	users := make([]string, 0, len(m.clients))
	for userID := range m.clients {
		users = append(users, userID)
	}

	return users
}

// GetConnectionCount 获取连接数量
func (m *Manager) GetConnectionCount() int {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	return len(m.clients)
}

// IsUserOnline 检查用户是否在线
func (m *Manager) IsUserOnline(userID string) bool {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	client, exists := m.clients[userID]
	return exists && client.IsActive
}

// generateClientID 生成客户端ID
func generateClientID() string {
	return uuid.New().String()
}
