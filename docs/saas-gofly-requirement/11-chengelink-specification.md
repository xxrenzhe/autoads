# Chengelink 功能规格说明书

**文档版本**: v1.0  
**最后更新**: 2025-09-11  
**文档状态**: 已标准化  
**功能版本**: v1.0 (MVP)

## 1. 功能概述

### 1.1 功能定义
Chengelink是AutoAds的核心自动化功能，专门用于自动更新Google Ads广告的Final URL。该功能通过浏览器自动化技术访问广告联盟链接，提取最终跳转的官网链接，然后批量更新到Google Ads广告系列中。

### 1.2 业务价值
- **效率提升**：将手动更新广告链接的时间从数小时缩短到几分钟
- **准确性保证**：消除人为错误，确保链接更新100%准确
- **成本节约**：减少人工操作成本，提高广告投放效率
- **规模化运营**：支持大规模广告链接管理，适合多账户运营

### 1.3 核心特性
- 自动化链接提取和更新
- 多账户管理支持
- 批量处理能力
- 实时状态监控
- 详细的执行日志

## 2. 系统架构

### 2.1 架构设计（基于Linus原则）

**数据结构优先设计**
```go
// 核心数据结构 - 简单直接
type ChengelinkConfig struct {
    ID                     string    `json:"id" gorm:"primaryKey"`
    UserID                 string    `json:"user_id" gorm:"not null;index"`
    Name                   string    `json:"name" gorm:"not null;size:255"`
    AffiliateLink          string    `json:"affiliate_link" gorm:"not null;type:text"`
    FinalUrl               string    `json:"final_url" gorm:"type:text"`
    AdsPowerEnvironmentID  string    `json:"adspower_environment_id" gorm:"not null;size:255"`
    GoogleAdsAccountID     string    `json:"google_ads_account_id" gorm:"not null;size:255"`
    Status                 string    `json:"status" gorm:"default:'pending'"` // pending, active, error
    LastExecutionAt        *time.Time `json:"last_execution_at"`
    CreatedAt              time.Time `json:"created_at"`
    UpdatedAt              time.Time `json:"updated_at"`
}

// 执行记录 - 简单的日志结构
type ChengelinkExecution struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    ConfigID    string    `json:"config_id" gorm:"not null;index"`
    Status      string    `json:"status" gorm:"not null"` // running, completed, failed
    StartTime   time.Time `json:"start_time"`
    EndTime     *time.Time `json:"end_time"`
    Result      string    `json:"result" gorm:"type:text"`    // JSON格式结果
    Error       string    `json:"error" gorm:"type:text"`     // 错误信息
    CreatedAt   time.Time `json:"created_at"`
}
```

### 2.2 组件架构

```
Chengelink System
├── ConfigService          # 配置管理
├── LinkExtractor         # 链接提取引擎
├── GoogleAdsUpdater      # Google Ads更新器
├── ExecutionEngine       # 执行引擎
└── MonitoringService     # 监控服务
```

**设计原则**：
- 每个组件只做一件事
- 消除特殊情况
- 数据结构驱动设计
- 简单直接的API

## 3. 功能模块

### 3.1 配置管理模块

#### 3.1.1 配置CRUD
- **创建配置**：支持多个自动化任务配置
- **查询配置**：分页查询，支持状态过滤
- **更新配置**：支持配置修改和状态切换
- **删除配置**：软删除，保留执行历史

#### 3.1.2 配置验证
- 链接格式验证
- 环境ID存在性检查
- 账号权限验证
- 配置完整性检查

### 3.2 链接提取模块

#### 3.2.1 核心流程
```go
func (e *LinkExtractor) ExtractLink(config *ChengelinkConfig) (*ExtractResult, error) {
    // 1. 启动AdsPower浏览器
    browser, err := e.startAdsPowerBrowser(config.AdsPowerEnvironmentID)
    if err != nil {
        return nil, err
    }
    defer browser.Close()
    
    // 2. 访问广告联盟链接
    if err := browser.Navigate(config.AffiliateLink); err != nil {
        return nil, err
    }
    
    // 3. 等待重定向完成
    finalUrl, err := e.waitForRedirect(browser, 40*time.Second)
    if err != nil {
        return nil, err
    }
    
    // 4. 清理和验证URL
    cleanedUrl := e.cleanUrl(finalUrl)
    
    return &ExtractResult{
        FinalUrl: cleanedUrl,
        Success:  true,
    }, nil
}
```

