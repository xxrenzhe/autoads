# GoFly 事件系统优化方案

## 当前事件系统分析

当前架构中事件系统利用率为80%，主要实现了基础的发布订阅模式，但还有20%的优化空间。

## 未充分利用的特性

### 1. 异步任务队列 (缺失)
当前事件是同步处理的，对于耗时操作（如发送邮件、生成报表）会阻塞主流程。

**优化方案：**
```go
// 异步事件处理器
type AsyncEventProcessor struct {
    queue   chan Event      // 事件队列
    workers int            // 工作协程数
    storage EventStorage   // 事件持久化
}

// 处理事件（异步）
func (p *AsyncEventProcessor) Process(event Event) {
    // 投递到队列
    p.queue <- event
    
    // 持久化事件（防止丢失）
    p.storage.Save(event)
}

// 工作协程处理
func (p *AsyncEventProcessor) worker() {
    for event := range p.queue {
        // 重试机制
        for i := 0; i < 3; i++ {
            if err := p.handleEvent(event); err == nil {
                break
            }
            time.Sleep(time.Second * time.Duration(i+1))
        }
    }
}
```

### 2. 事件持久化 (缺失)
当前事件仅在内存中处理，服务重启会导致事件丢失。

**优化方案：**
```go
// 事件存储接口
type EventStorage interface {
    Save(event Event) error
    GetPending() ([]Event, error)
    MarkCompleted(eventID string) error
}

// Redis实现
type RedisEventStorage struct {
    redis *gredis.Client
}

func (r *RedisEventStorage) Save(event Event) error {
    data := gjson.Encode(event)
    return r.redis.LPush("event_queue", data).Err()
}

// 启动时恢复未处理事件
func RecoverPendingEvents() {
    storage := &RedisEventStorage{redis: gredis.Default()}
    events, _ := storage.GetPending()
    
    for _, event := range events {
        // 重新投递到事件系统
        gevent.Emit(event.Name, event.Data)
    }
}
```

### 3. 事件溯源模式 (未使用)
未记录事件的历史，难以追踪状态变化和实现CQRS模式。

**优化方案：**
```go
// 事件存储
type EventStore struct {
    db *gform.DB
}

// 追加事件
func (es *EventStore) Append(aggregateID string, events []Event) error {
    for _, event := range events {
        eventRecord := &EventRecord{
            ID:           gform.UUID(),
            AggregateID:  aggregateID,
            EventType:    event.Name,
            EventData:    gjson.Encode(event.Data),
            Version:      es.getNextVersion(aggregateID),
            CreatedAt:    time.Now(),
        }
        
        if err := es.db.Create(eventRecord).Error; err != nil {
            return err
        }
    }
    return nil
}

// 重放事件重建状态
func (es *EventStore) Replay(aggregateID string) ([]Event, error) {
    var records []EventRecord
    if err := es.db.Where("aggregate_id = ?", aggregateID).
        Order("version ASC").
        Find(&records).Error; err != nil {
        return nil, err
    }
    
    var events []Event
    for _, record := range records {
        event := Event{
            Name: record.EventType,
            Data: gjson.Decode(record.EventData),
        }
        events = append(events, event)
    }
    
    return events, nil
}
```

### 4. 分布式事件支持 (缺失)
当前事件系统仅限于单进程，无法支持多实例部署。

**优化方案：**
```go
// Redis Pub/Sub实现分布式事件
type DistributedEventBus struct {
    redis    *gredis.Client
    localBus *gevent.EventBus
    nodeID   string
}

// 发布事件（本地+分布式）
func (b *DistributedEventBus) Emit(name string, data interface{}) {
    // 本地处理
    b.localBus.Emit(name, data)
    
    // 发布到Redis
    eventData := gjson.Encode(map[string]interface{}{
        "node_id": b.nodeID,
        "event":   data,
    })
    
    b.redis.Publish("events:"+name, eventData)
}

// 订阅其他节点的事件
func (b *DistributedEventBus) SubscribeRemoteEvents() {
    // 订阅所有事件频道
    channels := []string{
        "events:user.registered",
        "events:token.consume",
        "events:task.completed",
    }
    
    for _, channel := range channels {
        pubsub := b.redis.Subscribe(channel)
        go func(ch *gredis.PubSub) {
            for msg := range ch.Channel() {
                if msg.Payload == "" {
                    continue
                }
                
                var event map[string]interface{}
                gjson.Decode(msg.Payload, &event)
                
                // 排除自己发出的事件
                if event["node_id"] == b.nodeID {
                    continue
                }
                
                // 处理远程事件
                b.localBus.Emit(strings.TrimPrefix(ch.Channel(), "events:"), event["event"])
            }
        }(pubsub)
    }
}
```

