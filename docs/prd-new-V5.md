# AutoAds 多用户 SaaS 系统重构 PRD V5.0

## 文档信息
- **项目名称**: AutoAds 多用户 SaaS 系统
- **版本**: v5.0
- **创建日期**: 2025-01-09
- **最后更新**: 2025-09-10
- **负责人**: 产品团队
- **优化说明**: 
  - V5.0：全面梳理文档结构，消除歧义和不一致，精简内容保持核心完整性

## 执行摘要

AutoAds 正在从 Next.js 单体应用重构为基于 GoFly 框架的多用户 SaaS 系统。当前系统已实现完整的用户认证、权限管理和三大核心功能，包括：✅ BatchOpen（批量访问，已实现三种模式）、✅ SiteRank（网站排名，已集成真实SimilarWeb API）、❌ AdsCenter（Google Ads管理，仅有UI原型）。重构目标是将现有功能（BatchOpen→BatchGo、SiteRank→SiteRankGo、AdsCenter→AdsCenterGo）迁移至 Go 语言 + GoFly 架构，实现4900%性能提升（从1并发提升到50并发）和专业的后台管理系统。

## 1. 项目概述

### 1.1 现有项目分析

#### 分析来源
基于实际代码库分析（2025-09-10）

#### 当前项目状态
AutoAds 是一个基于 Next.js 的自动化营销平台，三大核心功能实现状态：
- **✅ BatchOpen（批量访问）**: 完整实现三种执行模式（Basic/Silent/Automated）
- **✅ SiteRank（网站排名）**: 完整实现，已集成真实SimilarWeb API，支持批量查询和缓存
- **❌ AdsCenter（Google Ads管理）**: 仅有UI界面，无后端API实现

#### 技术栈现状
**前端技术栈**:
- Next.js 14 + React 18 + TypeScript
- MUI v7 + Tailwind CSS
- Zustand 状态管理
- NextAuth.js v5 认证

**后端技术栈**:
- Next.js API Routes（无Go语言实现）
- MySQL + Prisma ORM
- Redis（用于缓存）
- Puppeteer 浏览器自动化

**外部集成**:
- Google OAuth 2.0（认证）
- SimilarWeb API（已集成）
- Google Ads API（未集成）
- AdsPower API（未集成）

### 1.2 实际架构状态

#### 当前实现状态
- [x] 已完成多用户支持（Next.js + MySQL）
- [x] 已实现基础认证系统（Google OAuth + 管理员密码）
- [x] 已实现BatchOpen功能（三种模式）
- [x] 已集成SiteRank SimilarWeb API
- [ ] 未使用Go语言后端（仍使用Next.js API Routes）
- [ ] 未集成GoFly框架（计划重构为GoFly架构）

#### 当前架构
基于Next.js的全栈应用，通过用户ID实现数据隔离，前端使用React组件，后端使用API Routes，数据库为MySQL。计划重构为GoFly单体应用+模块化设计架构。

#### 功能实现状态
- [x] 用户认证系统（Google OAuth + 管理员密码）
- [x] Token订阅系统（完整实现）
- [x] BatchOpen功能（三种模式完整实现）
- [x] SiteRank功能（已集成SimilarWeb API）
- [ ] AdsCenter功能（仅UI，无后端）

### 1.3 目标和背景

#### 核心目标
1. **架构升级**: 从Node.js单体应用演进为Go单体应用+模块化设计，提升系统可扩展性
2. **性能提升**: 利用Go语言并发优势，实现核心功能并发性能提升4900%（从1并发提升到50并发）
3. **多用户支持**: 实现用户注册登录和多用户数据隔离
4. **后台管理**: 集成GoFly框架，提供专业的后台管理系统
5. **业务连续性**: 保持所有现有功能的完整性和前端布局

#### 背景上下文
随着 AutoAds 用户规模增长和业务复杂度提升，现有架构面临以下挑战：
1. **扩展性瓶颈**: Node.js单进程架构难以支持高并发
2. **多用户需求**: 需要支持多个用户独立使用系统
3. **管理复杂度**: 缺乏统一的后台管理系统
4. **性能限制**: 大批量任务处理效率有待提升
5. **权限控制**: 需要细化不同版本功能的权限控制

## 2. 命名说明

### 2.1 现有功能与重构版本的命名区分

为清晰区分现有Next.js实现和Go重构版本，特此说明：

- **现有功能（Next.js实现）**:
  - BatchOpen：批量访问功能
  - SiteRank：网站排名功能  
  - AdsCenter：Google Ads管理功能

- **重构版本（Go实现）**:
  - BatchGo：BatchOpen的Go重构版本
  - SiteRankGo：SiteRank的Go重构版本
  - AdsCenterGo：AdsCenter的Go重构版本

**API路由统一规范**:
- 用户API: `/api/v1/batchgo/*`, `/api/v1/siterankgo/*`, `/api/v1/adscentergo/*`
- 管理API: `/admin/api/*`

所有重构将保持API兼容性，前端无需修改即可切换到新的Go后端。

## 3. 需求分析

### 3.1 功能需求（Functional Requirements）

#### FR1: 用户认证系统
- **FR1.1**: 实现普通用户邮箱注册流程，包括邮箱验证
- **FR1.2**: 集成 Google OAuth2.0 一键登录功能
- **FR1.3**: 用户资料管理（头像、昵称、联系方式等）
- **FR1.4**: 用户密码重置和账号安全设置
- **FR1.5**: 登录状态保持和自动续期

#### FR2: 管理员系统
- **FR2.1**: 初始化管理员账号（用户名: admin，密码可配置），不提供注册功能
- **FR2.2**: 管理员通过账号密码登录GoFly Admin后台管理系统
- **FR2.3**: 管理员可管理所有用户账号
- **FR2.4**: 管理员可查看系统运行状态和日志
- **FR2.5**: 管理员可配置系统参数和权限

#### FR3: 用户权限与套餐管理
- **FR3.1**: 三级用户套餐体系（Free/Pro/Max）
- **FR3.2**: 不同套餐对应不同的功能权限和使用限制
- **FR3.3**: 管理员可手动调整用户套餐
- **FR3.4**: 用户可查看当前套餐和使用情况
- **FR3.5**: 套餐权限实时生效机制
- **FR3.6**: 新用户注册自动获得14天Pro套餐
- **FR3.7**: 邀请注册机制（邀请者和被邀请者各得30天Pro）
- **FR3.8**: 套餐到期自动降级机制
- **FR3.9**: 试用期叠加规则：
  - 新用户注册：14天Pro
  - 邀请注册：30天Pro（不与新用户奖励叠加）
  - 多次邀请：可累加，最长365天
  - 试用期间不能再次获得试用

#### FR4: BatchGo 模块
- **FR4.1**: 完整迁移三种执行模式（Basic/Silent/Automated）到Go语言架构
- **FR4.2**: 基于 Go 实现高并发任务处理，支持万级日处理任务规模
- **FR4.3**: **HTTP访问模式**（重构目标）：
  - 后端HTTP请求实现
  - 支持代理轮换和Referer伪装
  - 请求结果和响应时间记录
- **FR4.4**: **Puppeteer访问模式**（重构目标）：
  - 基于Chromium的无头浏览器
  - 支持页面截图和交互
  - 资源占用优化和进程管理
- **FR4.5**: **Basic版本权限**：
  - Free套餐：支持Basic版本（前端标签页打开）
  - Pro套餐：支持Basic + Silent版本
  - Max套餐：支持所有版本（Basic + Silent + Automated）
- **FR4.6**: **Silent 版本权限**：
  - 支持HTTP和Puppeteer两种执行方式
  - 后台异步执行，支持进度查询
- **FR4.7**: **Automated 版本权限**：
  - 仅Pro和Max套餐可用
  - 支持复杂交互和自动化操作
  - 支持大规模并发执行（最多50线程）
- **FR4.8**: 代理配置和轮换机制
- **FR4.9**: 任务结果统计和分析

#### FR5: SiteRankGo 模块
- **FR5.1**: 完整迁移SimilarWeb API集成到Go架构
- **FR5.2**: 支持批量域名排名查询
- **FR5.3**: 实现智能缓存策略，减少API调用
- **FR5.4**: 支持历史数据对比和趋势分析
- **FR5.5**: 根据套餐限制查询数量（Free:100, Pro:500, Max:5000）

#### FR6: AdsCenterGo 模块
- **FR6.1**: 实现Google Ads OAuth完整集成
  - 支持OAuth 2.0授权流程
  - 自动刷新access token
  - 安全存储凭据（加密）
  - 支持多账户授权管理
- **FR6.2**: 支持多广告账户管理
  - 账户信息同步（账户名、ID、状态）
  - 账户权限验证
  - 账户状态监控
  - 批量账户操作