#### 3.2.2 关键特性
- **重定向检测**：智能等待页面重定向完成
- **URL清理**：移除追踪参数（utm_*、gclid等）
- **超时控制**：防止无限等待
- **重试机制**：失败后自动重试

### 3.3 Google Ads更新模块

#### 3.3.1 广告获取和更新
```go
func (u *GoogleAdsUpdater) UpdateFinalUrls(accountID string, finalUrl string) (*UpdateResult, error) {
    // 1. 验证账号凭据
    client, err := u.getGoogleAdsClient(accountID)
    if err != nil {
        return nil, err
    }
    
    // 2. 获取所有广告
    ads, err := u.getAllAds(client)
    if err != nil {
        return nil, err
    }
    
    // 3. 批量更新Final URL
    result := &UpdateResult{
        TotalAds:     len(ads),
        SuccessCount: 0,
        FailedCount:  0,
        Errors:       []string{},
    }
    
    for _, ad := range ads {
        if err := u.updateAdFinalUrl(client, ad.ID, finalUrl); err != nil {
            result.FailedCount++
            result.Errors = append(result.Errors, fmt.Sprintf("Ad %s: %v", ad.ID, err))
        } else {
            result.SuccessCount++
        }
    }
    
    return result, nil
}
```

### 3.4 执行引擎模块

#### 3.4.1 执行流程控制
```go
func (e *ExecutionEngine) Execute(configID string) (*ExecutionResult, error) {
    // 1. 获取配置
    config, err := e.configService.Get(configID)
    if err != nil {
        return nil, err
    }
    
    // 2. 创建执行记录
    execution := &ChengelinkExecution{
        ID:        uuid.New().String(),
        ConfigID:  configID,
        Status:    "running",
        StartTime: time.Now(),
    }
    
    // 3. 执行自动化流程
    result, err := e.executeAutomation(config)
    if err != nil {
        execution.Status = "failed"
        execution.Error = err.Error()
    } else {
        execution.Status = "completed"
        execution.Result = string(result)
    }
    
    execution.EndTime = &time.Time{}
    e.executionService.Create(execution)
    
    return result, nil
}
```

## 4. API接口设计

### 4.1 配置管理API

```go
// 创建配置
POST /api/v1/chengelink/configs
{
    "name": "Home Depot 主链接更新",
    "affiliate_link": "https://yeahpromos.com/click?id=12345",
    "adspower_environment_id": "j1nqjy0",
    "google_ads_account_id": "123-456-7890"
}

// 获取配置列表
GET /api/v1/chengelink/configs?page=1&size=20&status=active

// 更新配置
PUT /api/v1/chengelink/configs/{id}
{
    "name": "更新后的配置名称",
    "status": "active"
}

// 删除配置
DELETE /api/v1/chengelink/configs/{id}
```

### 4.2 执行控制API

```go
// 执行自动化任务
POST /api/v1/chengelink/execute
{
    "config_id": "config_123"
}

// 获取执行历史
GET /api/v1/chengelink/executions?page=1&size=20

// 获取执行详情
GET /api/v1/chengelink/executions/{id}

// 停止执行中的任务
POST /api/v1/chengelink/executions/{id}/stop
```

### 4.3 状态查询API

```go
// 获取系统状态
GET /api/v1/chengelink/status

// 获取统计信息
GET /api/v1/chengelink/stats

// 测试AdsPower连接
POST /api/v1/chengelink/test/adspower
{
    "environment_id": "j1nqjy0"
}

// 测试Google Ads连接
POST /api/v1/chengelink/test/googleads
{
    "account_id": "123-456-7890"
}
```

## 5. 数据库设计

### 5.1 主要表结构

```sql
-- Chengelink配置表
CREATE TABLE chengelink_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    affiliate_link TEXT NOT NULL,
    final_url TEXT,
    adspower_environment_id VARCHAR(255) NOT NULL,
    google_ads_account_id VARCHAR(255) NOT NULL,
    status ENUM('pending', 'active', 'error') DEFAULT 'pending',
    last_execution_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 执行记录表
CREATE TABLE chengelink_executions (
    id VARCHAR(36) PRIMARY KEY,
    config_id VARCHAR(36) NOT NULL,
    status ENUM('running', 'completed', 'failed') NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    result TEXT, -- JSON格式
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_config_id (config_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Google Ads账号表（复用现有表）
CREATE TABLE google_ads_accounts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    developer_token VARCHAR(255) NOT NULL,
    refresh_token TEXT NOT NULL,
    status ENUM('active', 'error') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id)
);
```