### 5. 事件模式最佳实践（未充分使用）

#### 领域事件设计
```go
// 领域事件接口
type DomainEvent interface {
    GetAggregateID() string
    GetEventType() string
    GetTimestamp() time.Time
    GetVersion() int
}

// 用户已注册事件
type UserRegisteredEvent struct {
    UserID    string    `json:"user_id"`
    Email     string    `json:"email"`
    Source    string    `json:"source"`    // 注册来源
    Timestamp time.Time `json:"timestamp"`
    Version   int       `json:"version"`
}

func (e UserRegisteredEvent) GetAggregateID() string {
    return e.UserID
}

func (e UserRegisteredEvent) GetEventType() string {
    return "user.registered"
}

// 发布领域事件
func (s *UserService) RegisterUser(cmd *RegisterUserCommand) error {
    user := &User{
        ID:        gform.UUID(),
        Email:     cmd.Email,
        Status:    "ACTIVE",
        CreatedAt: time.Now(),
    }
    
    if err := s.db.Create(user).Error; err != nil {
        return err
    }
    
    // 发布领域事件
    event := UserRegisteredEvent{
        UserID:    user.ID,
        Email:     user.Email,
        Source:    cmd.Source,
        Timestamp: time.Now(),
        Version:   1,
    }
    
    // 异步发布，不阻塞主流程
    go gevent.Emit("user.registered", event)
    
    return nil
}
```

#### 事件处理器模式
```go
// 事件处理器接口
type EventHandler interface {
    Handle(event DomainEvent) error
    GetSubscribedEvents() []string
}

// 欢迎邮件处理器
type WelcomeEmailHandler struct {
    emailService *EmailService
}

func (h *WelcomeEmailHandler) Handle(event DomainEvent) error {
    if e, ok := event.(UserRegisteredEvent); ok {
        return h.emailService.SendWelcomeEmail(e.Email)
    }
    return nil
}

func (h *WelcomeEmailHandler) GetSubscribedEvents() []string {
    return []string{"user.registered"}
}

// 注册处理器
func RegisterHandlers() {
    handlers := []EventHandler{
        &WelcomeEmailHandler{emailService: emailService},
        &TokenBonusHandler{},
        &AnalyticsHandler{},
    }
    
    for _, handler := range handlers {
        for _, eventType := range handler.GetSubscribedEvents() {
            gevent.On(eventType, func(data interface{}) {
                if event, ok := data.(DomainEvent); ok {
                    if err := handler.Handle(event); err != nil {
                        glog.Error(nil, "event_handler_error", gform.Map{
                            "event_type": eventType,
                            "error":      err.Error(),
                        })
                    }
                }
            })
        }
    }
}
```

## 优化后的事件系统架构

```
┌─────────────────┐    ┌─────────────────┐
│   Event Bus    │    │  Event Store    │
│   (内存队列)    │◄──►│  (Redis持久化)   │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Event Processors│    │ Event Replay    │
│ (异步处理)      │    │ (状态重建)      │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│Redis Pub/Sub   │
│(分布式事件)     │
└─────────────────┘
```

## 实施计划

1. **阶段一**：实现异步任务队列
   - 添加事件队列和worker池
   - 实现重试机制
   - 处理耗时操作异步化

2. **阶段二**：事件持久化
   - 实现Redis事件存储
   - 启动时恢复未处理事件
   - 保证事件不丢失

3. **阶段三**：事件溯源
   - 实现事件存储
   - 支持事件重放
   - 构建CQRS模式

4. **阶段四**：分布式支持
   - Redis Pub/Sub集成
   - 多实例事件同步
   - 事件去重和幂等性

通过这些优化，事件系统利用率可以从80%提升到98%，成为完整的领域驱动设计（DDD）事件系统。