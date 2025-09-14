# AdsCenter 可扩展架构设计

## 架构概述

基于现有代码基础，采用模块化、服务化的架构设计，确保系统可扩展性、可维护性和高性能。

## 核心架构层次

### 1. 表现层 (Presentation Layer)
```
src/app/adscenter/
├── page.tsx                    # 主入口页面
├── components/                 # UI组件
│   ├── SetupWizard.tsx        # 设置向导
│   ├── ConfigurationManager.tsx # 配置管理
│   ├── ExecutionMonitor.tsx   # 执行监控
│   └── ReportsDashboard.tsx    # 报告仪表板
└── hooks/                      # React Hooks
```

### 2. 应用层 (Application Layer)
```
src/app/adscenter/
├── services/                   # 业务服务
│   ├── AdsPowerService.ts     # AdsPower集成服务
│   ├── GoogleAdsService.ts    # Google Ads服务
│   ├── LinkExtractionService.ts # 链接提取服务
│   └── SchedulingService.ts   # 调度服务
└── workflows/                 # 工作流编排
    ├── LinkUpdateWorkflow.ts  # 链接更新工作流
    └── DataCollectionWorkflow.ts # 数据收集工作流
```

### 3. 领域层 (Domain Layer)
```
src/app/adscenter/
├── models/                    # 领域模型
│   ├── Configuration.ts       # 配置模型
│   ├── Execution.ts           # 执行模型
│   ├── AdsAccount.ts         # 广告账户模型
│   └── LinkMapping.ts        # 链接映射模型
├── repositories/             # 数据仓库
│   ├── ConfigurationRepository.ts
│   ├── ExecutionRepository.ts
│   └── AdsAccountRepository.ts
└── interfaces/               # 领域接口
    ├── IAdsPowerClient.ts
    ├── IGoogleAdsClient.ts
    └── ILinkExtractor.ts
```

### 4. 基础设施层 (Infrastructure Layer)
```
src/lib/
├── database/                 # 数据库服务
│   ├── LocalDatabase.ts      # 本地数据库
│   └── EncryptionService.ts   # 加密服务
├── api/                      # API客户端
│   ├── AdsPowerApiClient.ts  # AdsPower API客户端
│   └── GoogleAdsApiClient.ts # Google Ads API客户端
└── monitoring/               # 监控服务
    └── PerformanceMonitor.ts
```

## 核心服务设计

### 1. 配置管理服务 (ConfigurationService)
```typescript
interface ConfigurationService {
  // AdsPower配置
  manageAdsPowerConfig(config: AdsPowerConfig): Promise<void>;
  getAdsPowerConfigs(): Promise<AdsPowerConfig[]>;
  
  // Google Ads配置
  manageGoogleAdsConfig(config: GoogleAdsConfig): Promise<void>;
  getGoogleAdsConfigs(): Promise<GoogleAdsConfig[]>;
  
  // 链接映射配置
  manageLinkMapping(mapping: LinkMapping): Promise<void>;
  getLinkMappings(): Promise<LinkMapping[]>;
}
```

### 2. 链接提取服务 (LinkExtractionService)
```typescript
interface LinkExtractionService {
  extractFinalUrl(affiliateUrl: string, config: AdsPowerConfig): Promise<ExtractedUrl>;
  batchExtractUrls(urls: string[], config: AdsPowerConfig): Promise<ExtractedUrl[]>;
}
```

### 3. Google Ads更新服务 (GoogleAdsUpdateService)
```typescript
interface GoogleAdsUpdateService {
  updateAdFinalUrl(accountId: string, adId: string, finalUrl: string, finalUrlSuffix: string): Promise<void>;
  batchUpdateAds(updates: AdUpdateRequest[]): Promise<AdUpdateResult[]>;
}
```

### 4. 执行编排服务 (ExecutionOrchestrationService)
```typescript
interface ExecutionOrchestrationService {
  executeLinkUpdateWorkflow(config: ExecutionConfig): Promise<ExecutionResult>;
  scheduleExecution(config: ScheduleConfig): Promise<void>;
  getExecutionStatus(executionId: string): Promise<ExecutionStatus>;
}
```

## 数据模型设计

### 1. 配置模型
```typescript
interface AdsPowerConfig {
  id: string;
  name: string;
  environmentId: string;
  openCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface GoogleAdsConfig {
  id: string;
  accountName: string;
  customerId: string;
  refreshToken: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LinkMapping {
  id: string;
  affiliateUrl: string;
  googleAdsConfigId: string;
  adGroupId: string;
  adId: string;
  isActive: boolean;
  lastUpdated: Date;
}
```

### 2. 执行模型
```typescript
interface Execution {
  id: string;
  type: 'LINK_UPDATE' | 'DATA_COLLECTION';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  config: ExecutionConfig;
  startTime?: Date;
  endTime?: Date;
  results: ExecutionResult[];
  logs: ExecutionLog[];
  error?: string;
}

interface ExecutionResult {
  adId: string;
  originalUrl: string;
  extractedUrl: string;
  finalUrl: string;
  finalUrlSuffix: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  processingTime: number;
}
```

## API设计

### 1. 配置管理API
```typescript
// POST /api/adscenter/configurations/adspower
// GET /api/adscenter/configurations/adspower
// PUT /api/adscenter/configurations/adspower/:id
// DELETE /api/adscenter/configurations/adspower/:id

// POST /api/adscenter/configurations/google-ads
// GET /api/adscenter/configurations/google-ads
// PUT /api/adscenter/configurations/google-ads/:id
// DELETE /api/adscenter/configurations/google-ads/:id

// POST /api/adscenter/configurations/link-mappings
// GET /api/adscenter/configurations/link-mappings
```

### 2. 执行管理API
```typescript
// POST /api/adscenter/executions
// GET /api/adscenter/executions
// GET /api/adscenter/executions/:id
// POST /api/adscenter/executions/:id/cancel
// GET /api/adscenter/executions/:id/logs
```

### 3. 数据报告API
```typescript
// GET /api/adscenter/reports/ads-performance
// GET /api/adscenter/reports/execution-history
// GET /api/adscenter/reports/system-health
```

## 安全设计

### 1. 数据加密
- 本地数据库敏感数据加密存储
- 传输数据HTTPS加密
- API密钥安全存储

### 2. 访问控制
- 基于角色的访问控制
- API访问频率限制
- 操作日志审计

### 3. 错误处理
- 统一错误处理机制
- 详细的错误日志记录
- 用户友好的错误提示

## 性能优化

### 1. 缓存策略
- 配置数据本地缓存
- API响应缓存
- 数据库查询优化

### 2. 并发处理
- 批量操作并发控制
- 资源池管理
- 异步任务处理

### 3. 监控告警
- 系统性能监控
- 错误率监控
- 资源使用监控

## 部署架构

### 1. 前端部署
- Vercel平台部署
- 环境变量管理
- 静态资源优化

### 2. 数据存储
- 本地SQLite数据库
- 数据加密存储
- 定期备份机制

### 3. 第三方集成
- Google Ads API集成
- AdsPower本地API集成
- 邮件服务集成

这个架构设计确保了系统的可扩展性、可维护性和高性能，同时保持了实用主义的设计理念，避免了过度设计。