## 6. Token消耗规则

### 6.1 消费规则
基于Linus的简化原则，采用固定的Token消耗规则：

```sql
-- Chengelink Token消耗规则
INSERT INTO token_consume_rules (id, module, action, base_cost, description) VALUES 
('chengelink-extract', 'chengelink', 'extract', 1, '链接提取消耗1 Token'),
('chengelink-update', 'chengelink', 'update', 3, '每个广告更新消耗3 Token'),
('chengelink-test', 'chengelink', 'test', 1, '连接测试消耗1 Token');
```

### 6.2 消费逻辑
```go
func (s *ChengelinkService) ExecuteWithTokenConsume(userID, configID string) error {
    // 1. 获取配置
    config, err := s.GetConfig(configID)
    if err != nil {
        return err
    }
    
    // 2. 消费Token（链接提取）
    if err := s.tokenService.ConsumeTokens(userID, 'chengelink', 'extract', 1); err != nil {
        return err
    }
    
    // 3. 执行链接提取
    result, err := s.linkExtractor.ExtractLink(config)
    if err != nil {
        return err
    }
    
    // 4. 获取广告数量并消费Token
    adsCount, err := s.googleAdsUpdater.GetAdsCount(config.GoogleAdsAccountID)
    if err != nil {
        return err
    }
    
    if err := s.tokenService.ConsumeTokens(userID, 'chengelink', 'update', adsCount*3); err != nil {
        return err
    }
    
    // 5. 执行广告更新
    return s.googleAdsUpdater.UpdateFinalUrls(config.GoogleAdsAccountID, result.FinalUrl)
}
```

## 7. 技术实现要点

### 7.1 错误处理策略
- **分层错误处理**：每个层都有自己的错误处理逻辑
- **重试机制**：网络错误和临时错误自动重试
- **错误日志**：详细记录错误信息和上下文
- **优雅降级**：部分失败不影响整体流程

### 7.2 性能优化
- **并发控制**：使用goroutine池控制并发数
- **缓存策略**：缓存Google Ads客户端和配置信息
- **批量处理**：Google Ads API批量操作
- **资源管理**：及时释放浏览器资源

### 7.3 安全考虑
- **敏感信息加密**：OAuth token加密存储
- **访问控制**：基于用户ID的数据隔离
- **操作审计**：记录所有关键操作
- **网络安全**：HTTPS和API签名验证

## 8. 监控和告警

### 8.1 执行监控
- 成功率统计
- 执行时间分布
- 错误类型分析
- Token消耗统计

### 8.2 告警规则
- 连续失败超过3次
- 执行时间超过5分钟
- Token余额不足
- 外部服务不可用

## 9. 测试方案

### 9.1 单元测试
- 配置验证逻辑
- URL解析和清理
- 错误处理逻辑
- Token消费计算

### 9.2 集成测试
- 端到端自动化流程
- AdsPower连接测试
- Google Ads API测试
- Token系统集成测试

## 10. 部署要求

### 10.1 环境要求
- Go 1.19+
- MySQL 8.0+
- Redis 6+ (可选)
- AdsPower软件

### 10.2 配置要求
- AdsPower API配置
- Google Ads API配置
- Token系统集成
- 监控和日志配置

## 11. 版本规划

### 11.1 v1.0 (MVP)
- 基本的链接提取和更新功能
- 单账户支持
- 手动执行模式
- 基础监控

### 11.2 v1.1
- 多账户批量处理
- 定时执行功能
- 详细的执行报告
- 性能优化

### 11.3 v1.2
- 智能重试机制
- 高级过滤功能
- API限流优化
- 企业级功能

## 12. 总结

Chengelink功能基于Linus Torvalds的设计原则：

1. **数据结构优先**：设计简洁明了的数据结构
2. **消除特殊情况**：避免复杂的条件分支和特殊情况
3. **简单直接**：每个组件只做一件事，并做好
4. **实用主义**：满足实际业务需求，不过度设计

这个设计确保了功能的可维护性、可扩展性和稳定性，同时保持了代码的简洁性。