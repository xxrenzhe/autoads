# AutoAds WebSocket实时通信系统文档

## 概述

AutoAds WebSocket实时通信系统提供双向实时通信功能，支持任务进度推送、系统通知、BatchGo Basic模式的window.open指令等核心功能，为用户提供实时的系统反馈和交互体验。

## 核心特性

### 1. 实时任务进度推送
- **BatchGo任务**: 实时推送任务状态、进度百分比、成功失败统计
- **SiteRank查询**: 实时推送查询进度和结果统计
- **Chengelink任务**: 实时推送链接提取和广告更新进度

### 2. BatchGo Basic模式支持
- **window.open指令**: 发送URL列表给前端执行window.open操作
- **延迟控制**: 支持配置URL打开的延迟时间
- **批量处理**: 支持批量URL的分批处理

### 3. 系统通知推送
- **Token不足通知**: 余额不足时的实时提醒
- **套餐过期通知**: 套餐即将过期或已过期的提醒
- **系统消息**: 重要系统公告和维护通知

### 4. 连接管理
- **用户认证**: 基于JWT的WebSocket连接认证
- **心跳检测**: 自动心跳保持连接活跃
- **断线重连**: 支持客户端断线重连机制
- **连接统计**: 实时连接数和在线用户统计

## 技术架构

### WebSocket管理器 (Manager)
```go
type Manager struct {
    clients    map[string]*Client // userID -> Client
    register   chan *Client       // 客户端注册通道
    unregister chan *Client       // 客户端注销通道
    broadcast  chan []byte        // 广播消息通道
    mutex      sync.RWMutex       // 读写锁
}
```

### WebSocket客户端 (Client)
```go
type Client struct {
    ID        string              // 客户端ID
    UserID    string              // 用户ID
    Conn      *websocket.Conn     // WebSocket连接
    Send      chan []byte         // 发送消息通道
    Manager   *Manager            // 管理器引用
    LastPing  time.Time           // 最后心跳时间
    IsActive  bool                // 是否活跃
}
```

### 消息格式 (Message)
```go
type Message struct {
    Type      string      // 消息类型
    UserID    string      // 用户ID (可选)
    Data      interface{} // 消息数据
    Timestamp int64       // 时间戳
    MessageID string      // 消息ID (可选)
}
```

## 消息类型

### BatchGo相关消息
- `batchgo_start`: BatchGo任务开始
- `batchgo_progress`: BatchGo任务进度更新
- `batchgo_complete`: BatchGo任务完成
- `batchgo_open_url`: BatchGo Basic模式打开URL指令

### SiteRank相关消息
- `siterank_start`: SiteRank查询开始
- `siterank_progress`: SiteRank查询进度更新
- `siterank_complete`: SiteRank查询完成

### Chengelink相关消息
- `chengelink_start`: Chengelink任务开始
- `chengelink_progress`: Chengelink任务进度更新
- `chengelink_complete`: Chengelink任务完成

### 系统通知消息
- `system_notification`: 系统通知
- `token_insufficient`: Token不足通知
- `plan_expiring`: 套餐即将过期通知
- `plan_expired`: 套餐已过期通知

### 连接管理消息
- `ping`: 心跳检测
- `pong`: 心跳响应
- `connected`: 连接成功
- `disconnected`: 连接断开
- `error`: 错误消息

## 数据结构

### BatchGoOpenURLData - BatchGo打开URL数据
```go
type BatchGoOpenURLData struct {
    TaskID string   // 任务ID
    URLs   []string // URL列表
    Delay  int      // 延迟时间（毫秒）
}
```

### TaskProgressData - 任务进度数据
```go
type TaskProgressData struct {
    TaskID      string  // 任务ID
    TaskType    string  // 任务类型
    Status      string  // 任务状态
    Progress    float64 // 进度百分比
    Total       int     // 总数量
    Completed   int     // 完成数量
    Failed      int     // 失败数量
    Message     string  // 进度消息
    StartTime   int64   // 开始时间
    EndTime     int64   // 结束时间
}
```

### SystemNotificationData - 系统通知数据
```go
type SystemNotificationData struct {
    Title    string // 通知标题
    Message  string // 通知内容
    Level    string // 通知级别 (info, warning, error, success)
    Action   string // 操作按钮文本
    ActionURL string // 操作链接
}
```

### TokenInsufficientData - Token不足通知数据
```go
type TokenInsufficientData struct {
    CurrentBalance int    // 当前余额
    RequiredTokens int    // 所需Token数
    TaskType       string // 任务类型
    Message        string // 提示消息
}
```

### PlanExpiringData - 套餐过期通知数据
```go
type PlanExpiringData struct {
    PlanName    string // 套餐名称
    DaysLeft    int    // 剩余天数
    ExpiresAt   int64  // 过期时间戳
    Message     string // 提示消息
    UpgradeURL  string // 升级链接
}
```

## API接口

### WebSocket连接
```http
GET /ws
Authorization: Bearer <jwt_token>
Upgrade: websocket
Connection: Upgrade
```

