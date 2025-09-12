# 速率限制系统优化实施指南

## 概述

本文档详细说明了SiteRankGo和BatchGo速率限制系统的完整优化方案，包括实现细节、集成步骤和使用方法。

## 实现的功能特性

### ✅ 已完成的功能

1. **统一的速率限制管理**
   - 基于用户ID的独立限流
   - 基于套餐的差异化配置
   - 自动清理不活跃用户
   - 详细的统计和监控

2. **多层限流机制**
   - API层面：基础请求频率控制
   - 模块层面：SiteRankGo和BatchGo独立限流
   - 套餐层面：根据用户套餐动态调整限制

3. **热更新支持**
   - 配置文件变更自动重载
   - 数据库配置实时同步
   - 无需重启应用即可生效

4. **完整的后台管理**
   - 套餐限流配置管理
   - 用户限流统计查询
   - 限流器重置功能
   - 系统状态监控

5. **统计和日志**
   - 使用量持久化存储
   - 历史数据查询
   - 用户行为分析
   - 系统性能监控

## 系统架构

### 核心组件

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │  SiteRankGo     │    │   BatchGo       │
│   (middleware)  │    │   Service       │    │   Service       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌───────────▼───────────┐
                    │ RateLimitManager     │
                    │ (统一限流管理器)      │
                    └───────────┬───────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
    ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
    │   配置    │        │   统计    │        │   日志    │
    │   管理    │        │   收集    │        │   记录    │
    └───────────┘        └───────────┘        └───────────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     Database         │
                    │   (MySQL/Redis)      │
                    └───────────────────────┘
```

## 快速开始

### 1. 数据库准备

执行迁移脚本创建必要的表：

```bash
mysql -u username -p database_name < migrations/2024_create_rate_limit_tables.sql
```

### 2. 配置文件

在 `config.yaml` 中添加限流配置：

```yaml
# 速率限制配置
rate_limits:
  plans:
    FREE:
      api_requests_per_minute: 30
      api_requests_per_hour: 1000
      siterank_requests_per_minute: 2
      siterank_requests_per_hour: 50
      batch_concurrent_tasks: 1
      batch_tasks_per_minute: 5
    PRO:
      api_requests_per_minute: 100
      api_requests_per_hour: 5000
      siterank_requests_per_minute: 10
      siterank_requests_per_hour: 200
      batch_concurrent_tasks: 5
      batch_tasks_per_minute: 20
    MAX:
      api_requests_per_minute: 500
      api_requests_per_hour: 20000
      siterank_requests_per_minute: 50
      siterank_requests_per_hour: 1000
      batch_concurrent_tasks: 20
      batch_tasks_per_minute: 100
```

### 3. 初始化服务

```go
package main

import (
    "gofly_admin_v3/internal/ratelimit"
    "gofly_admin_v3/internal/siterankgo"
    "gofly_admin_v3/internal/batchgo"
    "gofly_admin_v3/internal/user"
    "gofly_admin_v3/internal/store"
)

func main() {
    // 初始化数据库
    db := store.NewDB(&config.Database)
    redis := store.NewRedis(&config.Redis)
    
    // 初始化用户服务
    userService := user.NewService(db)
    
    // 初始化速率限制管理器
    rateLimitManager := ratelimit.NewRateLimitManager(config, db, userService)
    
    // 初始化业务服务（传入限流管理器）
    siterankService := siterankgo.NewGoFlySiteRankGoService(db, redis, rateLimitManager)
    batchService := batchgo.NewGoFlyBatchGoService(db, redis, rateLimitManager)
    
    // 启动应用...
}
```

## API 使用示例

### 1. 检查限流

```go
// SiteRankGo 请求
response, err := siterankService.GetWebsiteTrafficData(ctx, userID, domain)
if err != nil {
    if strings.Contains(err.Error(), "rate limit") {
        // 处理限流错误
        return fmt.Errorf("请求过于频繁，请稍后再试")
    }
    return err
}

// BatchGo 任务创建
task, err := batchService.CreateTask(userID, req)
if err != nil {
    if strings.Contains(err.Error(), "concurrent") {
        // 处理并发限制
        return fmt.Errorf("已达到最大并发任务数限制")
    }
    return err
}
```

### 2. 管理API

```bash
# 获取套餐限流配置
GET /api/v1/admin/rate-limits/plan

# 更新套餐配置
PUT /api/v1/admin/rate-limits/plan/PRO
{
    "api_requests_per_minute": 150,
    "siterank_requests_per_minute": 15,
    "batch_concurrent_tasks": 10
}

# 获取用户统计
GET /api/v1/admin/rate-limits/user/user-123/stats

# 重置用户限流器
POST /api/v1/admin/rate-limits/user/user-123/reset
```

## 监控和统计

### 1. 系统指标

- 活跃用户数
- 请求成功率
- 限流触发次数
- 平均响应时间

### 2. 用户使用统计

- API调用次数
- SiteRank查询次数
- Batch任务执行次数
- 套餐使用率

### 3. 告警建议

- 限流触发率超过10%
- 单用户请求异常增长
- 系统资源使用率过高
- 数据库连接异常

## 性能优化建议

### 1. 限流器优化

- 使用内存缓存减少数据库查询
- 合理设置令牌桶大小
- 定期清理不活跃用户
- 使用滑动窗口算法

### 2. 数据库优化

- 添加适当的索引
- 使用批量插入
- 定期清理历史数据
- 考虑读写分离

### 3. 分布式支持

- 使用Redis存储限流状态
- 实现集群间的状态同步
- 支持水平扩展
- 实现服务发现

## 故障排查

### 1. 常见问题

**Q: 限流不生效**
- 检查是否正确初始化限流管理器
- 确认用户套餐配置是否正确
- 查看限流日志确认触发条件

**Q: 性能问题**
- 检查限流器数量是否过多
- 确认统计收集频率是否过高
- 查看数据库查询是否优化

**Q: 配置不生效**
- 确认配置文件格式正确
- 检查热更新服务是否运行
- 查看配置加载日志

### 2. 日志分析

```bash
# 查看限流日志
tail -f logs/rate-limit.log | grep "reject"

# 统计用户使用情况
grep "user-123" logs/rate-limit.log | wc -l

# 分析系统负载
grep "system_stats" logs/rate-limit.log
```

## 扩展功能

### 1. 高级特性

- IP黑白名单
- 时间窗口限流
- 地理位置限流
- 设备类型限流

### 2. 集成建议

- 与监控系统集成（Prometheus）
- 与告警系统集成
- 与日志系统集成（ELK）
- 与APM系统集成

### 3. 未来规划

- 支持更多限流算法
- 实现自适应限流
- 添加机器学习预测
- 支持多租户隔离

## 总结

本优化方案实现了完整的速率限制系统，具有以下特点：

1. **统一管理**：所有模块使用统一的限流管理器
2. **灵活配置**：支持基于套餐的差异化配置
3. **实时监控**：完整的使用统计和日志记录
4. **易于扩展**：模块化设计，便于添加新功能
5. **高性能**：内存缓存和异步处理保证性能

通过这套系统，可以有效保护API资源，防止滥用，同时为不同级别的用户提供差异化服务。