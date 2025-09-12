# AutoAds Chengelink系统文档

## 概述

AutoAds Chengelink系统是一个强大的广告链接自动化管理系统，集成AdsPower浏览器和Google Ads API，提供联盟链接提取和广告Final URL批量更新功能。系统支持自动化链接跟踪、智能广告更新和完整的执行监控。

## 核心特性

### 1. AdsPower浏览器集成
- **自动化浏览器**: 集成AdsPower反检测浏览器
- **链接跟踪**: 自动访问联盟链接并提取最终目标URL
- **多配置支持**: 支持多个浏览器配置和环境
- **连接管理**: 自动启动和停止浏览器实例

### 2. Google Ads API集成
- **官方API**: 集成Google Ads官方API
- **批量更新**: 支持批量更新广告Final URL
- **OAuth认证**: 完整的OAuth2.0认证流程
- **错误处理**: 完善的API错误处理和重试机制

### 3. 智能任务管理
- **异步执行**: 后台异步执行任务，不阻塞用户操作
- **状态跟踪**: 实时跟踪任务执行状态和进度
- **错误容忍**: 部分失败不影响整体任务执行
- **执行日志**: 详细的执行日志记录

### 4. Token计费集成
- **精确计费**: 链接提取1Token，广告更新3Token/广告
- **预检查**: 任务启动前检查Token余额
- **分阶段消费**: 链接提取和广告更新分别消费Token

## 数据模型

### ChengeLinkTask 任务模型
```go
type ChengeLinkTask struct {
    ID                string                 // 任务ID
    UserID            string                 // 用户ID
    Name              string                 // 任务名称
    Status            TaskStatus             // 任务状态
    AffiliateLinks    []string               // 联盟链接列表
    AdsPowerProfile   string                 // AdsPower配置ID
    GoogleAdsAccount  string                 // Google Ads账号ID
    ExtractedLinks    []ExtractedLink        // 提取的链接结果
    UpdateResults     []AdUpdateResult       // 广告更新结果
    TotalLinks        int                    // 总链接数
    ExtractedCount    int                    // 成功提取数
    UpdatedCount      int                    // 成功更新数
    FailedCount       int                    // 失败数量
    TokensConsumed    int                    // 消费Token数
    ExecutionLog      []ExecutionLogEntry    // 执行日志
    ErrorMessage      string                 // 错误信息
    StartedAt         *time.Time             // 开始时间
    CompletedAt       *time.Time             // 完成时间
    CreatedAt         time.Time              // 创建时间
    UpdatedAt         time.Time              // 更新时间
}
```

### 任务状态
- `pending`: 等待中
- `extracting`: 链接提取中
- `updating`: 广告更新中
- `completed`: 已完成
- `failed`: 失败
- `cancelled`: 已取消