### 发送通知 (管理员接口)
```http
POST /api/websocket/notification
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "user_123",
  "title": "系统通知",
  "message": "您有新的消息",
  "level": "info"
}
```

### 发送BatchGo打开URL指令
```http
POST /api/websocket/batchgo/open-url
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "user_123",
  "task_id": "batch_001",
  "urls": [
    "https://example1.com",
    "https://example2.com"
  ],
  "delay": 1000
}
```

### 发送任务进度更新
```http
POST /api/websocket/task/progress
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "user_123",
  "task_id": "task_001",
  "task_type": "batchgo",
  "status": "running",
  "progress": 65.5,
  "total": 20,
  "completed": 13,
  "failed": 0,
  "message": "处理中..."
}
```

### 发送Token不足通知
```http
POST /api/websocket/token/insufficient
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "user_123",
  "current_balance": 50,
  "required_tokens": 100,
  "task_type": "batchgo"
}
```

### 发送套餐过期通知
```http
POST /api/websocket/plan/expiring
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "user_id": "user_123",
  "plan_name": "pro",
  "days_left": 3,
  "expires_at": 1694592000
}
```

### 获取连接统计
```http
GET /api/websocket/stats
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "total_connections": 25,
    "connected_users": ["user_001", "user_002", "user_003"]
  }
}
```

### 检查用户在线状态
```http
GET /api/websocket/user/{user_id}/online
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "检查完成",
  "data": {
    "user_id": "user_123",
    "is_online": true
  }
}
```

### 广播通知
```http
POST /api/websocket/broadcast
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "系统公告",
  "message": "新功能上线啦！",
  "level": "success"
}
```

### 测试连接
```http
GET /api/websocket/test?user_id=user_123
Authorization: Bearer <jwt_token>
```

## 客户端集成

