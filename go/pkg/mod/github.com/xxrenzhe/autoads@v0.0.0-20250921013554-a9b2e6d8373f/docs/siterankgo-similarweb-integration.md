# SiteRankGo SimilarWeb API 接入指南

SiteRankGo 是一个网站排名查询服务，通过集成 SimilarWeb API 提供详细的网站流量和排名数据。

## 1. 环境配置

### 1.1 环境变量设置

在部署环境中设置以下环境变量：

```bash
# SimilarWeb API URL（默认即可，无需密钥）
export SIMILARWEB_API_URL="https://data.similarweb.com/api/v1/data"
```

### 1.2 配置文件更新

在 `resource/config.yaml` 中添加：

```yaml
# SimilarWeb 配置（无需 api_key）
similarweb:
  api_url: "https://data.similarweb.com/api/v1/data"
  timeout: 30  # 请求超时时间（秒）
  rate_limit: 10  # 每秒请求数限制
```

## 2. SimilarWeb API 获取

### 2.1 注册 SimilarWeb

1. 访问 [SimilarWeb Developer Portal](https://developer.similarweb.com/)
2. 注册开发者账户
3. 创建应用获取 API Key
4. 选择合适的订阅计划

### 2.2 API 权限

根据您的订阅计划，您可能拥有以下权限：
- 网站基础数据查询
- 每月/每日调用次数限制
- 批量查询权限
- 历史数据访问权限

## 3. 功能特性

### 3.1 支持的数据字段

- **全球排名**: 网站在全球的排名位置
- **分类排名**: 在特定分类中的排名
- **国家排名**: 在特定国家/地区的排名
- **月访问量**: 估算的月度访问量（百万）
- **用户参与度**: 平均访问时长、跳出率等指标
- **流量来源**: 搜索、社交、直接等来源占比
- **相似网站**: 相关网站推荐

### 3.2 查询特性

- **批量查询**: 支持一次性查询多个域名
- **历史数据**: 保存历史查询记录
- **智能缓存**: 24小时缓存机制，减少API调用
- **错误处理**: 完善的错误处理和重试机制
- **速率限制**: 内置请求速率限制，避免超出配额

## 4. API 使用示例

### 4.1 创建单个查询任务

```bash
curl -X POST "http://localhost:8080/api/v1/siterank/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "domain": "example.com"
  }'
```

响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "task-uuid",
    "domain": "example.com",
    "status": "PENDING",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4.2 批量创建查询任务

```bash
curl -X POST "http://localhost:8080/api/v1/siterank/tasks/batch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "domains": [
      "example.com",
      "google.com",
      "facebook.com"
    ]
  }'
```

### 4.3 获取查询结果

```bash
curl -X GET "http://localhost:8080/api/v1/siterank/tasks/{task_id}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

成功响应示例：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "task-uuid",
    "domain": "example.com",
    "status": "COMPLETED",
    "global_rank": 1000,
    "category": "News and Media",
    "category_rank": 50,
    "country": "US",
    "country_rank": 200,
    "visits": 10.5,
    "engagement": 0.85,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:01:00Z"
  }
}
```

### 4.4 获取查询历史

```bash
curl -X GET "http://localhost:8080/api/v1/siterank/history/example.com?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 5. 定价和计费

### 5.1 Token 消耗

每个域名查询消耗 **100 Token**

### 5.2 SimilarWeb API 成本

根据 SimilarWeb 的定价：
- 免费版：有限制的调用次数
- 基础版：约 $99/月，10,000 次调用
- 专业版：约 $299/月，50,000 次调用
- 企业版：定制价格

建议根据实际使用量选择合适的套餐。

## 6. 错误处理

### 6.1 常见错误代码

| HTTP Code | 错误类型 | 说明 |
|-----------|----------|------|
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未授权或 Token 无效 |
| 403 | Forbidden | 权限不足或 Token 余额不足 |
| 404 | Not Found | 任务不存在 |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |

### 6.2 任务状态

- **PENDING**: 等待执行
- **RUNNING**: 正在查询
- **COMPLETED**: 查询完成
- **FAILED**: 查询失败

## 7. 最佳实践

### 7.1 查询优化

1. **批量查询**: 使用批量接口减少请求次数
2. **缓存利用**: 避免重复查询相同域名
3. **定时查询**: 设置定时任务定期更新数据

### 7.2 错误处理

1. **重试机制**: 对于临时错误实现自动重试
2. **降级处理**: API 不可用时使用缓存数据
3. **监控告警**: 监控 API 调用成功率

### 7.3 数据管理

1. **定期清理**: 清理过期的历史数据
2. **数据导出**: 支持导出报表
3. **权限控制**: 基于用户套餐限制查询次数

## 8. 监控和日志

### 8.1 关键指标

- API 调用成功率
- 平均响应时间
- Token 消耗量
- 错误率统计

### 8.2 日志级别

```yaml
logger:
  siterank:
    level: "info"
    file: "runtime/log/siterank.log"
```

### 8.3 监控示例

```bash
# 查看今天的查询统计
grep "siterank_task_created" runtime/log/siterank.log | wc -l

# 查看错误统计
grep "siterank_api_error" runtime/log/siterank.log
```

## 9. 安全考虑

### 9.1 端点与网关

- 默认使用公开端点，无需密钥
- 若供应商要求密钥，请通过内网网关注入，不在应用侧保存密钥

### 9.2 访问控制

- 基于 Token 的用户认证
- 套餐级别的功能限制
- IP 白名单（可选）

### 9.3 数据加密

- 传输层加密（HTTPS）
- 敏感数据加密存储

## 10. 部署检查清单

- [ ] 设置 `SIMILARWEB_API_URL`
- [ ] 更新配置文件
- [ ] 验证数据库连接
- [ ] 测试 API 调用
- [ ] 配置监控和日志
- [ ] 设置告警规则
- [ ] 准备备用 API Key
