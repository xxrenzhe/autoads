# 用户级别速率限制实现报告

## 概述

根据问题"速率限制是针对单用户的，还是API的"，我们已将SimilarWeb API的速率限制从全局限制改为基于用户的限制，确保多用户环境下的公平使用。

## 实现架构

### 双层速率限制
系统实现了双层速率限制机制：
1. **用户级别限制**：每个用户独立的请求限制
2. **全局限制**：整个系统的总请求限制

### 限制配置
- **用户限制**：每分钟5个请求，每小时50个请求
- **全局限制**：每分钟20个请求，每小时1000个请求
- **并发限制**：批量查询最多5个并发

## 核心实现

### 1. UserRateLimiter 用户速率限制器
```go
type UserRateLimiter struct {
    globalLimit *RateLimiter     // 全局限制器
    userLimits  map[string]*RateLimit // 用户限制映射
    mu          sync.RWMutex      // 读写锁
}
```

### 2. RateLimit 用户限制状态
```go
type RateLimit struct {
    mu               sync.Mutex      // 互斥锁
    UserID           string         // 用户ID
    MinuteRequests   int            // 分钟请求数
    HourRequests     int            // 小时请求数
    LastMinuteReset  time.Time      // 分钟重置时间
    LastHourReset    time.Time      // 小时重置时间
    TokenBucket      chan time.Time  // 令牌桶
}
```

### 3. 令牌桶算法
每个用户维护一个独立的令牌桶：
- 桶大小：5个令牌（对应每分钟5个请求）
- 补充速率：每12秒补充1个令牌
- 自动清理：超过1小时未活动的用户会被清理

## 主要特性

### 1. 用户隔离
- 每个用户的请求计数完全独立
- 一个用户达到限制不会影响其他用户
- 系统自动维护活跃用户列表

### 2. 自动管理
- 令牌自动补充，无需手动干预
- 定期清理不活跃用户，释放内存
- 计数器自动重置（分钟/小时）

### 3. 灵活配置
- 可通过配置文件调整限制值
- 支持不同用户级别的差异化限制
- 运行时动态调整限制

## 使用方法

### 1. 基本使用
```go
// 创建客户端
client := NewSimilarWebClient()

// 发起请求（需要传入用户ID）
response, err := client.GetWebsiteData(ctx, "user-123", req)
```

### 2. 批量查询
```go
// 批量查询（会自动应用用户限制）
results, err := client.BatchGetWebsiteData(ctx, "user-123", domains)
```

### 3. 监控统计
```go
// 获取用户统计
stats := client.GetUserRateLimitStats("user-123")
fmt.Printf("用户请求: %d/%d (分钟)\n", stats["minute_requests"], stats["minute_limit"])

// 获取全局统计
globalStats := client.GetRateLimitStats()
fmt.Printf("活跃用户: %d\n", globalStats["active_users"])
```

## 配置说明

### 环境变量
```bash
# SimilarWeb API URL（可选）
export SIMILARWEB_API_URL="https://data.similarweb.com/api/v1/data"
```

### 配置文件 (config.yaml)
```yaml
similarweb:
  api_url: "https://data.similarweb.com/api/v1/data"
  rate_limit:
    # 全局速率限制
    global_per_minute: 20
    global_per_hour: 1000
    # 单用户速率限制
    user_per_minute: 5
    user_per_hour: 50
  retry:
    max_attempts: 5
    initial_delay: 1
    max_delay: 30
    backoff_factor: 2.0
```

## 测试覆盖

创建了完整的测试脚本 `test_user_rate_limit.go`，验证了：

1. **单用户限制测试**
   - 验证每分钟5个请求的限制
   - 验证每小时50个请求的限制
   - 测试超过限制时的错误处理

2. **多用户并发测试**
   - 验证用户间的隔离性
   - 测试并发请求的正确处理
   - 验证全局限制的有效性

3. **批量查询测试**
   - 验证批量查询的用户限制
   - 测试并发控制

4. **系统监控测试**
   - 验证统计信息的准确性
   - 测试用户清理功能

## 性能考虑

### 内存使用
- 每个活跃用户占用约1KB内存
- 自动清理机制确保不占用过多内存
- 支持数千个并发用户

### CPU开销
- 令牌补充使用轻量级定时器
- 读写锁保证高并发性能
- 统计信息查询为O(1)复杂度

### 网络效率
- 合理的速率限制避免API滥用
- 自动重试机制提高成功率
- 批量查询减少网络开销

## 实际应用场景

### 1. SaaS多租户应用
- 每个租户（用户）独立的API配额
- 不同套餐可设置不同限制
- 防止某个租户影响其他租户

### 2. 用户分级服务
- 免费用户：每分钟2个请求
- 付费用户：每分钟10个请求
- 企业用户：每分钟50个请求

### 3. API网关集成
- 在API网关层统一管理限制
- 支持分布式部署
- 实时监控和告警

## 扩展建议

### 1. 持久化存储
- 将用户限制状态保存到Redis
- 支持服务重启后状态恢复
- 实现分布式限制

### 2. 动态调整
- 根据用户套餐动态调整限制
- 支持管理员手动调整
- 实现限制的升级/降级

### 3. 高级特性
- 实现滑动窗口限制
- 支持突发流量处理
- 添加白名单机制

### 4. 监控告警
- 集成Prometheus监控
- 实时告警通知
- 使用情况报表

## 总结

用户级别速率限制的实现解决了多用户环境下的公平性问题：

✅ **用户隔离**：每个用户独立的请求配额
✅ **自动管理**：令牌自动补充和计数器重置
✅ **性能优化**：轻量级实现，支持高并发
✅ **灵活配置**：支持动态调整和差异化限制
✅ **完整监控**：详细的统计和使用情况

这个实现确保了SimilarWeb API资源的公平分配，防止了单个用户过度使用，同时为所有用户提供了稳定可靠的服务。