### JavaScript WebSocket客户端示例
```javascript
class AutoAdsWebSocket {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
  }

  connect() {
    const wsUrl = `ws://localhost:8080/ws?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = (event) => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.sendMessage('client_ready', {});
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'batchgo_open_url':
        this.handleBatchGoOpenURL(message.data);
        break;
      case 'batchgo_progress':
        this.handleTaskProgress(message.data);
        break;
      case 'system_notification':
        this.handleSystemNotification(message.data);
        break;
      case 'token_insufficient':
        this.handleTokenInsufficient(message.data);
        break;
      case 'plan_expiring':
        this.handlePlanExpiring(message.data);
        break;
      case 'ping':
        this.sendMessage('pong', {});
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  handleBatchGoOpenURL(data) {
    // BatchGo Basic模式 - 打开URL
    data.urls.forEach((url, index) => {
      setTimeout(() => {
        window.open(url, '_blank');
      }, index * data.delay);
    });
  }

  handleTaskProgress(data) {
    // 更新任务进度UI
    const progressBar = document.getElementById(`progress-${data.task_id}`);
    if (progressBar) {
      progressBar.style.width = `${data.progress}%`;
      progressBar.textContent = `${data.completed}/${data.total}`;
    }
  }

  handleSystemNotification(data) {
    // 显示系统通知
    this.showNotification(data.title, data.message, data.level);
  }

  handleTokenInsufficient(data) {
    // 显示Token不足提醒
    this.showNotification(
      'Token余额不足',
      `当前余额: ${data.current_balance}, 需要: ${data.required_tokens}`,
      'warning'
    );
  }

  handlePlanExpiring(data) {
    // 显示套餐过期提醒
    this.showNotification(
      '套餐即将过期',
      `${data.plan_name}套餐还有${data.days_left}天过期`,
      'warning'
    );
  }

  sendMessage(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: type,
        data: data,
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectInterval);
    }
  }

  showNotification(title, message, level) {
    // 实现通知显示逻辑
    console.log(`[${level.toUpperCase()}] ${title}: ${message}`);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 使用示例
const wsClient = new AutoAdsWebSocket('your-jwt-token');
wsClient.connect();
```

### React Hook示例
```javascript
import { useEffect, useRef, useState } from 'react';

export const useWebSocket = (token) => {
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!token) return;

    const wsUrl = `ws://localhost:8080/ws?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
      
      // 处理特殊消息类型
      if (message.type === 'batchgo_open_url') {
        handleBatchGoOpenURL(message.data);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [token]);

  const sendMessage = (type, data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const message = {
        type,
        data,
        timestamp: Date.now()
      };
      ws.current.send(JSON.stringify(message));
    }
  };

  const handleBatchGoOpenURL = (data) => {
    data.urls.forEach((url, index) => {
      setTimeout(() => {
        window.open(url, '_blank');
      }, index * data.delay);
    });
  };

  return {
    isConnected,
    messages,
    sendMessage
  };
};
```

## 服务端集成

### 在业务服务中使用WebSocket
```go
// 在BatchGo服务中集成WebSocket通知
type BatchGoService struct {
    db        *gorm.DB
    wsService *websocket.Service
}

func (s *BatchGoService) ExecuteSilentTask(userID, taskID string, urls []string) error {
    // 发送任务开始通知
    s.wsService.NotifyBatchGoStart(userID, taskID, len(urls))
    
    completed := 0
    failed := 0
    
    for i, url := range urls {
        // 处理URL
        err := s.processURL(url)
        if err != nil {
            failed++
        } else {
            completed++
        }
        
        // 发送进度更新
        s.wsService.NotifyBatchGoProgress(userID, taskID, len(urls), completed, failed, 
            fmt.Sprintf("处理进度: %d/%d", completed+failed, len(urls)))
    }
    
    // 发送任务完成通知
    s.wsService.NotifyBatchGoComplete(userID, taskID, len(urls), completed, failed)
    
    return nil
}

func (s *BatchGoService) ExecuteBasicTask(userID, taskID string, urls []string) error {
    // Basic模式 - 发送window.open指令给前端
    s.wsService.NotifyBatchGoOpenURL(userID, taskID, urls, 1000)
    return nil
}
```

### Token服务集成
```go
func (s *TokenService) ConsumeTokens(userID string, amount int, taskType string) error {
    balance, err := s.GetBalance(userID)
    if err != nil {
        return err
    }
    
    if balance < amount {
        // 发送Token不足通知
        s.wsService.NotifyTokenInsufficient(userID, balance, amount, taskType)
        return fmt.Errorf("Token余额不足")
    }
    
    // 执行Token消费逻辑
    return s.doConsumeTokens(userID, amount)
}
```

## 心跳机制

### 服务端心跳检测
- **心跳间隔**: 30秒检查一次客户端健康状态
- **超时时间**: 60秒无响应认为连接断开
- **自动清理**: 自动清理超时的连接

### 客户端心跳发送
- **Ping间隔**: 54秒发送一次Ping消息
- **Pong响应**: 收到服务端Ping后立即响应Pong
- **连接检测**: 通过心跳检测连接状态

## 性能优化

### 连接管理优化
- **连接池**: 使用map管理用户连接，O(1)查找效率
- **并发安全**: 使用读写锁保护并发访问
- **内存管理**: 及时清理断开的连接，避免内存泄漏

### 消息处理优化
- **异步处理**: 消息发送和处理都是异步的
- **缓冲通道**: 使用带缓冲的通道避免阻塞
- **批量广播**: 支持批量广播消息给多个用户

### 网络优化
- **消息压缩**: 大消息可以考虑压缩传输
- **连接复用**: 每个用户只维护一个WebSocket连接
- **超时控制**: 设置合理的读写超时时间

## 安全考虑

### 认证和授权
- **JWT认证**: 连接时验证JWT Token
- **用户隔离**: 严格的用户数据隔离
- **权限检查**: 消息发送前检查用户权限

### 防护机制
- **连接限制**: 限制单用户连接数
- **消息限流**: 防止消息发送频率过高
- **输入验证**: 验证所有输入消息格式

### 数据安全
- **敏感信息**: 不在WebSocket中传输敏感信息
- **消息加密**: 重要消息可以考虑加密传输
- **审计日志**: 记录重要的WebSocket操作

## 监控和日志

### 连接监控
- **连接数统计**: 实时统计在线连接数
- **用户活跃度**: 监控用户连接时长和活跃度
- **连接质量**: 监控连接断开率和重连率

### 消息监控
- **消息量统计**: 统计发送和接收的消息数量
- **消息类型分布**: 分析不同类型消息的使用情况
- **消息延迟**: 监控消息发送和接收的延迟

### 错误监控
- **连接错误**: 监控连接建立和断开的错误
- **消息错误**: 监控消息发送和处理的错误
- **性能问题**: 监控内存使用和CPU占用

## 扩展功能

### 1. 消息持久化
- **离线消息**: 用户离线时保存重要消息
- **消息历史**: 保存用户的消息历史记录
- **消息确认**: 实现消息送达确认机制

### 2. 高级通知
- **消息分组**: 支持消息分组和批量处理
- **优先级**: 支持消息优先级和紧急通知
- **模板消息**: 支持消息模板和个性化内容

### 3. 集群支持
- **负载均衡**: 支持多实例负载均衡
- **消息路由**: 跨实例的消息路由机制
- **状态同步**: 集群间的连接状态同步

## 故障排除

### 常见问题
1. **连接失败**: 检查JWT Token是否有效
2. **消息丢失**: 检查网络连接和心跳状态
3. **内存泄漏**: 检查连接是否正确清理
4. **性能问题**: 检查并发连接数和消息频率

### 调试工具
- **连接状态**: 通过API查看连接统计
- **消息日志**: 查看WebSocket消息日志
- **性能监控**: 监控系统资源使用情况

### 最佳实践
- **合理使用**: 避免频繁发送大量消息
- **错误处理**: 实现完善的错误处理和重试机制
- **资源管理**: 及时清理不需要的连接和资源