### AdsPowerConfig 浏览器配置
```go
type AdsPowerConfig struct {
    ID          uint   // 配置ID
    UserID      string // 用户ID
    Name        string // 配置名称
    ProfileID   string // AdsPower配置ID
    APIEndpoint string // API端点
    APIKey      string // API密钥
    IsActive    bool   // 是否启用
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

### GoogleAdsConfig Google Ads配置
```go
type GoogleAdsConfig struct {
    ID               uint   // 配置ID
    UserID           string // 用户ID
    Name             string // 配置名称
    CustomerID       string // 客户ID
    DeveloperToken   string // 开发者Token
    ClientID         string // 客户端ID
    ClientSecret     string // 客户端密钥
    RefreshToken     string // 刷新Token
    IsActive         bool   // 是否启用
    CreatedAt        time.Time
    UpdatedAt        time.Time
}
```

## API接口

### 任务管理

#### 创建任务
```http
POST /api/chengelink/create-task
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "测试链接更新任务",
  "affiliate_links": [
    "https://affiliate1.example.com/product1",
    "https://affiliate2.example.com/product2"
  ],
  "adspower_profile": "profile_001",
  "google_ads_account": "customer_001"
}
```

**响应示例:**
```json
{
  "code": 0,
  "message": "任务创建成功",
  "data": {
    "id": "task_123",
    "name": "测试链接更新任务",
    "status": "pending",
    "total_links": 2,
    "created_at": "2025-09-12T14:30:00Z"
  }
}
```

#### 启动任务
```http
POST /api/chengelink/start-task
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "task_id": "task_123"
}
```

#### 获取任务详情
```http
GET /api/chengelink/task/{task_id}
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "id": "task_123",
    "name": "测试链接更新任务",
    "status": "completed",
    "total_links": 2,
    "extracted_count": 2,
    "updated_count": 6,
    "failed_count": 0,
    "tokens_consumed": 20,
    "extracted_links": [
      {
        "affiliate_url": "https://affiliate1.example.com/product1",
        "final_url": "https://target1.com/product",
        "status": "success",
        "extracted_at": "2025-09-12T14:31:00Z"
      }
    ],
    "update_results": [
      {
        "ad_id": "ad_001",
        "ad_name": "测试广告1",
        "old_final_url": "https://old-url.com",
        "new_final_url": "https://target1.com/product",
        "status": "success",
        "updated_at": "2025-09-12T14:32:00Z"
      }
    ],
    "execution_log": [
      {
        "timestamp": "2025-09-12 14:30:00",
        "level": "info",
        "message": "任务创建成功",
        "details": "包含2个联盟链接"
      }
    ]
  }
}
```

#### 获取任务列表
```http
GET /api/chengelink/tasks?page=1&size=20
Authorization: Bearer <jwt_token>
```

#### 取消任务
```http
POST /api/chengelink/cancel-task
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "task_id": "task_123"
}
```

#### 获取统计信息
```http
GET /api/chengelink/stats
Authorization: Bearer <jwt_token>
```

**响应示例:**
```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "total_tasks": 10,
    "completed_tasks": 8,
    "failed_tasks": 1,
    "total_links_extracted": 25,
    "total_ads_updated": 75,
    "success_rate": 80.0,
    "tokens_consumed": 250
  }
}
```

### 配置管理

#### 创建AdsPower配置
```http
POST /api/chengelink/adspower-config
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "测试AdsPower配置",
  "profile_id": "profile_001",
  "api_endpoint": "http://localhost:50325",
  "api_key": "your-api-key"
}
```

#### 创建Google Ads配置
```http
POST /api/chengelink/google-ads-config
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "测试Google Ads配置",
  "customer_id": "1234567890",
  "developer_token": "your-developer-token",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "refresh_token": "your-refresh-token"
}
```

#### 获取配置列表
```http
GET /api/chengelink/adspower-configs
GET /api/chengelink/google-ads-configs
Authorization: Bearer <jwt_token>
```

#### 测试连接
```http
POST /api/chengelink/test-adspower
POST /api/chengelink/test-google-ads
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "api_endpoint": "http://localhost:50325",
  "api_key": "your-api-key"
}
```

## AdsPower集成

### API配置
- **默认端点**: `http://localhost:50325`
- **认证方式**: API Key (可选)
- **支持功能**: 浏览器启动/停止、链接访问、URL提取

### 核心功能
1. **浏览器管理**: 启动和停止指定的浏览器配置
2. **链接跟踪**: 访问联盟链接并跟踪重定向
3. **URL提取**: 提取最终目标URL
4. **错误处理**: 处理浏览器启动失败、网络错误等

### 使用流程
1. 启动AdsPower浏览器配置
2. 使用Chrome DevTools Protocol访问联盟链接
3. 跟踪重定向链并提取最终URL
4. 停止浏览器配置释放资源

## Google Ads集成

### API配置
- **API版本**: v14
- **认证方式**: OAuth 2.0
- **权限范围**: Google Ads API访问权限

### 核心功能
1. **OAuth认证**: 自动刷新访问令牌
2. **广告查询**: 获取账号下所有广告信息
3. **批量更新**: 批量更新广告Final URL
4. **错误处理**: API限流、权限错误等处理

### 支持的操作
- 查询广告列表 (包含ID、名称、状态、当前URL)
- 更新广告Final URL
- 批量更新操作 (最多100个/批次)

## Token计费