- **FR6.3**: 链接提取和批量替换功能
  - 自动扫描广告组中的所有链接
  - 支持URL模式匹配和替换
  - 批量链接更新（支持预览）
  - 替换规则配置管理
  - 执行日志和回滚功能
- **FR6.4**: 集成AdsPower浏览器自动化
  - 支持多浏览器配置文件管理
  - 自动化登录和操作
  - 截图和操作记录
  - 异常处理和恢复机制
- **FR6.5**: 任务执行状态实时监控
  - WebSocket实时状态推送
  - 任务队列管理
  - 进度跟踪和时间预估
  - 异常告警和自动重试
- **FR6.6**: 执行结果详细报告
  - 执行统计（成功/失败/跳过）
  - 详细的操作日志
  - 执行时间分析
  - 结果导出（CSV/Excel）
  - 失败原因分析和建议

#### FR7: Token 经济系统
- **FR7.1**: 功能使用消耗Token机制
- **FR7.2**: 不同模式不同消耗策略
- **FR7.3**: Token充值和消费记录
- **FR7.4**: 余额不足预警机制
- **FR7.5**: 任务失败Token自动返还

#### FR8: 通用功能
- **FR8.1**: 响应式设计（支持移动端）
- **FR8.2**: 深色/浅色主题切换
- **FR8.3**: 多语言支持（中文/英文）
- **FR8.4**: 实时通知系统
- **FR8.5**: 数据导出功能（CSV/Excel）
- **FR8.6**: API限流和防护

#### FR9: 管理后台功能
- **FR9.1**: 用户管理界面
- **FR9.2**: 系统配置管理
- **FR9.3**: 任务监控面板
- **FR9.4**: 数据统计报表
- **FR9.5**: Token交易记录查看
- **FR9.6**: 系统日志查看
- **FR9.7**: 套餐管理功能
- **FR9.8**: 支付记录查看（仅Token充值记录，无自动订阅扣费）

#### FR10: 支付系统说明
- **FR10.1**: **当前采用手动咨询模式**：
  - **套餐订阅**：用户点击"立即订阅"按钮弹出咨询窗口，添加微信好友，通过与管理员沟通后手动开通
  - **Token充值**：用户点击Token充值包的"立即订阅"按钮弹出咨询窗口，添加微信好友，管理员审核后手动充值
  - 不集成Stripe等自动支付系统
  - 无自动续费和定期扣费机制
  - 所有交易都通过管理员手动处理

### 3.2 非功能需求（Non-Functional Requirements）

#### NFR1: 性能需求
- **NFR1.1**: 系统响应时间降低 50%（P95 < 200ms）
- **NFR1.2**: 支持 5,000+ 用户并发在线
- **NFR1.3**: BatchGo 并发处理能力提升 4900%（支持 50 并发）
- **NFR1.4**: SiteRankGo 查询响应时间 < 500ms
- **NFR1.5**: 系统可用性 99.9%

#### NFR2: 安全需求
- **NFR2.1**: 用户数据完全隔离，防止数据泄露
- **NFR2.2**: JWT + OAuth2.0 认证机制
- **NFR2.3**: 管理员后台独立登录入口
- **NFR2.4**: 敏感数据加密存储
- **NFR2.5**: 完整的操作审计日志

#### NFR3: 数据库需求
- **NFR3.1**: 使用 MySQL 8.0 作为主数据库（全新部署，无需数据迁移）
- **NFR3.2**: 使用 Redis 7.0 作为缓存和会话存储
- **NFR3.3**: 支持数据库连接池和读写分离
- **NFR3.4**: 数据定期备份和恢复机制

#### NFR4: 可扩展性需求
- **NFR4.1**: 模块化架构支持水平扩展
- **NFR4.2**: 支持动态服务发现和负载均衡
- **NFR4.3**: 配置支持热更新
- **NFR4.4**: 支持功能模块的动态加载

#### NFR5: 可维护性需求
- **NFR5.1**: 完整的技术文档和 API 文档
- **NFR5.2**: 代码覆盖率 > 80%
- **NFR5.3**: 统一的代码规范和格式化
- **NFR5.4**: 自动化测试和 CI/CD 流程

### 3.3 兼容性需求（Compatibility Requirements）

#### CR1: 数据配置
- **CR1.1**: 使用新的 MySQL 数据库，无需数据迁移
- **CR1.2**: 数据库连接使用环境变量 DATABASE_URL
- **CR1.3**: Redis 连接使用环境变量 REDIS_URL
- **CR1.4**: 遵循 docs/MustKnow.md 中的配置信息

#### CR2: 功能兼容性
- **CR2.1**: 三大核心功能 100% 兼容
- **CR2.2**: BatchGo 支持 HTTP 和 Puppeteer 两种访问模式
- **CR2.3**: 用户体验保持一致

#### CR3: 界面兼容性
- **CR3.1**: 保持现有页面布局结构
- **CR3.2**: 优化 UI 但不改变核心交互
- **CR3.3**: 支持现有快捷键和操作习惯

### 3.4 用户套餐权限矩阵

#### 套餐配置详情

**免费套餐（Free）**:
- 价格：免费
- 包含 1,000 tokens/月
- BatchOpen：Basic 版本（前端标签页打开）
- SiteRank：批量查询 100 个域名/次
- API 限制：30 次/分钟

**高级套餐（Pro）**:
- 价格：¥298/月（年付 ¥1,788，优惠 40%）
- 包含 10,000 tokens/月
- 所有免费套餐功能
- BatchOpen：Silent 版本（支持HTTP和Puppeteer）
- SiteRank：批量查询 500 个域名/次
- API 限制：100 次/分钟

**白金套餐（Max）**:
- 价格：¥998/月（年付 ¥5,988，优惠 40%）
- 包含 100,000 tokens/月
- 所有 Pro 套餐功能
- BatchOpen：Automated 版本（支持复杂交互）
- SiteRank：批量查询 5,000 个域名/次
- API 限制：500 次/分钟
- 专属客户经理

#### 功能权限矩阵

| 功能模块 | Free | Pro | Max |
|---------|------|-----|-----|
| **用户认证** | ✓ | ✓ | ✓ |
| **BatchGo Basic** | ✓ (前端打开) | ✓ (前端打开) | ✓ (前端打开) |
| **BatchGo Silent** | ✗ | ✓ (HTTP+Puppeteer) | ✓ (HTTP+Puppeteer) |
| **BatchGo Automated** | ✗ | ✗ | ✓ (HTTP+Puppeteer) |
| **SiteRankGo** | ✓ (100个) | ✓ (500个) | ✓ (5000个) |
| **AdsCenterGo** | ✗ | ✓ (基础功能) | ✓ (全部功能) |
| **并发任务数** | 1 | 5 | 50 |
| **API调用频率** | 30/分钟 | 100/分钟 | 500/分钟 |

### 3.5 Token 充值价格

**Token 充值包**（充值越多，折扣越大）:
- 小包: ¥99 = 10,000 tokens
- 中包: ¥299 = 50,000 tokens (约 40% off)
- 大包: ¥599 = 200,000 tokens (约 67% off)
- 超大包: ¥999 = 500,000 tokens (约 80% off)

## 4. 技术架构设计

### 4.1 整体架构

#### 4.1.1 架构模式

**当前架构（Next.js）**:
- 前端：Next.js + React + TypeScript
- 后端：Next.js API Routes
- 数据库：MySQL + Prisma ORM
- 缓存：Redis

**目标架构（GoFly）**:
- 前端：Next.js + TypeScript（保持现有）
- 后端：Go + GoFly Admin V3 框架
  - 内置RBAC权限管理
  - 自动化CRUD生成
  - 统一的API网关
  - 插件化中间件系统
- 数据层：MySQL 8.0（无需数据迁移）
- 缓存层：Redis 7.0（GoFly内置缓存支持）
- ORM层：GoFly gform（基于GORM增强）

**重要说明**：
1. **无需数据库迁移**：直接使用新数据库，避免迁移风险
2. **无需系统共存**：直接实现目标架构，简化开发和部署
3. **保持前端兼容**：前端应用只需修改API接口地址

#### 4.1.2 目标部署架构
```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                GoFly Application (Single Instance)          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │   BatchGo      │ │  SiteRankGo    │ │  AdsCenterGo   │ │
│  │   Module       │ │   Module       │ │   Module       │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  User Service  │ │  Auth Service  │ │  Admin Service │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     Data Layer                              │
│  ┌─────────────────┐            ┌─────────────────────────┐ │
│  │   MySQL 8.0     │            │        Redis 7.0        │ │
│  │   (Primary)     │            │   (Cache & Session)     │ │
│  └─────────────────┘            └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 数据库设计

#### 4.2.1 核心业务表

```sql
-- 用户表
CREATE TABLE users (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    email VARCHAR(191) NOT NULL UNIQUE,
    username VARCHAR(191),
    password_hash VARCHAR(255),         -- 移除UNIQUE约束，使用安全哈希
    avatar_url VARCHAR(500),
    role ENUM('USER', 'ADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'INACTIVE', 'BANNED') DEFAULT 'ACTIVE',
    token_balance INT DEFAULT 0,
    plan_id VARCHAR(191),
    trial_start_at DATETIME,
    trial_end_at DATETIME,
    trial_source VARCHAR(191),
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_plan_id (plan_id)
);

-- 套餐表
CREATE TABLE plans (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    name VARCHAR(191) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'CNY',   -- 统一使用人民币
    interval ENUM('DAY', 'WEEK', 'MONTH', 'YEAR') DEFAULT 'MONTH',
    features JSON,
    metadata JSON,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    external_reference_id VARCHAR(191),  -- 用于关联外部支付系统记录
    token_quota INT DEFAULT 0,
    token_reset VARCHAR(191) DEFAULT 'MONTHLY',
    billing_period VARCHAR(191) DEFAULT 'MONTHLY',
    rate_limit INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_is_active (is_active),
    INDEX idx_sort_order (sort_order)
);

-- 订阅表
CREATE TABLE subscriptions (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    plan_id VARCHAR(191) NOT NULL,
    status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING') DEFAULT 'PENDING',
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    trial_end_date DATETIME,
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Token交易表
CREATE TABLE token_transactions (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    type ENUM('CONSUME', 'RECHARGE', 'BONUS', 'REFUND') NOT NULL,
    amount INT NOT NULL,
    balance_before INT NOT NULL,
    balance_after INT NOT NULL,
    source ENUM('SUBSCRIPTION', 'PURCHASE', 'ACTIVITY', 'REFERRAL', 'CHECKIN', 'OTHER'),
    description TEXT,
    feature ENUM('BATCHGO', 'SITERANKGO', 'ADSCENTERGO', 'OTHER') DEFAULT 'OTHER',
    expires_at DATETIME,                 -- Token过期时间
    priority INT DEFAULT 0,             -- 优先级：订阅=10，活动=5，购买=0
    related_id VARCHAR(191),            -- 关联业务ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_source (source),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Token使用记录表
CREATE TABLE token_usage (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    feature ENUM('BATCHGO', 'SITERANKGO', 'ADSCENTERGO', 'OTHER') NOT NULL,
    amount INT NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_feature (feature),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BatchGo任务表
CREATE TABLE batchgo_tasks (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    name VARCHAR(500) NOT NULL,
    mode ENUM('BASIC', 'SILENT', 'AUTOMATED') NOT NULL,
    execution_mode ENUM('HTTP', 'PUPPETEER'),
    urls JSON NOT NULL,                  -- URL列表
    proxy_config JSON,                   -- 代理配置
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    progress INT DEFAULT 0,             -- 0-100
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    cycle_count INT DEFAULT 1,           -- 循环次数
    current_cycle INT DEFAULT 1,         -- 当前循环
    interval_ms INT DEFAULT 200,         -- 执行间隔（毫秒）
    max_concurrent INT DEFAULT 1,        -- 最大并发数
    result_summary JSON,                -- 结果汇总
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_mode (mode),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BatchGo任务执行记录表
CREATE TABLE batchgo_executions (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    task_id VARCHAR(191) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    proxy_ip VARCHAR(50),
    status ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT') DEFAULT 'PENDING',
    response_time INT,                   -- 响应时间（毫秒）
    status_code INT,
    error_message TEXT,
    screenshot_url VARCHAR(500),         -- 截图URL（Puppeteer模式）
    executed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_executed_at (executed_at),
    FOREIGN KEY (task_id) REFERENCES batchgo_tasks(id) ON DELETE CASCADE
);

-- SiteRankGo查询表
CREATE TABLE siterankgo_queries (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    domains JSON NOT NULL,               -- 域名列表
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL') DEFAULT 'PENDING',
    progress INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    result_summary JSON,                 -- 查询结果汇总
    error_message TEXT,
    cached_count INT DEFAULT 0,         -- 缓存命中数
    api_calls INT DEFAULT 0,             -- API调用次数
    started_at DATETIME,
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SiteRankGo查询结果表
CREATE TABLE siterankgo_results (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    query_id VARCHAR(191) NOT NULL,
    domain VARCHAR(500) NOT NULL,
    data JSON,                           -- SimilarWeb返回的完整数据
    from_cache BOOLEAN DEFAULT false,     -- 是否来自缓存
    error_message TEXT,
    queried_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_id (query_id),
    INDEX idx_domain (domain),
    INDEX idx_from_cache (from_cache),
    FOREIGN KEY (query_id) REFERENCES siterankgo_queries(id) ON DELETE CASCADE
);

-- AdsCenterGo账户表
CREATE TABLE adscentergo_accounts (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    platform ENUM('GOOGLE_ADS', 'ADSPOWER') NOT NULL,
    account_name VARCHAR(500) NOT NULL,
    account_id VARCHAR(191),             -- 平台账户ID
    credentials JSON,                    -- 加密存储的凭据
    status ENUM('ACTIVE', 'INACTIVE', 'ERROR') DEFAULT 'ACTIVE',
    last_sync_at DATETIME,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_platform (platform),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AdsCenterGo任务表
CREATE TABLE adscentergo_tasks (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    account_id VARCHAR(191) NOT NULL,
    name VARCHAR(500) NOT NULL,
    type ENUM('LINK_REPLACE', 'CAMPAIGN_SYNC', 'BID_UPDATE') NOT NULL,
    config JSON NOT NULL,                -- 任务配置
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    progress INT DEFAULT 0,
    result_summary JSON,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_status (status),
    INDEX idx_type (type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES adscentergo_accounts(id) ON DELETE CASCADE
);

-- 邀请码表
CREATE TABLE invitations (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    inviter_id VARCHAR(191) NOT NULL,
    invitee_id VARCHAR(191),
    code VARCHAR(191) NOT NULL UNIQUE,
    status ENUM('PENDING', 'USED', 'EXPIRED') DEFAULT 'PENDING',
    reward_days INT DEFAULT 30,
    expires_at DATETIME,
    used_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inviter_id (inviter_id),
    INDEX idx_invitee_id (invitee_id),
    INDEX idx_code (code),
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 咨询申请表
CREATE TABLE consultation_requests (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191),
    type ENUM('PLAN_SUBSCRIPTION', 'TOKEN_RECHARGE') NOT NULL,
    request_data JSON NOT NULL,         -- 请求数据（套餐ID、数量等）
    contact_info JSON NOT NULL,         -- 联系方式
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    admin_notes TEXT,
    processed_by VARCHAR(191),
    processed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- 管理员账户表
CREATE TABLE admin_accounts (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    username VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(191),
    role ENUM('SUPER_ADMIN', 'ADMIN', 'OPERATOR') DEFAULT 'ADMIN',
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    last_login_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_status (status)
);

-- 业务账户表（用于GoFly集成）
CREATE TABLE business_accounts (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL UNIQUE,
    business_name VARCHAR(500),
    business_type VARCHAR(191),
    contact_person VARCHAR(191),
    contact_phone VARCHAR(50),
    business_license VARCHAR(500),
    status ENUM('PENDING', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 管理员登录日志表
CREATE TABLE admin_login_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    admin_id VARCHAR(191) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    login_status ENUM('SUCCESS', 'FAILED') NOT NULL,
    failure_reason VARCHAR(500),
    login_at DATETIME NOT NULL,
    INDEX idx_admin_id (admin_id),
    INDEX idx_login_at (login_at),
    INDEX idx_login_status (login_status),
    FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
);

-- 用户邮箱验证表
CREATE TABLE user_email_verifications (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    token VARCHAR(191) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户邀请码表（独立管理）
CREATE TABLE user_invite_codes (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    code VARCHAR(191) NOT NULL UNIQUE,
    status ENUM('ACTIVE', 'USED', 'EXPIRED') DEFAULT 'ACTIVE',
    usage_limit INT DEFAULT 1,
    usage_count INT DEFAULT 0,
    expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_code (code),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- GoFly权限角色表
CREATE TABLE admin_auth_roles (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    name VARCHAR(191) NOT NULL UNIQUE,
    description TEXT,
    permissions JSON,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_name (name)
);

-- GoFly权限规则表
CREATE TABLE admin_auth_rules (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    parent_id VARCHAR(191),
    name VARCHAR(191) NOT NULL,
    title VARCHAR(191) NOT NULL,
    icon VARCHAR(191),
    path VARCHAR(191),
    component VARCHAR(191),
    permission VARCHAR(191),
    type ENUM('MENU', 'BUTTON', 'API') DEFAULT 'MENU',
    sort_order INT DEFAULT 0,
    is_hidden BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_parent_id (parent_id),
    INDEX idx_type (type),
    INDEX idx_sort_order (sort_order),
    FOREIGN KEY (parent_id) REFERENCES admin_auth_rules(id) ON DELETE SET NULL
);

-- AdsCenterGo链接替换规则表
CREATE TABLE adscentergo_replace_rules (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    name VARCHAR(500) NOT NULL,
    pattern VARCHAR(1000) NOT NULL,     -- URL匹配模式（正则表达式）
    replacement VARCHAR(1000) NOT NULL, -- 替换规则
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AdsCenterGo执行日志表
CREATE TABLE adscentergo_execution_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id VARCHAR(191) NOT NULL,
    execution_id VARCHAR(191),
    level ENUM('INFO', 'WARN', 'ERROR', 'DEBUG') DEFAULT 'INFO',
    message TEXT NOT NULL,
    metadata JSON,                        -- 额外的日志数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_id (task_id),
    INDEX idx_execution_id (execution_id),
    INDEX idx_level (level),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (task_id) REFERENCES adscentergo_tasks(id) ON DELETE CASCADE
);

-- AdsCenterGoOAuth凭据表
CREATE TABLE adscentergo_oauth_credentials (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    account_id VARCHAR(191) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at DATETIME,
    scope VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_account_id (account_id),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (account_id) REFERENCES adscentergo_accounts(id) ON DELETE CASCADE
);

-- Token消耗规则表
CREATE TABLE token_consumption_rules (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    feature ENUM('BATCHGO', 'SITERANKGO', 'ADSCENTERGO', 'OTHER') NOT NULL,
    operation VARCHAR(191) NOT NULL,       -- 操作类型（如：HTTP访问、Puppeteer访问等）
    condition VARCHAR(500),               -- 执行条件（JSON格式）
    amount INT NOT NULL DEFAULT 1,        -- 消耗数量
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,               -- 优先级，数字越大优先级越高
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_feature (feature),
    INDEX idx_is_active (is_active),
    INDEX idx_priority (priority)
);

-- Token预扣费记录表
CREATE TABLE token_pre_deductions (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    feature ENUM('BATCHGO', 'SITERANKGO', 'ADSCENTERGO', 'OTHER') NOT NULL,
    task_id VARCHAR(191) NOT NULL,
    amount INT NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED') DEFAULT 'PENDING',
    confirmed_amount INT DEFAULT 0,      -- 最终确认消耗数量
    metadata JSON,                        -- 相关元数据
    expires_at DATETIME,                  -- 预扣费过期时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Token优惠活动表
CREATE TABLE token_promotions (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    name VARCHAR(191) NOT NULL,
    type ENUM('RECHARGE_BONUS', 'CHECKIN', 'INVITE', 'ACTIVITY', 'BUG_REWARD') NOT NULL,
    description TEXT,
    config JSON NOT NULL,                 -- 活动配置（规则、奖励等）
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    is_active BOOLEAN DEFAULT true,
    max_participants INT,                -- 最大参与人数
    current_participants INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_type (type),
    INDEX idx_is_active (is_active),
    INDEX idx_date_range (start_date, end_date)
);

-- 用户参与活动记录表
CREATE TABLE user_promotion_participations (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
    promotion_id VARCHAR(191) NOT NULL,
    status ENUM('PENDING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    reward_amount INT DEFAULT 0,         -- 获得的token数量
    participation_data JSON,              -- 参与数据
    completed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_promotion (user_id, promotion_id),
    INDEX idx_user_id (user_id),
    INDEX idx_promotion_id (promotion_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (promotion_id) REFERENCES token_promotions(id) ON DELETE CASCADE
);
```

### 4.3 API 设计规范

#### 4.3.1 API 路由统一规范

**用户API前缀**: `/api/v1/`
- BatchGo: `/api/v1/batchgo/*`
- SiteRankGo: `/api/v1/siterankgo/*`
- AdsCenterGo: `/api/v1/adscentergo/*`

**管理API前缀**: `/admin/api/`
- 用户管理: `/admin/api/users/*`
- 套餐管理: `/admin/api/plans/*`
- 系统监控: `/admin/api/monitoring/*`

#### 4.3.2 RESTful API 设计原则

**URL 规范**:
- 使用 kebab-case 命名
- 资源名词复数形式
- API 版本控制：`/api/v1/`

**HTTP 方法使用**:
- GET：查询资源
- POST：创建资源
- PUT：更新资源（全量）
- PATCH：更新资源（部分）
- DELETE：删除资源

#### 4.3.3 统一响应格式

```json
{
  "code": 0,        // 0表示成功，非0表示错误
  "message": "成功", // 响应消息
  "data": {         // 响应数据
    // 具体数据内容
  },
  "pagination": {  // 分页信息（列表接口）
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

#### 4.3.4 错误码规范

| 错误码 | 含义 | 说明 |
|--------|------|------|
| 0 | 成功 | 请求成功 |
| 1000 | 参数错误 | 请求参数格式错误或缺失 |
| 1001 | 认证失败 | Token无效或过期 |
| 1002 | 权限不足 | 用户无权访问该资源 |
| 1003 | 资源不存在 | 请求的资源不存在 |
| 1004 | 余额不足 | Token余额不足 |
| 1005 | 频率限制 | 请求超过频率限制 |
| 2000 | 业务错误 | 具体业务逻辑错误 |
| 3000 | 系统错误 | 服务器内部错误 |

#### 4.3.5 分页参数规范

**请求参数**:
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20，最大100）
- `sort`: 排序字段（如：created_at_desc）

**响应格式**:
```json
{
  "code": 0,
  "message": "成功",
  "data": [
    // 数据列表
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

#### 4.3.6 长任务处理规范

对于耗时较长的任务（如BatchGo、SiteRankGo批量查询），采用以下模式：

1. **创建任务**：返回任务ID
2. **查询进度**：通过任务ID查询执行状态
3. **结果获取**：任务完成后获取结果

**可选的通知方式**:
- WebSocket实时推送
- SSE（Server-Sent Events）
- 轮询查询

#### 4.3.7 幂等性支持

所有写操作API支持Idempotency-Key头：
```http
POST /api/v1/batchgo/tasks
Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000
```

#### 4.3.2 核心 API 端点

**用户认证 API**:
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/oauth/google` - Google OAuth
- `POST /api/v1/auth/refresh` - 刷新 Token
- `POST /api/v1/auth/logout` - 用户登出

**BatchGo API**:
- `GET /api/v1/batchgo/tasks` - 获取任务列表
- `POST /api/v1/batchgo/tasks` - 创建任务
- `GET /api/v1/batchgo/tasks/{id}` - 获取任务详情
- `PUT /api/v1/batchgo/tasks/{id}` - 更新任务
- `DELETE /api/v1/batchgo/tasks/{id}` - 删除任务
- `POST /api/v1/batchgo/tasks/{id}/start` - 启动任务
- `POST /api/v1/batchgo/tasks/{id}/stop` - 停止任务

**SiteRankGo API**:
- `POST /api/v1/siterankgo/queries` - 创建查询
- `GET /api/v1/siterankgo/queries/{id}` - 获取查询结果
- `GET /api/v1/siterankgo/domains/{domain}/history` - 获取历史数据

**AdsCenterGo API**:
- `GET /api/v1/adscentergo/accounts` - 获取Google Ads账户列表
- `POST /api/v1/adscentergo/accounts` - 添加Google Ads账户
- `GET /api/v1/adscentergo/accounts/{id}` - 获取账户详情
- `PUT /api/v1/adscentergo/accounts/{id}` - 更新账户信息
- `DELETE /api/v1/adscentergo/accounts/{id}` - 删除账户
- `POST /api/v1/adscentergo/accounts/{id}/oauth` - OAuth授权
- `GET /api/v1/adscentergo/accounts/{id}/campaigns` - 获取广告活动列表
- `GET /api/v1/adscentergo/accounts/{id}/adgroups` - 获取广告组列表
- `POST /api/v1/adscentergo/link-extract` - 提取链接任务
- `POST /api/v1/adscentergo/link-replace` - 批量替换链接任务
- `GET /api/v1/adscentergo/tasks` - 获取任务列表
- `GET /api/v1/adscentergo/tasks/{id}` - 获取任务详情
- `POST /api/v1/adscentergo/tasks/{id}/start` - 启动任务
- `POST /api/v1/adscentergo/tasks/{id}/stop` - 停止任务
- `GET /api/v1/adscentergo/tasks/{id}/results` - 获取执行结果
- `GET /api/v1/adscentergo/tasks/{id}/logs` - 获取执行日志
- `GET /api/v1/adscentergo/adspower/profiles` - 获取AdsPower配置文件
- `POST /api/v1/adscentergo/adspower/launch` - 启动AdsPower浏览器

**Token API**:
- `GET /api/v1/tokens/balance` - 获取 Token 余额
- `GET /api/v1/tokens/transactions` - 获取交易记录
- `POST /api/v1/tokens/checkin` - 每日签到

### 4.4 安全设计

#### 4.4.1 认证授权

**JWT策略**:
- Access Token TTL: 2小时
- Refresh Token TTL: 30天
- 支持Token吊销（Redis黑名单）
- 支持并发会话控制（最多5个活跃设备）

**登录安全**:
- 管理员账号密码登录
- 登录失败次数限制
- 异常登录检测和通知

#### 4.4.2 数据安全

**敏感数据加密**:
- 密码：Argon2id哈希
- API密钥：AES-256-GCM加密
- 用户隐私数据：字段级加密

**数据脱敏**:
- 日志中的敏感信息自动脱敏
- 导出数据时自动脱敏
- 前端展示时自动脱敏

#### 4.4.3 访问控制

**RBAC权限模型**:
- 角色：USER、ADMIN、SUPER_ADMIN
- 权限点：模块级+操作级
- 数据权限：用户数据完全隔离

**API限流**:
- 基于用户套餐的分级限流
- 滑动窗口算法
- 支持Redis分布式限流

#### 4.4.4 输入验证

- 所有输入参数验证
- SQL注入防护
- XSS攻击防护
- CSRF防护
- 文件上传安全检查

### 4.5 GoFly 集成架构

#### 4.5.1 集成策略

基于现有 Next.js 前端，将后端迁移至 GoFly Admin V3 框架：

**架构设计**:
```
Frontend (Next.js) ←→ API Layer (Go + GoFly) ←→ Database (MySQL 8.0)
                     ↑
                GoFly Admin V3
```

**集成方案**:
1. **保持前端不变**：Next.js 继续负责 UI 渲染
2. **API 迁移**：将 Next.js API Routes 替换为 Go 实现
3. **GoFly 集成**：利用 GoFly 的管理后台和基础能力
4. **直接替换**：无需系统共存，直接实现目标架构，简化开发和部署

#### 4.5.2 GoFly 核心能力集成

**1. RBAC 权限系统**
- 用户角色管理：USER、ADMIN
- 权限点动态配置
- 数据权限自动过滤
- API 接口权限控制

**2. 自动化 CRUD 生成**
- 基于 GoFly gform 自动生成增删改查
- 支持复杂查询和分页
- 数据验证和过滤
- 操作日志自动记录

**3. 中间件系统**
- 认证中间件（JWT + Session）
- 权限中间件（RBAC 检查）
- 日志中间件（操作记录）
- 缓存中间件（性能优化）
- 限流中间件（API 防刷）

**4. 缓存系统**
- 多级缓存（内存 + Redis）
- 缓存标签支持
- 自动缓存失效
- 缓存预热和统计

**5. 配置管理**
- 环境变量配置
- 数据库配置管理
- 动态配置更新
- 配置版本控制

#### 4.5.3 模块化架构设计

**应用结构**:
```
gofly_admin_v3/
├── app/
│   ├── autoads/
│   │   ├── batchgo/         # BatchGo 模块
│   │   ├── siterankgo/      # SiteRankGo 模块
│   │   ├── adscentergo/     # AdsCenterGo 模块
│   │   ├── token/           # Token 管理模块
│   │   └── user/            # 用户管理模块
│   ├── admin/               # GoFly Admin 后台
│   ├── common/              # 公共模块
│   └── middleware/          # 中间件
├── config/                  # 配置文件
├── resource/                # 静态资源
├── utils/                   # 工具类
└── main.go                  # 入口文件
```

**模块规范**:
- 每个模块独立的路由、控制器、服务层
- 统一的错误处理和响应格式
- 标准化的 API 文档注释
- 模块间通过接口通信

#### 4.5.4 数据库集成

**ORM 集成**:
- 使用 GoFly gform（基于 GORM 增强）
- 自动数据库迁移
- 连接池优化
- 慢查询日志

**数据迁移策略**:
```go
// 主函数中
func main() {
    // 初始化 GoFly
    gofly.Init()
    
    // 自动迁移数据库表
    gofly.DB.AutoMigrate(
        &models.User{},
        &models.Plan{},
        &models.Subscription{},
        // ... 其他模型
    )
    
    // 运行服务器
    router.RunServer()
}
```

#### 4.5.5 API 网关设计

**统一入口**:
- 用户 API：`/api/v1/*`
- 管理 API：`/admin/api/*`
- 静态资源：`/static/*`
- GoFly Admin：`/admin/*`

**路由注册**:
```go
// 路由注册
func initRoutes() {
    // 用户 API
    api := router.Group("/api/v1")
    {
        auth := api.Group("/auth")
        {
            auth.POST("/register", authController.Register)
            auth.POST("/login", authController.Login)
            auth.POST("/oauth/google", authController.GoogleOAuth)
        }
        
        batchgo := api.Group("/batchgo").Use(middleware.Auth())
        {
            batchgo.GET("/tasks", batchgoController.ListTasks)
            batchgo.POST("/tasks", batchgoController.CreateTask)
            // ...
        }
    }
    
    // 管理 API
    admin := router.Group("/admin/api").Use(middleware.AdminAuth())
    {
        adminUsers := admin.Group("/users")
        {
            adminUsers.GET("", adminController.ListUsers)
            adminUsers.PUT("/:id", adminController.UpdateUser)
            // ...
        }
    }
}
```

#### 4.5.6 认证授权集成

**JWT 认证**:
```go
// JWT 中间件
func JWTAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"code": 1001, "message": "未授权"})
            c.Abort()
            return
        }
        
        // 验证 token
        claims, err := jwt.ParseToken(token)
        if err != nil {
            c.JSON(401, gin.H{"code": 1001, "message": "Token 无效"})
            c.Abort()
            return
        }
        
        // 设置用户信息到上下文
        c.Set("user_id", claims.UserID)
        c.Set("role", claims.Role)
        c.Next()
    }
}
```

**RBAC 权限检查**:
```go
// 权限中间件
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        role := c.GetString("role")
        
        // 使用 GoFly 权限系统检查
        hasPermission := gofly.RBAC.CheckPermission(userID, role, permission)
        if !hasPermission {
            c.JSON(403, gin.H{"code": 1002, "message": "权限不足"})
            c.Abort()
            return
        }
        c.Next()
    }
}
```

#### 4.5.7 缓存策略集成

**多级缓存实现**:
```go
// 缓存服务
type CacheService struct {
    memoryCache *gofly.MemoryCache
    redisCache  *gofly.RedisCache
}

// 获取缓存（优先内存，再 Redis）
func (cs *CacheService) Get(key string) (interface{}, bool) {
    // 先查内存缓存
    if val, found := cs.memoryCache.Get(key); found {
        return val, true
    }
    
    // 再查 Redis
    if val, found := cs.redisCache.Get(key); found {
        // 回填内存缓存
        cs.memoryCache.Set(key, val, time.Minute*5)
        return val, true
    }
    
    return nil, false
}

// 设置缓存
func (cs *CacheService) Set(key string, value interface{}, ttl time.Duration) {
    cs.memoryCache.Set(key, value, time.Minute*5)
    cs.redisCache.Set(key, value, ttl)
}
```

#### 4.5.8 任务队列集成

**异步任务处理**:
```go
// 任务队列
type TaskQueue struct {
    queue chan *Task
    workers int
}

// 任务处理器
func (tq *TaskQueue) Start() {
    for i := 0; i < tq.workers; i++ {
        go tq.worker()
    }
}

func (tq *TaskQueue) worker() {
    for task := range tq.queue {
        // 执行任务
        err := task.Execute()
        if err != nil {
            log.Printf("Task failed: %v", err)
            // 重试逻辑
        }
    }
}
```

#### 4.5.9 监控和日志集成

**结构化日志**:
```go
// 日志配置
gofly.Logger.SetFormatter(&log.JSONFormatter{})
gofly.Logger.SetOutput(os.Stdout)
gofly.Logger.SetLevel(log.InfoLevel)

// 业务日志
gofly.Logger.WithFields(log.Fields{
    "user_id": "123",
    "action":  "create_task",
    "task_id": "456",
}).Info("Created new task")
```

**性能监控**:
```go
// Prometheus 指标
var (
    requestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "api_request_duration_seconds",
            Help: "API request duration",
        },
        []string{"endpoint", "method"},
    )
    
    activeTasks = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "active_tasks_total",
            Help: "Number of active tasks",
        },
    )
)

// 中间件集成
func PrometheusMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        c.Next()
        
        duration := time.Since(start).Seconds()
        requestDuration.WithLabelValues(c.FullPath(), c.Request.Method).Observe(duration)
    }
}
```

#### 4.5.10 部署和运维

**配置文件**:
```yaml
# config/gofly.yaml
app:
  name: autoads
  version: 1.0.0
  env: production

server:
  host: 0.0.0.0
  port: 8080
  admin_port: 8081

database:
  driver: mysql
  host: localhost
  port: 3306
  name: autoads
  user: autoads
  password: password
  max_idle: 10
  max_open: 100

redis:
  host: localhost
  port: 6379
  password: ""
  db: 0
  pool_size: 10

jwt:
  secret: your-secret-key
  expires_in: 7d
```

**健康检查**:
```go
// 健康检查接口
func HealthCheck(c *gin.Context) {
    // 检查数据库
    dbErr := gofly.DB.DB().Ping()
    
    // 检查 Redis
    redisErr := gofly.Redis.Ping().Err()
    
    status := "healthy"
    if dbErr != nil || redisErr != nil {
        status = "unhealthy"
    }
    
    c.JSON(200, gin.H{
        "status": status,
        "database": map[string]interface{}{
            "status": dbErr == nil,
            "error":  dbErr,
        },
        "redis": map[string]interface{}{
            "status": redisErr == nil,
            "error":  redisErr,
        },
        "timestamp": time.Now(),
    })
}
```

#### 4.5.11 性能优化和测试

**并发模型优化**:
```go
// 连接池配置
db.SetMaxIdleConns(10)
db.SetMaxOpenConns(100)
db.SetConnMaxLifetime(time.Hour)

// HTTP 服务器配置
srv := &http.Server{
    Addr:         ":8080",
    Handler:      router,
    ReadTimeout:  10 * time.Second,
    WriteTimeout: 30 * time.Second,
    IdleTimeout:  120 * time.Second,
}

// Graceful shutdown
go func() {
    if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
        log.Fatalf("Server failed: %v", err)
    }
}()

quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
if err := srv.Shutdown(ctx); err != nil {
    log.Fatal("Server forced to shutdown:", err)
}
```

**测试策略**:
```go
// 单元测试示例
func TestBatchGoController_CreateTask(t *testing.T) {
    // 准备测试数据
    user := &models.User{
        ID:    "test-user-id",
        Email: "test@example.com",
    }
    db.Create(user)

    // 创建请求
    req := BatchGoCreateRequest{
        Name:  "Test Task",
        URLs:  []string{"https://example.com"},
        Mode:  "HTTP",
    }

    // 执行测试
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Set("user_id", user.ID)
    
    controller := NewBatchGoController()
    controller.CreateTask(c)

    // 验证结果
    assert.Equal(t, 200, w.Code)
    
    var response map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &response)
    assert.Equal(t, float64(0), response["code"])
}
```

### 4.6 性能优化策略

#### 4.6.1 缓存策略

**多级缓存**:
1. 应用内存缓存（LRU）
2. Redis分布式缓存
3. 数据库查询缓存

**缓存规则**:
- SimilarWeb数据：缓存24小时
- 用户权限信息：缓存5分钟
- 静态配置：缓存1小时

#### 4.6.2 数据库优化

**索引策略**:
- 所有外键字段建立索引
- 高频查询字段建立复合索引
- 定期分析慢查询日志

**连接池配置**:
- 最大连接数：100
- 最小空闲连接：10
- 连接超时：30秒

#### 4.6.3 并发处理

**Go并发模型**:
- Goroutine池管理
- Channel任务分发
- 优雅关闭机制

**资源限制**:
- 最大并发数：基于用户套餐
- 内存使用监控
- CPU使用率限制

### 4.7 监控与运维

#### 4.7.1 指标监控

**系统指标**:
- CPU/内存使用率
- 磁盘空间使用
- 网络IO统计

**业务指标**:
- QPS/响应时间
- 错误率统计
- 用户活跃度

#### 4.7.2 日志管理

**日志级别**:
- ERROR：系统错误
- WARN：警告信息
- INFO：业务日志
- DEBUG：调试信息

**日志结构**:
```json
{
  "timestamp": "2025-01-01T00:00:00Z",
  "level": "INFO",
  "service": "batchgo",
  "user_id": "user_123",
  "action": "create_task",
  "duration": 123,
  "metadata": {}
}
```

#### 4.7.3 告警机制

**告警规则**:
- 错误率 > 5%
- 响应时间 > 1s
- 磁盘使用 > 80%
- Redis连接失败

**告警通道**:
- 邮件通知
- 飞书Webhook

### 4.8 系统架构设计

#### 4.8.1 前端架构
- **框架**: Next.js 14 + TypeScript
- **状态管理**: React Context + Hooks
- **UI组件库**: Material-UI (MUI)
- **样式方案**: Tailwind CSS + CSS Modules
- **认证**: NextAuth.js v5

#### 4.8.2 后端架构
- **框架**: GoFly Admin V3 (Go语言)
- **ORM**: GoFly gform (基于GORM)
- **认证**: JWT + Session
- **权限**: RBAC模型
- **缓存**: Redis (内存+Redis二级缓存)
- **日志**: GoFly内置日志系统

#### 4.8.3 数据层架构
- **数据库**: MySQL 8.0
- **连接池**: GoFly内置连接池
- **迁移**: GoFly AutoMigrate
- **备份**: 定时备份策略

#### 4.8.4 部署架构
- **容器化**: Docker + Docker Compose
- **Dockerfile**: 
  - 开发/预发/生产环境使用 `Dockerfile.standalone` (Next.js only)
  - GoFly版本使用 `Dockerfile.gofly` (Go + Next.js 多架构)
- **Web服务器**: Nginx (反向代理)
- **进程管理**: Systemd
- **监控**: GoFly内置监控

#### 4.8.5 Dockerfile 架构说明

**当前架构 (Dockerfile.standalone)**:
- 单一 Next.js 容器
- API Routes 作为后端
- 适用于快速开发和预发部署

**GoFly 架构 (Dockerfile.gofly)**:
- 多阶段构建支持 Go + Next.js
- Go 后端运行在 8080 端口
- Next.js 前端运行在 3000 端口
- 共享资源层优化
- 支持 Puppeteer/Chromium
- 内存和性能优化配置

**构建命令示例**:
```bash
# 当前架构 (Next.js only)
docker build -f Dockerfile.standalone -t autoads:nextjs .

# GoFly 架构 (Go + Next.js)
docker build -f Dockerfile.gofly -t autoads:gofly .
```

## 5. 实施计划

### 5.1 开发阶段规划

#### 阶段一：基础架构搭建（2 周）
- [ ] GoFly 框架集成和配置
- [ ] 数据库表结构创建
- [ ] 基础中间件开发
- [ ] 用户认证系统实现
- [ ] 基础 API 框架搭建

#### 阶段二：核心功能迁移（4 周）
- [ ] BatchGo 模块开发
  - [ ] 任务管理API
  - [ ] HTTP模式实现
  - [ ] Puppeteer模式集成
  - [ ] 代理池管理
  - [ ] 结果统计功能
- [ ] SiteRankGo 模块开发
  - [ ] SimilarWeb API集成
  - [ ] 批量查询优化
  - [ ] 缓存策略实现
  - [ ] 数据分析功能

#### 阶段三：AdsCenterGo 开发（3 周）
- [ ] Google Ads API 集成
- [ ] AdsPower API 对接
- [ ] 链接替换规则引擎
- [ ] 执行监控功能

#### 阶段四：管理后台开发（3周）
- [ ] GoFly Admin 集成
- [ ] 用户管理界面
- [ ] 套餐管理功能
- [ ] 系统监控面板
- [ ] 数据统计报表

#### 阶段五：测试与优化（2 周）
- [ ] 功能测试
- [ ] 性能测试
- [ ] 安全测试
- [ ] 兼容性测试
- [ ] 代码优化

### 5.2 技术风险与应对

#### 风险1：Go语言学习曲线
- **风险**：团队Go语言经验不足
- **应对**：提前组织Go语言培训，引入Go技术专家

#### 风险2：Puppeteer性能问题
- **风险**：Puppeteer占用资源过高
- **应对**：优化浏览器池管理，实现资源复用

#### 风险3：第三方API限制
- **风险**：SimilarWeb API调用限制
- **应对**：实现智能缓存，优化查询策略

#### 风险4：并发安全性
- **风险**：高并发下的数据竞争
- **应对**：使用Go的并发原语，确保线程安全

### 5.3 上线策略

#### 灰度发布
1. 邀请制：先邀请种子用户试用
2. 功能开关：可随时切换回原系统
3. 监控告警：实时监控系统健康状态

#### 数据迁移
- 新系统使用全新数据库
- 保留原系统3个月用于数据回滚
- 提供数据导出功能

#### 回滚方案
- API网关支持流量切换
- 数据库快照备份
- 应急响应流程

### 5.4 技术栈选择

#### 5.4.1 后端技术栈
- **框架**: GoFly Admin V3
- **语言**: Go 1.21+
- **ORM**: GoFly gform (GORM)
- **缓存**: Redis
- **认证**: JWT
- **日志**: GoFly 内置日志

#### 5.4.2 数据库技术栈
- **主库**: MySQL 8.0
- **缓存**: Redis 7.0
- **连接池**: GoFly 内置连接池

### 5.5 部署方案

#### 5.5.1 开发环境
- Docker Compose 本地开发
- 热重载支持
- 本地数据库和 Redis

#### 5.5.2 生产环境
- Docker 容器化部署
- Nginx 反向代理
- MySQL 主从架构
- Redis Cluster

## 6. 验收标准

### 6.1 功能验收

#### 用户系统
- [ ] 支持邮箱注册和验证
- [ ] 支持 Google OAuth 登录
- [ ] 支持密码找回功能
- [ ] 用户资料管理完整

#### BatchGo 功能
- [ ] 三种模式完全兼容
- [ ] HTTP 和 Puppeteer 模式可选
- [ ] 任务执行状态实时更新
- [ ] 支持代理配置和轮转

#### SiteRankGo 功能
- [ ] SimilarWeb API 集成正常
- [ ] 批量查询性能达标
- [ ] 缓存策略有效
- [ ] 数据展示完整

#### AdsCenterGo 功能
- [ ] Google Ads账户管理
- [ ] 链接替换功能正常
- [ ] 执行日志记录完整

### 6.2 性能验收

#### 响应时间
- [ ] API P95 响应时间 < 200ms
- [ ] 页面加载时间 < 2s
- [ ] BatchGo 任务启动时间 < 1s

#### 并发能力
- [ ] 支持 5000 用户同时在线
- [ ] BatchGo 支持 50 并发任务
- [ ] SiteRankGo 支持 100 并发查询

#### 资源使用
- [ ] CPU使用率 < 70%
- [ ] 内存使用率 < 80%
- [ ] 数据库连接数 < 80%

### 6.3 安全验收
- [ ] JWT认证机制安全
- [ ] 用户数据完全隔离
- [ ] 敏感数据加密存储
- [ ] API限流有效
- [ ] 无SQL注入漏洞
- [ ] 无XSS漏洞

### 6.4 兼容性验收
- [ ] 前端界面无变化
- [ ] API接口兼容
- [ ] 浏览器兼容性良好
- [ ] 移动端适配正常
- [ ] 前端无需修改即可切换后端
- [ ] 所有现有功能保持一致
- [ ] 数据格式完全兼容

## 7. 业务规则补充说明

### 7.1 用户权限体系设计

**重要：前端用户与管理后台完全分离**

#### 前端网站用户（普通用户）
- ✅ 注册方式：邮箱注册、Google OAuth
- ✅ 登录方式：邮箱密码、Google OAuth
- ❌ 权限限制：无法访问 GoFly Admin 后台
- ✅ 可用功能：BatchGo、SiteRankGo、AdsCenterGo 等业务功能
- ✅ 管理范围：仅自己的数据和任务

#### GoFly Admin 后台（管理员）
- ✅ 登录方式：账号密码（由超级管理员创建）
- ❌ 注册功能：不提供前台注册，需要手动创建账号
- ✅ 权限范围：完整的管理后台权限
- ✅ 管理功能：用户管理、系统配置、数据监控、任务管理
- ✅ 数据访问：可查看所有用户数据（遵循数据隔离原则）

#### 权限实现机制
1. **用户表分离**：
   - `users`：前端用户（支持 OAuth）
   - `admin_users`：后台管理员（仅账号密码）

2. **认证中间件**：
   - 前端 API：使用 JWT + 用户表验证
   - 后台 API：使用 GoFly 的 RBAC 系统 + admin_users 表

3. **权限控制**：
   - 前端用户无法访问 `/admin/*` 路径
   - 管理员无法通过前端登录
   - 完全的数据隔离

### 7.2 并发与任务规模说明

**关于"万级并发"的澄清**:
- 系统支持的实际上是"万级日处理任务规模"
- BatchGo的并发数受限于用户套餐（1/5/50）
- HTTP模式下并发能力可达10倍（10/50/500）
- 实际并发能力取决于服务器配置和网络环境

### 7.3 Token消费规则

#### 基础消耗规则

**SiteRankGo 查询消耗**:
- 用户使用 `/siterank` 查询网站数据
- 成功查询 1 个域名，消耗 1 个 token
- 无论数据是否来自缓存，均消耗 token
- 查询失败（网络错误、API错误等）不消耗 token
- 批量查询按实际成功查询的域名数量计算

**BatchGo HTTP访问模式消耗**:
- 用户使用 `/batchopen` 进行批量打开
- 使用 "HTTP访问模式"
- 成功访问 1 个 URL，消耗 1 个 token
- 访问失败（超时、404、5xx等）不消耗 token
- 重定向算作成功访问

**BatchGo Puppeteer访问模式消耗**:
- 用户使用 `/batchopen` 进行批量打开
- 使用 "Puppeteer访问模式"
- 成功访问 1 个 URL，消耗 2 个 token
- 因浏览器启动失败等系统原因导致的访问失败不消耗 token
- 页面加载成功但内容异常仍消耗 token

#### 高级消耗规则

**AdsCenterGo 操作消耗**:
- Google Ads 账户连接：消耗 10 token（一次性）
- 链接提取任务：每提取 100 个链接消耗 5 token
- 链接替换任务：每成功替换 1 个链接消耗 2 token
- 批量操作失败自动返还相应 token

**免费额度**:
- 新用户注册：获得 14 天 Pro 套餐（包含 10,000 tokens/月）
- 每日签到：0-100 token（随机）
- 邀请好友：获得 30 天 Pro 套餐（好友成功注册后）

#### 扣费机制

**扣费时机**:
- Basic 模式：点击立即执行时扣除
- Silent/Automated 模式：任务创建时预扣 80%，完成后扣除剩余 20%
- SiteRankGo：查询完成并返回结果时扣除
- 批量任务：按实际成功数量分批扣除

**余额不足处理**:
- 创建任务前检查余额
- 余额不足时拒绝创建并提示充值
- 任务执行过程中余额不足：暂停任务，提示充值后继续

**Token 返还规则**:
- 任务执行失败：100% 返还已扣除 token
- 部分成功：按失败比例返还 token
- 系统维护导致任务中断：全额返还
- 用户手动取消：未执行部分返还

#### 消耗统计与监控

**实时统计**:
- 用户仪表盘显示实时 token 余额
- 消耗历史记录（支持筛选和导出）
- 预估剩余 token 可用时长

**消费分析**:
- 按功能模块统计消耗分布
- 按时间维度分析消费趋势
- 高频操作告警（防刷机制）

**套餐配额**:
- Free 套餐：1,000 token/月
- Pro 套餐：10,000 token/月
- Max 套餐：100,000 token/月
- 超出套餐后按实际消耗计费

#### 防刷机制

**频率限制**:
- 单用户每分钟最多 100 次操作
- 单 IP 每小时最多 1,000 次操作
- 异常消耗模式自动触发验证

**风控规则**:
- 新用户 24 小时内消耗超过 500 token 需要验证
- 短时间内大量相同操作触发人工审核
- 异常地理位置登录加强验证

#### Token 优惠活动

**充值优惠**:
- 小包：¥99 = 10,000 tokens
- 中包：¥299 = 50,000 tokens (40% off)
- 大包：¥599 = 200,000 tokens (67% off)
- 超大包：¥999 = 500,000 tokens (80% off)

#### Token 消耗 API

**查询余额**:
```
GET /api/v1/tokens/balance
Response: { balance: 5000, last_updated: "2025-01-01T00:00:00Z" }
```

**消耗记录**:
```
GET /api/v1/tokens/consumption
Response: {
  total: 1500,
  items: [
    { feature: "SiteRankGo", amount: 500, date: "2025-01-01" },
    { feature: "BatchGo", amount: 1000, date: "2025-01-01" }
  ]
}
```

**预扣费接口**:
```
POST /api/v1/tokens/deduct
Request: { feature: "BatchGo", amount: 100, task_id: "task_123" }
Response: { success: true, balance: 4900 }
```

#### 扣费失败处理

**自动重试机制**:
- 网络问题导致的扣费失败自动重试 3 次
- 重试间隔：5s、30s、5min
- 重试失败后记录异常并告警

**数据一致性保证**:
- 使用事务确保扣费和任务状态同步
- 定期对账任务自动修复异常
- 人工审核通道处理特殊情况

**异常处理流程**:
1. 扣费异常立即暂停相关任务
2. 系统自动创建工单
3. 运维人员 2 小时内响应
4. 24 小时内解决并补偿

### 7.4 试用期规则

**叠加规则**:
- 新用户注册：14天Pro
- 邀请注册：30天Pro（不与新用户奖励叠加）
- 多次邀请：可累加，最长365天
- 试用期间不能再次获得试用

### 7.5 SimilarWeb配额管理

**配额使用策略**:
- 全局配额监控
- 达到限额自动降级
- 支持配额预约和排队
- 优先付费用户查询

## 8. 术语表

### 8.1 模块术语
- **BatchGo**: 批量访问功能的 Go 语言实现
- **SiteRankGo**: 网站排名功能的 Go 语言实现
- **AdsCenterGo**: Google Ads管理功能的 Go 语言实现

### 8.2 技术术语
- **CUID**: 自定义唯一标识符，用于数据库主键
- **JWT**: JSON Web Token，用于认证
- **RBAC**: 基于角色的访问控制
- **Puppeteer**: 无头浏览器自动化工具
- **SimilarWeb**: 第三方网站数据分析 API

### 8.3 业务术语
- **Token**: 系统内的虚拟货币，用于功能消费
- **套餐**: 用户订阅的服务等级（Free/Pro/Max）
- **并发**: 同时执行的任务数量
- **代理**: 用于网络请求的中转服务器

## 9. 开发环境配置和工作流

### 9.1 开发环境搭建

**环境要求**:
- Go 1.21+
- Node.js 18+
- MySQL 8.0+
- Redis 7+
- Docker (可选)

**1. 克隆项目**:
```bash
# 克隆主项目
git clone https://github.com/your-org/autoads.git
cd autoads

# 初始化子模块
git submodule update --init --recursive
```

**2. 环境变量配置**:
```bash
# 复制环境变量模板
cp .env.example .env
cp .env.development.example .env.development

# 编辑环境变量
vim .env
```

**环境变量文件 (.env)**:
```env
# 应用配置
APP_ENV=development
APP_PORT=8080
APP_SECRET=your-secret-key-here

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=autoads_dev
DB_USER=autoads
DB_PASSWORD=autoads123
DB_MAX_IDLE=10
DB_MAX_OPEN=100

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT 配置
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# OAuth 配置
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# API 配置
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
```

**3. 启动服务**:
```bash
# 使用 Docker Compose (推荐)
docker-compose up -d

# 或手动启动服务
# 启动 MySQL
docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=autoads_dev -e MYSQL_USER=autoads \
  -e MYSQL_PASSWORD=autoads123 -p 3306:3306 -d mysql:8.0

# 启动 Redis
docker run --name redis-dev -p 6379:6379 -d redis:7-alpine

# 安装 Go 依赖
cd gofly_admin_v3
go mod download
go mod tidy

# 运行数据库迁移
go run cmd/migrate/main.go

# 启动后端服务
go run main.go

# 新终端：启动前端
cd ../frontend
npm install
npm run dev
```

### 9.2 开发工作流

**Git 工作流**:
```bash
# 创建功能分支
git checkout -b feature/batchgo-optimization main

# 开发并提交
git add .
git commit -m "feat: optimize batchgo performance"

# 推送到远程
git push origin feature/batchgo-optimization

# 创建 Pull Request
# 在 GitHub/GitLab 上创建 PR，请求代码审查
```

**代码规范**:
- Go 代码遵循官方标准
- 使用 golangci-lint 进行代码检查
- 提交信息遵循 Conventional Commits 规范
- 所有 API 端点必须添加 Swagger 注释

**测试规范**:
```go
// 单元测试示例
// app/autoads/batchgo/mode_selector_test.go
package batchgo

import (
    "testing"
    
    "github.com/stretchr/testify/assert"
)

func TestModeSelector_RecommendMode(t *testing.T) {
    selector := NewModeSelector()
    
    tests := []struct {
        name     string
        urls     []string
        expected map[AccessMode][]string
    }{
        {
            name: "SPA detection",
            urls: []string{"https://example.com/react-app"},
            expected: map[AccessMode][]string{
                PuppeteerMode: {"https://example.com/react-app"},
            },
        },
        {
            name: "API detection",
            urls: []string{"https://api.example.com/users"},
            expected: map[AccessMode][]string{
                HTTPMode: {"https://api.example.com/users"},
            },
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, _ := selector.RecommendMode(tt.urls)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

### 9.3 调试工具

**1. API 调试**:
```bash
# 使用 curl 测试 API
curl -X POST http://localhost:8080/api/v1/batchgo/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "urls": ["https://example.com"],
    "mode": "http",
    "proxy_enabled": true
  }'
```

**2. 数据库调试**:
```bash
# 连接 MySQL
mysql -h localhost -u autoads -pautoads123 autoads_dev

# 查看表结构
DESCRIBE users;
DESCRIBE batch_tasks;

# 查看最近的任务
SELECT * FROM batch_tasks ORDER BY created_at DESC LIMIT 10;
```

**3. Redis 调试**:
```bash
# 连接 Redis
redis-cli

# 查看缓存
KEYS autoads:cache:*

# 查看队列信息
LLEN autoads:task:queue
```

**4. 性能分析**:
```bash
# 启用 pprof
go tool pprof http://localhost:8080/debug/pprof/profile

# 查看 goroutine
go tool pprof http://localhost:8080/debug/pprof/goroutine

# 查看 heap
go tool pprof http://localhost:8080/debug/pprof/heap
```

### 9.4 部署脚本

**本地开发部署**:
```bash
#!/bin/bash
# scripts/dev-deploy.sh

set -e

echo "🚀 Starting development environment..."

# 检查依赖
command -v docker >/dev/null 2>&1 || { echo "Docker is required"; exit 1; }
command -v go >/dev/null 2>&1 || { echo "Go is required"; exit 1; }

# 启动依赖服务
echo "📦 Starting dependencies..."
docker-compose up -d mysql redis

# 等待服务就绪
echo "⏳ Waiting for services..."
sleep 10

# 运行迁移
echo "🔄 Running migrations..."
cd gofly_admin_v3
go run cmd/migrate/main.go

# 启动应用
echo "🎯 Starting application..."
go run main.go
```

**测试环境部署**:
```bash
#!/bin/bash
# scripts/test-deploy.sh

set -e

ENVIRONMENT="test"
IMAGE_TAG="latest"

echo "🚀 Deploying to $ENVIRONMENT environment..."

# 构建镜像
echo "🏗️ Building Docker image..."
docker build -t autoads:$IMAGE_TAG .

# 推送到镜像仓库
echo "📤 Pushing image..."
docker tag autoads:$IMAGE_TAG registry.example.com/autoads:$IMAGE_TAG
docker push registry.example.com/autoads:$IMAGE_TAG

# 部署到测试环境
echo "🎯 Deploying to test..."
kubectl config use-context test-cluster
kubectl apply -f k8s/test/

# 等待部署完成
echo "⏳ Waiting for deployment..."
kubectl rollout status deployment/autoads -n test

# 运行健康检查
echo "🏥 Running health checks..."
kubectl get pods -n test -l app=autoads

echo "✅ Deployment completed!"
```

### 9.5 常见问题解决

**1. 编译错误**:
```bash
# 清理模块缓存
go clean -modcache
go mod download

# 检查 Go 版本
go version
```

**2. 数据库连接问题**:
```bash
# 检查 MySQL 状态
docker exec mysql-dev mysql -pautoads123 -e "STATUS"

# 重置数据库
docker exec mysql-dev mysql -pautoads123 -e "DROP DATABASE IF EXISTS autoads_dev; CREATE DATABASE autoads_dev;"
```

**3. 缓存问题**:
```bash
# 清理 Redis 缓存
redis-cli FLUSHDB

# 重启 Redis
docker restart redis-dev
```

**4. 权限问题**:
```bash
# 检查文件权限
ls -la gofly_admin_v3/resource/

# 修复权限
chmod 755 gofly_admin_v3/resource/logs/
```

## 10. 附录

### 10.1 生产环境要求

#### 服务器配置
```bash
# 服务器配置
- CPU: 4核+
- 内存: 8GB+
- 磁盘: 100GB SSD
- 网络: 100Mbps+
```

### 10.2 相关文档

- [MustKnow.md](./MustKnow.md) - 系统配置信息
- [GoFly Admin V3 文档](https://doc.goflys.cn/docview?id=26)
- [SimilarWeb API 文档](https://developer.similarweb.com/)
- [Google Ads API 文档](https://developers.google.com/google-ads/api/docs)

### 10.3 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v5.0 | 2025-09-10 | 全面梳理文档结构，消除歧义和不一致，精简内容保持核心完整性。补充V3中缺失的详细技术实现，包括完整的数据库架构、API设计规范、安全架构、性能优化策略、监控运维方案等 | 产品团队 |
| v4.3 | 2025-09-10 | 修正重构目标与V3不一致的问题，统一技术规格和实施策略 | 产品团队 |
| v4.2 | 2025-09-10 | 基于实际代码分析，修正虚构业务逻辑，聚焦真实功能特性 | 产品团队 |
| v3.0 | 2025-09-13 | 完整性审查，确保涵盖原PRD所有核心内容 | 产品团队 |