### 计费标准
- **链接提取**: 1 Token/链接
- **广告更新**: 3 Token/广告
- **失败处理**: 已消费的Token不退还

### 计费流程
1. **任务创建**: 估算Token消费 (链接数 + 链接数*3)
2. **余额检查**: 创建任务前检查Token余额
3. **分阶段消费**: 
   - 链接提取阶段: 消费链接提取Token
   - 广告更新阶段: 消费广告更新Token
4. **实际计费**: 根据实际更新的广告数量计费

### Token消费示例
```
任务: 3个联盟链接 -> 更新6个广告
- 链接提取: 3 Token
- 广告更新: 6 * 3 = 18 Token
- 总消费: 21 Token
```

## 执行流程

### 完整执行流程
1. **任务创建**
   - 验证参数 (链接、配置等)
   - 检查Token余额
   - 创建任务记录

2. **链接提取阶段**
   - 消费链接提取Token
   - 启动AdsPower浏览器
   - 并发提取联盟链接 (限制并发数为3)
   - 记录提取结果和日志

3. **广告更新阶段**
   - 获取Google Ads广告列表
   - 消费广告更新Token
   - 批量更新广告Final URL
   - 记录更新结果和日志

4. **任务完成**
   - 更新任务状态
   - 生成执行报告
   - 清理资源

### 错误处理
- **AdsPower连接失败**: 重试3次，记录错误日志
- **链接提取失败**: 跳过失败链接，继续处理其他
- **Google Ads API错误**: 记录错误，尝试单个更新
- **Token不足**: 立即停止任务，返回错误

## 并发控制

### AdsPower并发
- **并发限制**: 最多3个浏览器实例同时运行
- **资源管理**: 自动启动和停止浏览器
- **错误隔离**: 单个浏览器失败不影响其他

### Google Ads批量
- **批次大小**: 每批最多100个广告
- **速率控制**: 遵守Google Ads API限制
- **重试机制**: 失败时自动重试

## 监控和日志

### 执行日志
- **日志级别**: info, warning, error
- **时间戳**: 精确到秒的时间记录
- **详细信息**: 包含操作详情和错误信息

### 统计指标
- **任务统计**: 总数、完成数、失败数
- **链接统计**: 提取成功数、失败数
- **广告统计**: 更新成功数、失败数
- **Token统计**: 总消费量
- **成功率**: 任务成功率计算

## 最佳实践

### 1. 配置管理
- **测试连接**: 创建配置后立即测试连接
- **权限验证**: 确保Google Ads账号有足够权限
- **环境隔离**: 生产和测试使用不同配置

### 2. 任务设计
- **合理批次**: 单次任务不超过50个链接
- **错误预期**: 预期10-20%的链接提取失败率
- **Token预算**: 预留20%的Token余量

### 3. 监控运维
- **定期检查**: 监控AdsPower和Google Ads连接状态
- **日志分析**: 定期分析执行日志发现问题
- **性能优化**: 根据统计数据优化并发参数

## 扩展功能

### 1. 高级链接处理
- **重定向链分析**: 完整的重定向路径记录
- **链接验证**: 验证最终URL的有效性
- **缓存机制**: 缓存已提取的链接结果

### 2. 智能广告匹配
- **关键词匹配**: 根据链接内容匹配相关广告
- **A/B测试**: 支持多个URL的A/B测试
- **性能跟踪**: 跟踪URL更新后的广告性能

### 3. 自动化调度
- **定时任务**: 支持定时执行链接更新
- **触发器**: 基于事件的自动触发
- **批量导入**: 支持Excel/CSV批量导入链接

## 安全考虑

### 1. 数据保护
- **敏感信息加密**: API密钥、Token等加密存储
- **用户隔离**: 严格的用户数据隔离
- **访问控制**: 基于用户权限的访问控制

### 2. API安全
- **速率限制**: 防止API滥用
- **Token管理**: 安全的Token存储和刷新
- **错误处理**: 不泄露敏感错误信息

### 3. 浏览器安全
- **环境隔离**: 每个用户独立的浏览器环境
- **资源限制**: 限制浏览器资源使用
- **自动清理**: 任务完成后自动清理浏览器数据