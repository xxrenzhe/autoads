# AutoAds 多用户 SaaS 系统重构 PRD V4.0

## 文档信息
- **项目名称**: AutoAds 多用户 SaaS 系统
- **版本**: v4.0
- **创建日期**: 2025-01-09
- **最后更新**: 2025-09-13
- **负责人**: 产品团队
- **优化说明**: 
  - V4.0：全面修复文档不一致性和歧义问题，统一技术规格，优化文档结构
  - V4.1：开始清理过度详细的实现代码，将 PRD 专注在需求层面

## 执行摘要

AutoAds 是一个成熟的多用户 SaaS 自动化营销平台，当前基于 Next.js 架构运行，正计划迁移至 GoFly 框架以获得更好的性能和管理能力。**当前生产环境已完整实现**用户认证、权限管理和三大核心功能中的两个：✅ BatchOpen（批量访问，三种模式完整实现）、✅ SiteRank（网站排名，已集成 SimilarWeb API）、❌ ChangeLink（链接管理，仅 UI 原型）。本文档描述当前系统架构和功能规格，Go 迁移计划详见单独的迁移方案文档。

## 1. 项目概述

### 1.1 现有项目分析

#### 分析来源
基于代码库深度分析（2025-09-10）

#### 当前项目状态
AutoAds 是一个基于 Next.js 14 的自动化营销平台，三大核心功能实现状态：
- **✅ BatchOpen（批量访问）**: 完整实现三种执行模式（Basic/Silent/Automated）
- **✅ SiteRank（网站排名）**: 完整实现，已集成真实 SimilarWeb API，支持批量查询和缓存
- **❌ ChangeLink（链接管理）**: 仅有 UI 界面，无后端 API 实现

#### 技术栈现状
**前端技术栈**:
- Next.js 14 + React 18 + TypeScript
- MUI v7 + Tailwind CSS
- Zustand 状态管理
- NextAuth.js v5 认证

**后端技术栈**:
- Next.js API Routes（无 Go 语言实现）
- MySQL + Prisma ORM
- Redis（用于缓存）
- Puppeteer 浏览器自动化

**外部集成**:
- Google OAuth 2.0（认证）
- SimilarWeb API（已集成）
- Google Ads API（未集成）
- AdsPower API（未集成）

### 1.2 系统架构目标

#### 当前架构（生产环境）
- **单体应用**: Next.js 14 全栈应用
- **认证系统**: NextAuth.js v5 + Google OAuth
- **数据库**: MySQL 8.0 + Prisma ORM
- **缓存**: Redis 7.0
- **部署**: GitHub Actions + ClawCloud 容器化

#### 未来架构目标（规划中）
1. **后端迁移**: Next.js API Routes → Go + GoFly Admin V3
2. **前端保留**: 保持 Next.js 前端不变，仅调整 API 调用
3. **性能优化**: 利用 Go 并发特性提升批量处理能力
4. **管理增强**: 集成 GoFly 专业后台管理系统
5. **平滑过渡**: 保持 API 兼容性，确保业务连续性

#### 迁移预期收益
- **性能**: 批量处理速度提升 5-10 倍
- **资源**: 内存使用降低 50%
- **维护**: 统一技术栈，降低复杂度
- **扩展**: 更容易添加新功能和集成第三方服务
- 统一的技术栈

## 2. 命名说明

### 2.1 现有功能与重构版本的命名区分

为清晰区分现有 Next.js 实现和 Go 重构版本，特此说明：

- **现有功能（Next.js实现）**:
  - BatchOpen：批量访问功能
  - SiteRank：网站排名功能  
  - ChangeLink：链接管理功能

- **重构版本（Go实现）**:
  - BatchGo：BatchOpen 的 Go 重构版本
  - SiteRankGo：SiteRank 的 Go 重构版本
  - AdsCenterGo：ChangeLink 的 Go 重构版本

所有重构将保持 API 兼容性，前端无需修改即可切换到新的 Go 后端。

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
- **FR2.2**: 管理员通过账号密码登录 GoFly Admin 后台管理系统
- **FR2.3**: 管理员可管理所有用户账号
- **FR2.4**: 管理员可查看系统运行状态和日志
- **FR2.5**: 管理员可配置系统参数和权限

#### FR3: 用户权限与套餐管理
- **FR3.1**: 三级用户套餐体系（Free/Pro/Max）
- **FR3.2**: 不同套餐对应不同的功能权限和使用限制
- **FR3.3**: 管理员可手动调整用户套餐
- **FR3.4**: 用户可查看当前套餐和使用情况
- **FR3.5**: 套餐权限实时生效机制
- **FR3.6**: 新用户注册自动获得 14 天 Pro 套餐
- **FR3.7**: 邀请注册机制（邀请者和被邀请者各得 30 天 Pro）
- **FR3.8**: 套餐到期自动降级机制
- **FR3.9**: 试用期叠加规则：
  - 新用户通过邀请链接注册：获得 30 天 Pro 套餐（不与基础新用户 14 天奖励叠加）
  - 多次邀请奖励可累加，但最长不超过 365 天
  - 试用期从激活开始计算，不可暂停
- **FR3.10**: 套餐配置后台管理功能

#### FR4: BatchGo 模块（支持 HTTP 和 Puppeteer 访问模式）
- **FR4.1**: 完整迁移三种执行模式（Basic/Silent/Automated）到 Go 语言架构
- **FR4.2**: 基于 Go 实现高并发任务处理
- **FR4.3**: **HTTP 访问模式**：
  - 轻量级 HTTP 请求库实现
  - 高性能并发处理
  - 支持自定义 User-Agent 和请求头
  - 自动处理 Cookies 和 Session
  - 适合大规模批量访问任务

- **FR4.4**: **Puppeteer 访问模式**：
  - 完整的浏览器环境模拟
  - 支持 JavaScript 渲染和动态内容
  - 自动处理验证码和反爬机制
  - 支持截图和页面调试
  - 适合需要真实浏览器环境的任务

- **FR4.5**: **当前 Basic 版本实现状态**：
  - 前端 window.open 实现，直接在用户浏览器打开新标签页
  - 纯前端实现，使用浏览器原生 window.open() API
  - 在用户浏览器中批量打开新标签页
  - 不依赖后端服务器资源
  - 固定 200ms 打开间隔
  - 最大支持 100 个 URL/任务
  - 依赖用户手动配置代理

- **FR4.6**: **Silent 版本权限**：
  - 支持多线程并发执行（最多 5 线程）
  - 支持 HTTP 访问模式和 Puppeteer 访问模式
  - 高级代理池管理（自动检测和切换）
  - 智能重试机制和错误恢复
  - 支持自定义执行间隔
  - 最大支持 1000 个 URL/任务

- **FR4.7**: **Automated 版本权限**：
  - 支持大规模并发执行（最多 50 线程）
  - 支持 HTTP 访问模式和 Puppeteer 访问模式
  - 企业级代理池（多地区、自动负载均衡）
  - 智能调度和优先级队列
  - 实时监控和性能分析
  - 支持定时任务和批量导入
  - 最大支持 5000 个 URL/任务

- **FR4.8**: 任务实时监控和结果统计
- **FR4.9**: 任务历史记录和回放功能

#### FR5: SiteRankGo 模块
- **FR5.1**: SimilarWeb API 集成和优化
- **FR5.2**: 批量查询性能提升
- **FR5.3**: 多层缓存策略（Redis + 本地缓存）
- **FR5.4**: 历史数据存储和趋势分析
- **FR5.5**: 自定义查询规则和报表

#### FR6: AdsCenterGo 模块
- **FR6.1**: Google Ads API 多账户管理
- **FR6.2**: AdsPower 自动化流程优化
- **FR6.3**: 复杂链接替换规则引擎
- **FR6.4**: 执行状态实时监控
- **FR6.5**: 失败回滚和错误恢复机制

#### FR7: 前端界面优化
- **FR7.1**: 保持现有页面布局和导航结构
- **FR7.2**: 支持免登录访问网站页面
- **FR7.3**: 功能按钮点击时强制引导登录
- **FR7.4**: 优化 UI 设计，提升视觉体验
- **FR7.5**: 响应式设计，支持移动端访问
- **FR7.6**: 实时数据展示和交互优化
- **FR7.7**: 多用户界面适配

#### FR8: Token 管理系统
- **FR8.1**: 简化 Token 余额架构：
  - 单一 Token 余额字段
  - 通过交易记录区分 Token 来源
  - 消费时按优先级扣除

- **FR8.2**: Token 来源和优先级：
  1. 订阅赠送（优先使用）
  2. 活动奖励（有 30 天有效期）
  3. 用户购买（无有效期限制）

- **FR8.3**: Token 充值和消费统计
- **FR8.4**: Token 消费规则配置
- **FR8.5**: Token 交易记录管理
- **FR8.6**: Token 使用分析报表
- **FR8.7**: 每日签到奖励 Token 机制

#### FR9: 用户中心功能
- **FR9.1**: 个人信息管理
- **FR9.2**: 订阅管理（查看套餐信息）
- **FR9.3**: Token 消费记录
- **FR9.4**: 每日签到功能
- **FR9.5**: 邀请好友功能
- **FR9.6**: 消息通知中心

#### FR10: 管理员仪表板
- **FR10.1**: 关键指标趋势图
- **FR10.2**: 用户列表管理
- **FR10.3**: 角色管理
- **FR10.4**: 套餐配置管理
- **FR10.5**: Token 消费分析
- **FR10.6**: API 限速配置
- **FR10.7**: 通知模板管理
- **FR10.8**: 支付记录查看
- **FR10.9**: API 监控统计
- **FR10.10**: 签到记录管理
- **FR10.11**: 邀请记录管理

#### FR10.12: 支付系统说明
- **FR10.12.1**: **当前采用手动咨询模式**：
  - **套餐订阅**：用户点击"立即订阅"按钮弹出咨询窗口，通过与管理员沟通后手动开通
  - **Token充值**：用户点击Token充值包的"立即订阅"按钮弹出咨询窗口，管理员审核后手动充值
  - 不集成Stripe等自动支付系统
  - 无自动续费和定期扣费机制
  - 所有交易都通过管理员手动处理

- **FR10.12.2**: **咨询窗口功能要求**：
  - **套餐咨询窗口**：
    - 显示选择的套餐信息（名称、价格、功能）
    - 用户联系方式输入框
    - 备注信息输入框
    - 提交后通知管理员处理
  - **Token充值咨询窗口**：
    - 显示充值包信息（价格、Token数量）
    - 用户联系方式输入框
    - 提交后创建充值申请记录
  - **咨询记录管理**：
    - 管理员后台查看所有咨询记录
    - 可标记处理状态（待处理/已处理/已取消）
    - 支持备注处理结果

- **FR10.12.3**: **订阅套餐激活流程**：
  - 用户通过咨询窗口提交套餐申请
  - 管理员审核并手动激活套餐权限
  - 激活后自动赠送对应数量的Tokens
  - 套餐到期后自动降级至Free套餐
  - 支持管理员提前续费或延期

- **FR10.12.4**: **支付记录管理**：
  - 记录所有Token充值交易
  - 支持按用户、时间、金额筛选
  - 导出充值报表功能
  - 手动标记充值状态（待审核/已充值/已取消）

#### FR11: GoFly 管理后台集成
- **FR11.1**: 选择性集成 GoFly Admin V3 核心模块
- **FR11.2**: 自定义开发业务特定功能
- **FR11.3**: 系统日志和操作审计
- **FR11.4**: 数据可视化和报表系统
- **FR11.5**: 系统配置和参数管理

### 3.2 非功能需求（Non-Functional Requirements）

#### NFR1: 性能需求
- **NFR1.1**: 系统 P95 响应时间 < 200ms
- **NFR1.2**: 支持 5,000+ 用户并发在线
- **NFR1.3**: BatchGo 支持高并发处理
- **NFR1.4**: SiteRankGo 查询响应时间 < 500ms
- **NFR1.5**: 系统可用性 99.9%

#### NFR2: 安全需求
- **NFR2.1**: 用户数据完全隔离
- **NFR2.2**: JWT + OAuth2.0 认证机制
- **NFR2.3**: 管理员后台独立登录入口
- **NFR2.4**: 敏感数据加密存储
- **NFR2.5**: 完整的操作审计日志

#### NFR3: 数据库需求
- **NFR3.1**: 使用 MySQL 8.0 作为主数据库
- **NFR3.2**: 使用 Redis 7.0 作为缓存和会话存储
- **NFR3.3**: 支持数据库连接池
- **NFR3.4**: 数据定期备份和恢复机制

#### NFR4: 可扩展性需求
- **NFR4.1**: 模块化架构支持水平扩展
- **NFR4.2**: 支持动态服务发现
- **NFR4.3**: 配置支持热更新
- **NFR4.4**: 支持功能模块的动态加载

#### NFR5: 可维护性需求
- **NFR5.1**: 完整的技术文档和 API 文档
- **NFR5.2**: 代码覆盖率 > 80%
- **NFR5.3**: 自动化测试和 CI/CD 流程
- **NFR5.4**: 完善的监控和告警系统

### 3.3 兼容性需求（Compatibility Requirements）

#### CR1: 数据配置
- **CR1.1**: 使用新的 MySQL 数据库
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
- "批量访问"功能，包括 Basic 和 Silent 版本
- "网站排名"功能，批量查询域名上限 100 个/次
- 包含 1,000 tokens

**高级套餐（Pro）**:
- ¥298/月（年付优惠 50%）
- 支持所有免费套餐的功能
- 新增 Automated 版本
- "网站排名"功能，批量查询域名上限 500 个/次
- "自动化广告"功能，批量管理 ads 账号（上限 10 个）
- 包含 10,000 tokens

**白金套餐（Max）**:
- ¥998/月（年付优惠 50%）
- 支持所有高级套餐的功能
- "网站排名"功能，批量查询域名上限 5,000 个/次
- "自动化广告"功能，批量管理 ads 账号（上限 100 个）
- 包含 100,000 tokens

#### 详细权限矩阵

| 功能模块 | Free 套餐 | Pro 套餐 | Max 套餐 |
|---------|-----------|----------|----------|
| **BatchGo Basic** | ✓ (前端打开) | ✓ (前端打开) | ✓ (前端打开) |
| **BatchGo Silent** | ✓ (HTTP+Puppeteer) | ✓ (HTTP+Puppeteer) | ✓ (HTTP+Puppeteer) |
| **BatchGo Automated** | ✗ | ✓ (HTTP+Puppeteer) | ✓ (HTTP+Puppeteer) |
| **单次任务URL数量** | 10 | 100 | 1,000 |
| **循环次数上限** | 10 | 100 | 100 |
| **并发任务数** | 1 | 5 | 50 |
| **SiteRankGo 查询限制** | 100/次 | 500/次 | 5,000/次 |
| **AdsCenterGo 账户数** | 不支持 | 10个 | 100个 |
| **包含Token数量** | 1,000 | 10,000 | 100,000 |
| **API 调用频率** | 100/小时 | 1,000/小时 | 10,000/小时 |

### 3.5 Token 充值价格

**Token 充值包**（充值越多，折扣越大）:
- 小包: ¥99 = 10,000 tokens
- 中包: ¥299 = 50,000 tokens (约 40% off)
- 大包: ¥599 = 200,000 tokens (约 67% off)
- 超大包: ¥999 = 500,000 tokens (约 80% off)

## 4. 技术架构设计

### 4.1 整体架构

#### 4.1.1 当前架构模式（生产环境）
采用 **Next.js 全栈应用架构**：
- **前端层**: Next.js 14 + React 18 + TypeScript
- **后端层**: Next.js API Routes + Server Actions
- **数据层**: MySQL 8.0 + Prisma ORM
- **缓存层**: Redis 7.0（缓存和会话存储）
- **认证层**: NextAuth.js v5 + JWT

#### 4.1.2 未来架构目标（规划中）

**目标架构模式**：
- **前端层**: Next.js 14 + TypeScript（保持现有）
- **后端层**: Go + GoFly Admin V3 框架
- **数据层**: MySQL 8.0（迁移数据结构）
- **缓存层**: Redis 7.0（保持现有）
- **ORM层**: GoFly gform

#### 4.1.3 当前部署架构
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
    id VARCHAR(191) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    username VARCHAR(191),
    password_hash VARCHAR(255),
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
    id VARCHAR(191) PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'CNY',
    interval ENUM('DAY', 'WEEK', 'MONTH', 'YEAR') DEFAULT 'MONTH',
    features JSON,
    metadata JSON,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    token_quota INT DEFAULT 0,
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
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    plan_id VARCHAR(191) NOT NULL,
    status ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING') DEFAULT 'PENDING',
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_plan_id (plan_id),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
);

-- Token交易表
CREATE TABLE token_transactions (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    type ENUM('CONSUME', 'RECHARGE', 'BONUS', 'REFUND') NOT NULL,
    amount INT NOT NULL,
    balance_before INT NOT NULL,
    balance_after INT NOT NULL,
    source ENUM('SUBSCRIPTION', 'PURCHASE', 'ACTIVITY', 'REFERRAL', 'CHECKIN', 'OTHER'),
    description TEXT,
    feature ENUM('BATCHGO', 'SITERANKGO', 'ADSCENTERGO', 'OTHER') DEFAULT 'OTHER',
    expires_at DATETIME,
    priority INT DEFAULT 0,
    related_id VARCHAR(191),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- BatchGo任务表
CREATE TABLE batchgo_tasks (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    name VARCHAR(255) NOT NULL,
    mode ENUM('BASIC', 'SILENT', 'AUTOMATED') NOT NULL,
    access_mode ENUM('HTTP', 'PUPPETEER') DEFAULT 'HTTP',
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    urls JSON NOT NULL,
    proxy_config JSON,
    execution_config JSON,
    result_summary JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SiteRankGo查询表
CREATE TABLE siterankgo_queries (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    domains JSON NOT NULL,
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    result_data JSON,
    cached BOOLEAN DEFAULT false,
    cache_expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_cached (cached),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 邀请表
CREATE TABLE invitations (
    id VARCHAR(191) PRIMARY KEY,
    inviter_id VARCHAR(191) NOT NULL,
    invited_id VARCHAR(191) UNIQUE,
    code VARCHAR(191) UNIQUE NOT NULL,
    status VARCHAR(191) DEFAULT 'PENDING',
    email VARCHAR(191),
    tokens_reward INT DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_inviter_id (inviter_id),
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 签到表
CREATE TABLE check_ins (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    date DATE NOT NULL,
    tokens INT NOT NULL,
    streak INT DEFAULT 1,
    reward_level INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, date),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 咨询记录表
CREATE TABLE consultation_records (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191),
    type ENUM('SUBSCRIPTION', 'TOKEN_PURCHASE') NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    contact_info VARCHAR(255) NOT NULL,
    request_content JSON,
    response_content TEXT,
    admin_notes TEXT,
    processed_by VARCHAR(191),
    processed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 4.3 API 设计规范

#### 4.3.1 RESTful API 设计原则

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

**响应格式**:
```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1234567890
}
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

**Token API**:
- `GET /api/v1/tokens/balance` - 获取 Token 余额
- `GET /api/v1/tokens/transactions` - 获取交易记录
- `POST /api/v1/tokens/checkin` - 每日签到

### 4.4 安全设计

#### 4.4.1 认证授权

**JWT 策略**:
- Access Token 过期时间：2 小时
- Refresh Token 过期时间：30 天
- 使用 HS256 算法签名

**权限控制**:
- 前端用户：只能访问自己的数据
- 管理员：可访问所有数据
- 套餐权限：通过中间件验证

#### 4.4.2 数据安全

**敏感数据加密**:
- 用户密码：bcrypt 哈希
- API 密钥：AES 加密存储
- 数据库连接：SSL/TLS

**输入验证**:
- 所有输入参数验证
- SQL 注入防护
- XSS 攻击防护

### 4.5 GoFly 集成架构

#### 4.5.1 集成策略

基于 GoFly Admin V3 框架的深度集成：

**1. 目录结构**:
```
gofly_admin_v3/
├── app/
│   ├── admin/           // GoFly 管理后台
│   ├── autoads/         // AutoAds 业务模块
│   │   ├── user/        // 用户管理
│   │   ├── batchgo/     // BatchGo 功能
│   │   ├── siterankgo/  // SiteRankGo 功能
│   │   └── adscentergo/ // AdsCenterGo 功能
│   └── common/          // 公共功能
├── resource/
│   └── config.yaml      // 配置文件
└── main.go              // 入口文件
```

**2. 认证集成**:
- 扩展 GoFly 的 JWT 认证
- 支持 Google OAuth
- 前端用户和管理员分离

**3. 权限集成**:
- 利用 GoFly 的 RBAC 系统
- 自定义业务权限规则
- 数据隔离控制

### 4.6 GoFly 集成实现详解

#### 4.6.1 认证系统集成实现

**扩展 JWT 认证支持 OAuth**:
```go
// app/autoads/auth/jwt.go
package auth

import (
    "github.com/golang-jwt/jwt"
    "gofly/utils/tools/gjwt"
)

type AutoAdsClaims struct {
    UserID       string `json:"user_id"`
    Email        string `json:"email"`
    Role         string `json:"role"`
    PlanID       string `json:"plan_id"`
    TokenBalance int    `json:"token_balance"`
    OAuthType    string `json:"oauth_type"`    // google, email
    OAuthID      string `json:"oauth_id"`      // OAuth 用户唯一标识
    jwt.StandardClaims
}

// 生成 JWT Token
func GenerateToken(user *User) (string, error) {
    claims := AutoAdsClaims{
        UserID:       user.ID,
        Email:        user.Email,
        Role:         user.Role,
        PlanID:       user.PlanID,
        TokenBalance: user.TokenBalance,
        OAuthType:    user.OAuthType,
        OAuthID:      user.OAuthID,
        StandardClaims: jwt.StandardClaims{
            ExpiresAt: time.Now().Add(2 * time.Hour).Unix(),
        },
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte("your-secret-key"))
}
```

**Google OAuth 集成**:
```go
// app/autoads/auth/oauth.go
package auth

import (
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
)

var googleOAuthConfig = &oauth2.Config{
    ClientID:     "your-google-client-id",
    ClientSecret: "your-google-client-secret",
    RedirectURL:  "http://localhost:3000/auth/google/callback",
    Scopes: []string{
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    },
    Endpoint: google.Endpoint,
}

// 处理 Google OAuth 回调
func HandleGoogleCallback(code string) (*User, error) {
    // 1. 获取 access token
    token, err := googleOAuthConfig.Exchange(context.Background(), code)
    if err != nil {
        return nil, err
    }
    
    // 2. 获取用户信息
    client := googleOAuthConfig.Client(context.Background(), token)
    userInfo, err := getUserInfo(client)
    if err != nil {
        return nil, err
    }
    
    // 3. 查找或创建用户
    user, err := findOrCreateOAuthUser(userInfo)
    if err != nil {
        return nil, err
    }
    
    return user, nil
}
```

#### 4.6.2 数据模型设计

**核心数据表结构**:

**users 表**:
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    avatar_url TEXT,
    role ENUM('USER', 'ADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    token_balance INT DEFAULT 0,
    plan_id VARCHAR(36),
    oauth_type ENUM('GOOGLE', 'GITHUB'),
    oauth_id VARCHAR(100),
    email_verified BOOLEAN DEFAULT FALSE,
    trial_start_at DATETIME,
    trial_end_at DATETIME,
    trial_source VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);
```

**token_transactions 表**:
```sql
CREATE TABLE token_transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('RECHARGE', 'CONSUME', 'REFUND', 'BONUS', 'TRIAL') NOT NULL,
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    description TEXT,
    related_id VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**batch_executions 表**:
```sql
CREATE TABLE batch_executions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    execution_mode ENUM('BASIC', 'SILENT', 'AUTOMATED') NOT NULL,
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    token_cost INT DEFAULT 0,
    start_time DATETIME,
    end_time DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**API 设计原则**:
- RESTful API 设计
- 统一响应格式
- JWT 认证
- 请求频率限制
- 详细的错误信息

#### 4.6.3 BatchGo 执行模式设计

**三种执行模式**:

1. **Basic 模式**
   - 实现方式：window.open 批量打开
   - 适用场景：简单批量访问
   - 最大支持：100 URLs/任务

2. **Silent 模式**
   - 实现方式：后台 HTTP 请求
   - 适用场景：无需渲染的 API 调用
   - 性能：最快，资源消耗最少

3. **Automated 模式**
   - 实现方式：Puppeteer 无头浏览器
   - 适用场景：需要页面渲染的复杂操作
   - 功能：支持截图、DOM 操作

**模式自动选择规则**:
- 检测目标 URL 类型
- 分析任务需求
- 根据用户权限选择可用模式
- 考虑系统资源状况

#### 4.6.4 代理管理策略

**代理池设计**:
- 支持多种代理类型（HTTP/HTTPS/SOCKS5）
- 自动检测代理可用性
- 智能代理轮换避免被封
- 代理性能监控和评分

**代理获取策略**:
- 免费代理列表（自动抓取）
- 付费代理服务集成
- 自建代理服务器支持

#### 4.6.5 任务执行引擎

**核心功能**:
- 任务队列管理
- 并发控制
- 失败重试机制
- 实时进度反馈
- 结果统计分析

#### 4.6.6 执行监控实现

**监控指标**:
- 任务成功率
- 平均执行时间
- 代理响应时间
- 错误率统计
- 资源使用情况
        } else {
            // 选择得分最高的模式
            bestMode := HTTPMode
            maxScore := 0.0
            for mode, s := range score {
                if s > maxScore {
                    maxScore = s
                    bestMode = mode
                }
            }
            recommendations[bestMode] = append(recommendations[bestMode], url)
        }
    }
    
    return recommendations, strings.Join(reasons, "；")
}
```

**代理 IP 轮转机制**:
```go
// app/autoads/batchgo/proxy_rotator.go
package batchgo

import (
    "container/list"
    "sync"
    "time"
)

type Proxy struct {
    ID        string
    URL       string
    Type      string // HTTP, HTTPS, SOCKS5
    Status    string // ACTIVE, INACTIVE, ERROR
    LastUsed  time.Time
    Success   int
    Failed    int
    Latency   time.Duration
}

type ProxyRotator struct {
    proxies   *list.List
    current   *list.Element
    mutex     sync.RWMutex
    queue     chan *Task
    workers   int
}

type Task struct {
    URLs      []string
    Proxy     *Proxy
    Mode      AccessMode
    Callback  func(*TaskResult)
}

type TaskResult struct {
    Success   bool
    URL       string
    Proxy     *Proxy
    Duration  time.Duration
    Error     error
}

func NewProxyRotator(proxies []*Proxy, workers int) *ProxyRotator {
    pr := &ProxyRotator{
        proxies: list.New(),
        queue:   make(chan *Task, 1000),
        workers: workers,
    }
    
    // 初始化代理列表
    for _, proxy := range proxies {
        pr.proxies.PushBack(proxy)
    }
    pr.current = pr.proxies.Front()
    
    // 启动工作池
    for i := 0; i < workers; i++ {
        go pr.worker()
    }
    
    return pr
}

// 获取下一个可用代理
func (pr *ProxyRotator) Next() *Proxy {
    pr.mutex.Lock()
    defer pr.mutex.Unlock()
    
    if pr.current == nil {
        pr.current = pr.proxies.Front()
    }
    
    proxy := pr.current.Value.(*Proxy)
    pr.current = pr.current.Next()
    
    return proxy
}

// 执行任务（每个代理完成所有 URL）
func (pr *ProxyRotator) Execute(urls []string, mode AccessMode) <-chan *TaskResult {
    results := make(chan *TaskResult, len(urls))
    
    go func() {
        defer close(results)
        
        // 将任务分配给每个代理
        proxyTasks := make(map[*Proxy][]string)
        proxy := pr.Next()
        
        for i, url := range urls {
            proxyTasks[proxy] = append(proxyTasks[proxy], url)
            
            // 每 N 个 URL 切换一个代理
            if (i+1)%10 == 0 {
                proxy = pr.Next()
            }
        }
        
        // 并发执行每个代理的任务
        var wg sync.WaitGroup
        for proxy, taskURLs := range proxyTasks {
            wg.Add(1)
            go func(p *Proxy, urls []string) {
                defer wg.Done()
                
                for _, url := range urls {
                    start := time.Now()
                    
                    // 执行访问
                    success, err := pr.executeURL(url, p, mode)
                    
                    results <- &TaskResult{
                        Success:  success,
                        URL:      url,
                        Proxy:    p,
                        Duration: time.Since(start),
                        Error:    err,
                    }
                    
                    // 更新代理统计
                    pr.updateProxyStats(p, success, time.Since(start))
                }
            }(proxy, taskURLs)
        }
        
        wg.Wait()
    }()
    
    return results
}

// 执行单个 URL 访问
func (pr *ProxyRotator) executeURL(url string, proxy *Proxy, mode AccessMode) (bool, error) {
    switch mode {
    case HTTPMode:
        return pr.executeHTTP(url, proxy)
    case PuppeteerMode:
        return pr.executePuppeteer(url, proxy)
    default:
        return false, fmt.Errorf("unsupported access mode: %s", mode)
    }
}

// 更新代理统计
func (pr *ProxyRotator) updateProxyStats(proxy *Proxy, success bool, duration time.Duration) {
    pr.mutex.Lock()
    defer pr.mutex.Unlock()
    
    if success {
        proxy.Success++
    } else {
        proxy.Failed++
    }
    
    // 更新平均延迟
    total := proxy.Success + proxy.Failed
    if total == 1 {
        proxy.Latency = duration
    } else {
        proxy.Latency = time.Duration(
            (int64(proxy.Latency)*(total-1) + int64(duration)) / total,
        )
    }
    
    // 失败率过高则标记为错误
    failureRate := float64(proxy.Failed) / float64(total)
    if failureRate > 0.5 && total > 10 {
        proxy.Status = "ERROR"
    }
}
```

#### 4.6.4 Token 消费优先级系统

**Token 消费管理器**:
```go
// app/autoads/token/manager.go
package token

import (
    "errors"
    "sort"
    "time"
)

type TokenSource string
const (
    SourceSubscription TokenSource = "SUBSCRIPTION"
    SourcePurchase     TokenSource = "PURCHASE"
    SourceActivity     TokenSource = "ACTIVITY"
    SourceReferral     TokenSource = "REFERRAL"
)

type TokenBucket struct {
    Source     TokenSource
    Amount     int
    ExpiresAt  *time.Time
    Priority   int // 订阅=10，活动=5，购买=0
}

type TokenManager struct {
    userID string
}

func NewTokenManager(userID string) *TokenManager {
    return &TokenManager{userID: userID}
}

// 消费 Token（按优先级）
func (tm *TokenManager) Consume(amount int, feature string) error {
    // 1. 获取用户所有 Token
    buckets, err := tm.getTokenBuckets()
    if err != nil {
        return err
    }
    
    // 2. 计算总余额
    totalBalance := 0
    for _, bucket := range buckets {
        totalBalance += bucket.Amount
    }
    
    if totalBalance < amount {
        return errors.New("insufficient token balance")
    }
    
    // 3. 按优先级排序
    sort.Slice(buckets, func(i, j int) bool {
        return buckets[i].Priority > buckets[j].Priority
    })
    
    // 4. 执行消费
    remaining := amount
    consumed := make(map[TokenSource]int)
    
    for _, bucket := range buckets {
        if remaining <= 0 {
            break
        }
        
        consumeAmount := min(remaining, bucket.Amount)
        consumed[bucket.Source] = consumeAmount
        remaining -= consumeAmount
    }
    
    // 5. 更新数据库
    return tm.updateTokenBalance(-amount, feature, consumed)
}

// 获取 Token 分桶
func (tm *TokenManager) getTokenBuckets() ([]*TokenBucket, error) {
    transactions, err := GetActiveTokenTransactions(tm.userID)
    if err != nil {
        return nil, err
    }
    
    buckets := make(map[TokenSource]*TokenBucket)
    
    for _, tx := range transactions {
        if tx.Type != "RECHARGE" && tx.Type != "BONUS" {
            continue
        }
        
        source := TokenSource(tx.Source)
        if buckets[source] == nil {
            priority := 0
            switch source {
            case SourceSubscription:
                priority = 10
            case SourceActivity:
                priority = 5
            }
            
            buckets[source] = &TokenBucket{
                Source:   source,
                Priority: priority,
            }
        }
        
        buckets[source].Amount += tx.Amount
        if tx.ExpiresAt != nil {
            buckets[source].ExpiresAt = tx.ExpiresAt
        }
    }
    
    result := make([]*TokenBucket, 0, len(buckets))
    for _, bucket := range buckets {
        result = append(result, bucket)
    }
    
    return result, nil
}

// 处理 Token 过期
func (tm *TokenManager) handleExpiredTokens() error {
    now := time.Now()
    
    // 查找过期但未使用的 Token
    expiredTxs, err := GetExpiredTokenTransactions(tm.userID, now)
    if err != nil {
        return err
    }
    
    for _, tx := range expiredTxs {
        // 创建过期记录
        expiredTx := &TokenTransaction{
            UserID:         tm.userID,
            Type:           "EXPIRED",
            Amount:         -tx.Amount,
            BalanceBefore:  tm.getCurrentBalance(),
            BalanceAfter:   tm.getCurrentBalance() - tx.Amount,
            Source:         tx.Source,
            Description:    fmt.Sprintf("Token expired: %s", tx.ID),
            Feature:        "OTHER",
            RelatedID:      tx.ID,
            CreatedAt:      now,
        }
        
        if err := CreateTokenTransaction(expiredTx); err != nil {
            log.Printf("Failed to record expired token: %v", err)
        }
    }
    
    return nil
}
```

#### 4.6.5 Token 消费规则配置和执行

Token 消费规则系统用于定义不同功能模块的 Token 消费策略，支持按功能、用户套餐、访问模式等维度配置不同的消费规则。

**规则配置结构**:
```go
// app/autoads/token/rule.go
package token

import (
    "database/sql/driver"
    "encoding/json"
    "errors"
    "fmt"
)

// 消费规则定义
type ConsumptionRule struct {
    ID          string                 `json:"id" gorm:"primaryKey"`
    Name        string                 `json:"name" gorm:"not null;size:100"`
    Feature     string                 `json:"feature" gorm:"not null;size:50"`
    Description string                 `json:"description" gorm:"size:500"`
    
    // 适用条件
    UserPlan    string                 `json:"userPlan" gorm:"size:20"`        // FREE/PRO/MAX/ALL
    AccessMode  string                 `json:"accessMode" gorm:"size:20"`      // BASIC/SILENT/AUTOMATED/ALL
    
    // 消费配置
    UnitType    ConsumptionUnitType    `json:"unitType" gorm:"not null;size:20"`
    UnitPrice   int                    `json:"unitPrice" gorm:"not null"`     // 每个 unit 消耗的 Token 数
    MinUnits    int                    `json:"minUnits" gorm:"default:1"`      // 最小消费单位数
    MaxUnits    int                    `json:"maxUnits"`                       // 最大消费单位数
    
    // 高级配置
    Conditions  json.RawMessage         `json:"conditions" gorm:"type:jsonb"`  // 动态条件
    Discounts   json.RawMessage         `json:"discounts" gorm:"type:jsonb"`   // 折扣策略
    
    // 状态控制
    Enabled     bool                   `json:"enabled" gorm:"default:true"`
    Priority    int                    `json:"priority" gorm:"default:0"`      // 规则优先级
    
    // 时间控制
    StartTime   *time.Time             `json:"startTime"`
    EndTime     *time.Time             `json:"endTime"`
    
    CreatedAt   time.Time              `json:"createdAt"`
    UpdatedAt   time.Time              `json:"updatedAt"`
}

// 消费单位类型
type ConsumptionUnitType string

const (
    UnitPerRequest      ConsumptionUnitType = "PER_REQUEST"     // 每次请求
    UnitPerURL          ConsumptionUnitType = "PER_URL"         // 每个 URL
    UnitPerCycle        ConsumptionUnitType = "PER_CYCLE"       // 每个循环
    UnitPerDomain       ConsumptionUnitType = "PER_DOMAIN"      // 每个域名
    UnitPerAccount      ConsumptionUnitType = "PER_ACCOUNT"     // 每个账户
    UnitFixed           ConsumptionUnitType = "FIXED"           // 固定费用
)

// 动态条件
type RuleConditions struct {
    TimeRange     *TimeRangeCondition     `json:"timeRange,omitempty"`
    VolumeRange   *VolumeRangeCondition   `json:"volumeRange,omitempty"`
    UserTier      *UserTierCondition      `json:"userTier,omitempty"`
    CustomFields  map[string]interface{} `json:"customFields,omitempty"`
}

type TimeRangeCondition struct {
    StartHour int `json:"startHour"`  // 开始小时（0-23）
    EndHour   int `json:"endHour"`    // 结束小时（0-23）
    Days      []int `json:"days"`     // 星期几（1-7，1=周一）
}

type VolumeRangeCondition struct {
    MinVolume int `json:"minVolume"`   // 最小数量
    MaxVolume int `json:"maxVolume"`   // 最大数量
}

type UserTierCondition struct {
    Tiers []string `json:"tiers"`      // 用户层级（如：VIP, PREMIUM）
}

// 折扣策略
type DiscountStrategy struct {
    Type        DiscountType `json:"type"`
    Threshold   int          `json:"threshold"`  // 阈值
    Value       float64      `json:"value"`      // 折扣值
    MaxDiscount int          `json:"maxDiscount"` // 最大折扣金额
}

type DiscountType string

const (
    DiscountPercentage DiscountType = "PERCENTAGE"  // 百分比折扣
    DiscountFixed     DiscountType = "FIXED"        // 固定折扣
    DiscountTiered    DiscountType = "TIERED"       // 阶梯折扣
)

// JSON 序列化支持
func (c RuleConditions) Value() (driver.Value, error) {
    return json.Marshal(c)
}

func (c *RuleConditions) Scan(value interface{}) error {
    bytes, ok := value.([]byte)
    if !ok {
        return errors.New("type assertion to []byte failed")
    }
    return json.Unmarshal(bytes, c)
}

func (d DiscountStrategy) Value() (driver.Value, error) {
    return json.Marshal(d)
}

func (d *DiscountStrategy) Scan(value interface{}) error {
    bytes, ok := value.([]byte)
    if !ok {
        return errors.New("type assertion to []byte failed")
    }
    return json.Unmarshal(bytes, d)
}
```

**规则引擎实现**:
```go
// app/autoads/token/engine.go
package token

import (
    "context"
    "sort"
    "strings"
    "time"
)

type RuleEngine struct {
    rules      []*ConsumptionRule
    cache      RuleCache
    repository RuleRepository
}

type ConsumptionContext struct {
    UserID      string
    Feature     string
    UserPlan    string
    AccessMode  string
    Quantity    int
    Volume      int
    RequestTime time.Time
    Metadata    map[string]interface{}
}

type ConsumptionResult struct {
    TotalTokens    int                    `json:"totalTokens"`
    AppliedRules   []*RuleApplication    `json:"appliedRules"`
    DiscountAmount int                    `json:"discountAmount"`
    Breakdown      map[string]int         `json:"breakdown"`
}

type RuleApplication struct {
    RuleID      string  `json:"ruleId"`
    RuleName    string  `json:"ruleName"`
    Units       int     `json:"units"`
    UnitPrice   int     `json:"unitPrice"`
    Subtotal    int     `json:"subtotal"`
    Discount    float64 `json:"discount"`
    FinalAmount int     `json:"finalAmount"`
}

func NewRuleEngine(repo RuleRepository, cache RuleCache) *RuleEngine {
    return &RuleEngine{
        repository: repo,
        cache:      cache,
    }
}

// 计算消费金额
func (re *RuleEngine) CalculateConsumption(ctx context.Context, context *ConsumptionContext) (*ConsumptionResult, error) {
    // 1. 获取适用的规则
    rules, err := re.getApplicableRules(ctx, context)
    if err != nil {
        return nil, err
    }
    
    // 2. 应用规则计算消费
    result := &ConsumptionResult{
        Breakdown: make(map[string]int),
    }
    
    for _, rule := range rules {
        application, err := re.applyRule(rule, context)
        if err != nil {
            continue
        }
        
        result.AppliedRules = append(result.AppliedRules, application)
        result.TotalTokens += application.FinalAmount
        result.Breakdown[rule.Feature] += application.FinalAmount
    }
    
    // 3. 计算总折扣
    result.DiscountAmount = re.calculateTotalDiscount(result.AppliedRules)
    
    return result, nil
}

// 获取适用的规则
func (re *RuleEngine) getApplicableRules(ctx context.Context, context *ConsumptionContext) ([]*ConsumptionRule, error) {
    // 尝试从缓存获取
    cacheKey := fmt.Sprintf("rules:%s:%s:%s", context.Feature, context.UserPlan, context.AccessMode)
    if cached, found := re.cache.Get(ctx, cacheKey); found {
        return cached.([]*ConsumptionRule), nil
    }
    
    // 从数据库查询
    rules, err := re.repository.FindApplicableRules(ctx, &RuleQuery{
        Feature:    context.Feature,
        UserPlan:   context.UserPlan,
        AccessMode: context.AccessMode,
        Enabled:    true,
    })
    if err != nil {
        return nil, err
    }
    
    // 过滤时间和条件
    var applicableRules []*ConsumptionRule
    for _, rule := range rules {
        if re.isRuleApplicable(rule, context) {
            applicableRules = append(applicableRules, rule)
        }
    }
    
    // 按优先级排序
    sort.Slice(applicableRules, func(i, j int) bool {
        return applicableRules[i].Priority > applicableRules[j].Priority
    })
    
    // 缓存结果
    re.cache.Set(ctx, cacheKey, applicableRules, 5*time.Minute)
    
    return applicableRules, nil
}

// 检查规则是否适用
func (re *RuleEngine) isRuleApplicable(rule *ConsumptionRule, context *ConsumptionContext) bool {
    // 检查启用状态
    if !rule.Enabled {
        return false
    }
    
    // 检查时间范围
    now := context.RequestTime
    if rule.StartTime != nil && now.Before(*rule.StartTime) {
        return false
    }
    if rule.EndTime != nil && now.After(*rule.EndTime) {
        return false
    }
    
    // 检查套餐匹配
    if rule.UserPlan != "ALL" && rule.UserPlan != context.UserPlan {
        return false
    }
    
    // 检查访问模式
    if rule.AccessMode != "ALL" && rule.AccessMode != context.AccessMode {
        return false
    }
    
    // 检查动态条件
    var conditions RuleConditions
    if rule.Conditions != nil {
        if err := json.Unmarshal(rule.Conditions, &conditions); err == nil {
            if !re.checkConditions(&conditions, context) {
                return false
            }
        }
    }
    
    return true
}

// 检查动态条件
func (re *RuleEngine) checkConditions(conditions *RuleConditions, context *ConsumptionContext) bool {
    // 时间范围条件
    if conditions.TimeRange != nil {
        hour := context.RequestTime.Hour()
        weekday := int(context.RequestTime.Weekday())
        if weekday == 0 {
            weekday = 7 // 周日
        }
        
        // 检查小时范围
        if conditions.TimeRange.StartHour <= conditions.TimeRange.EndHour {
            if hour < conditions.TimeRange.StartHour || hour > conditions.TimeRange.EndHour {
                return false
            }
        } else {
            // 跨天范围（如 22:00 - 06:00）
            if hour < conditions.TimeRange.StartHour && hour > conditions.TimeRange.EndHour {
                return false
            }
        }
        
        // 检查星期
        if len(conditions.TimeRange.Days) > 0 {
            found := false
            for _, day := range conditions.TimeRange.Days {
                if day == weekday {
                    found = true
                    break
                }
            }
            if !found {
                return false
            }
        }
    }
    
    // 数量范围条件
    if conditions.VolumeRange != nil {
        if context.Volume < conditions.VolumeRange.MinVolume {
            return false
        }
        if conditions.VolumeRange.MaxVolume > 0 && context.Volume > conditions.VolumeRange.MaxVolume {
            return false
        }
    }
    
    // 用户层级条件
    if conditions.UserTier != nil && len(conditions.UserTier.Tiers) > 0 {
        userTier := re.getUserTier(context.UserID)
        found := false
        for _, tier := range conditions.UserTier.Tiers {
            if strings.EqualFold(userTier, tier) {
                found = true
                break
            }
        }
        if !found {
            return false
        }
    }
    
    return true
}

// 应用规则计算消费
func (re *RuleEngine) applyRule(rule *ConsumptionRule, context *ConsumptionContext) (*RuleApplication, error) {
    // 计算消费单位数
    units := re.calculateUnits(rule, context)
    if units < rule.MinUnits {
        units = rule.MinUnits
    }
    if rule.MaxUnits > 0 && units > rule.MaxUnits {
        units = rule.MaxUnits
    }
    
    // 计算小计
    subtotal := units * rule.UnitPrice
    
    // 计算折扣
    discount := 0.0
    if rule.Discounts != nil {
        var discounts DiscountStrategy
        if err := json.Unmarshal(rule.Discounts, &discounts); err == nil {
            discount = re.calculateDiscount(&discounts, subtotal, context)
        }
    }
    
    // 计算最终金额
    finalAmount := int(float64(subtotal) * (1 - discount))
    
    return &RuleApplication{
        RuleID:      rule.ID,
        RuleName:    rule.Name,
        Units:       units,
        UnitPrice:   rule.UnitPrice,
        Subtotal:    subtotal,
        Discount:    discount,
        FinalAmount: finalAmount,
    }, nil
}

// 计算消费单位数
func (re *RuleEngine) calculateUnits(rule *ConsumptionRule, context *ConsumptionContext) int {
    switch rule.UnitType {
    case UnitPerRequest:
        return 1
    case UnitPerURL:
        return context.Quantity
    case UnitPerCycle:
        return context.Quantity
    case UnitPerDomain:
        return context.Volume
    case UnitPerAccount:
        return context.Quantity
    case UnitFixed:
        return 1
    default:
        return 1
    }
}

// 计算折扣
func (re *RuleEngine) calculateDiscount(discount *DiscountStrategy, subtotal int, context *ConsumptionContext) float64 {
    switch discount.Type {
    case DiscountPercentage:
        return discount.Value / 100.0
        
    case DiscountFixed:
        discountAmount := float64(discount.Value)
        maxDiscount := float64(discount.MaxDiscount)
        if maxDiscount > 0 && discountAmount > maxDiscount {
            return maxDiscount / float64(subtotal)
        }
        return discountAmount / float64(subtotal)
        
    case DiscountTiered:
        // 阶梯折扣逻辑
        if subtotal >= discount.Threshold {
            return discount.Value / 100.0
        }
        return 0
        
    default:
        return 0
    }
}

// 计算总折扣
func (re *RuleEngine) calculateTotalDiscount(applications []*RuleApplication) int {
    totalDiscount := 0
    for _, app := range applications {
        totalDiscount += app.Subtotal - app.FinalAmount
    }
    return totalDiscount
}

// 获取用户层级（示例实现）
func (re *RuleEngine) getUserTier(userID string) string {
    // 实际实现中，这里可能需要查询用户数据库或缓存
    return "STANDARD"
}
```

**初始消费规则配置**:
```go
// app/autoads/token/rules_init.go
package token

import "time"

// GetInitialRules 返回系统初始化时的默认消费规则
func GetInitialRules() []*ConsumptionRule {
    now := time.Now()
    
    return []*ConsumptionRule{
        // SiteRank 查询规则
        {
            ID:          "rule-siterank-query",
            Name:        "网站排名查询",
            Feature:     "SITERANK_QUERY",
            Description: "每次查询网站排名消耗的 Token",
            UserPlan:    "ALL",
            AccessMode:  "ALL",
            UnitType:    UnitPerDomain,
            UnitPrice:   1,  // 每个域名 1 Token
            MinUnits:    1,
            MaxUnits:    0,
            Enabled:     true,
            Priority:    100,
            CreatedAt:   now,
        },
        
        // BatchGo 执行规则
        {
            ID:          "rule-batchgo-basic",
            Name:        "BatchGo 基础执行",
            Feature:     "BATCHGO_EXECUTE",
            Description: "BatchGo 基础模式执行的 Token 消费",
            UserPlan:    "FREE",
            AccessMode:  "BASIC",
            UnitType:    UnitPerRequest,
            UnitPrice:   10,  // 每次 10 Tokens
            MinUnits:    1,
            Enabled:     true,
            Priority:    90,
            CreatedAt:   now,
        },
        {
            ID:          "rule-batchgo-silent",
            Name:        "BatchGo 静默执行",
            Feature:     "BATCHGO_EXECUTE",
            Description: "BatchGo 静默模式执行的 Token 消费",
            UserPlan:    "PRO",
            AccessMode:  "SILENT",
            UnitType:    UnitPerRequest,
            UnitPrice:   20,  // 每次 20 Tokens
            MinUnits:    1,
            Enabled:     true,
            Priority:    90,
            CreatedAt:   now,
        },
        {
            ID:          "rule-batchgo-automated",
            Name:        "BatchGo 自动化执行",
            Feature:     "BATCHGO_EXECUTE",
            Description: "BatchGo 自动化模式执行的 Token 消费",
            UserPlan:    "MAX",
            AccessMode:  "AUTOMATED",
            UnitType:    UnitPerRequest,
            UnitPrice:   50,  // 每次 50 Tokens
            MinUnits:    1,
            Enabled:     true,
            Priority:    90,
            CreatedAt:   now,
        },
        
        // AdsCenterGo 规则
        {
            ID:          "rule-adscenter-account",
            Name:        "AdsCenter 账户管理",
            Feature:     "ADSCENTER_ACCOUNT",
            Description: "管理 Google Ads 账户的 Token 消费",
            UserPlan:    "PRO",
            AccessMode:  "ALL",
            UnitType:    UnitPerAccount,
            UnitPrice:   100,  // 每个账户 100 Tokens/月
            MinUnits:    1,
            Enabled:     true,
            Priority:    80,
            CreatedAt:   now,
        },
        {
            ID:          "rule-adscenter-automation",
            Name:        "AdsCenter 自动化执行",
            Feature:     "ADSCENTER_AUTOMATION",
            Description: "执行广告自动化任务的 Token 消费",
            UserPlan:    "MAX",
            AccessMode:  "ALL",
            UnitType:    UnitPerRequest,
            UnitPrice:   30,  // 每次 30 Tokens
            MinUnits:    1,
            Enabled:     true,
            Priority:    80,
            CreatedAt:   now,
        },
        
        // API 调用规则
        {
            ID:          "rule-api-call",
            Name:        "API 调用",
            Feature:     "API_CALL",
            Description: "通过 API 调用功能的 Token 消费",
            UserPlan:    "ALL",
            AccessMode:  "ALL",
            UnitType:    UnitPerRequest,
            UnitPrice:   1,  // 每次 1 Token
            MinUnits:    1,
            Enabled:     true,
            Priority:    70,
            CreatedAt:   now,
        },
        
        // 高级功能折扣规则
        {
            ID:          "rule-volume-discount",
            Name:        "批量查询折扣",
            Feature:     "SITERANK_QUERY",
            Description: "批量查询网站排名时的数量折扣",
            UserPlan:    "PRO",
            AccessMode:  "ALL",
            UnitType:    UnitPerDomain,
            UnitPrice:   1,
            MinUnits:    1,
            Conditions:  json.RawMessage(`{"volumeRange": {"minVolume": 100, "maxVolume": 0}}`),
            Discounts:   json.RawMessage(`{"type": "PERCENTAGE", "value": 10, "threshold": 100}`),
            Enabled:     true,
            Priority:    60,
            CreatedAt:   now,
        },
        {
            ID:          "rule-vip-discount",
            Name:        "VIP 用户折扣",
            Feature:     "ALL",
            Description: "VIP 用户享受的所有功能折扣",
            UserPlan:    "MAX",
            AccessMode:  "ALL",
            UnitType:    UnitPerRequest,
            UnitPrice:   1,
            Conditions:  json.RawMessage(`{"userTier": {"tiers": ["VIP", "PREMIUM"]}}`),
            Discounts:   json.RawMessage(`{"type": "PERCENTAGE", "value": 20, "threshold": 0}`),
            Enabled:     true,
            Priority:    50,
            CreatedAt:   now,
        },
        
        // 时间段优惠规则
        {
            ID:          "rule-night-discount",
            Name:        "夜间优惠",
            Feature:     "BATCHGO_EXECUTE",
            Description: "夜间执行 BatchGo 任务的优惠",
            UserPlan:    "ALL",
            AccessMode:  "ALL",
            UnitType:    UnitPerRequest,
            UnitPrice:   1,
            Conditions:  json.RawMessage(`{"timeRange": {"startHour": 22, "endHour": 6, "days": [1,2,3,4,5,6,7]}}`),
            Discounts:   json.RawMessage(`{"type": "PERCENTAGE", "value": 15, "threshold": 0}`),
            Enabled:     true,
            Priority:    40,
            CreatedAt:   now,
        },
    }
}
```

**规则管理 API**:
```go
// app/autoads/token/api.go
package token

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
)

type RuleHandler struct {
    engine     *RuleEngine
    repository RuleRepository
}

func NewRuleHandler(engine *RuleEngine, repo RuleRepository) *RuleHandler {
    return &RuleHandler{
        engine:     engine,
        repository: repo,
    }
}

// 注册路由
func (h *RuleHandler) RegisterRoutes(router *gin.RouterGroup) {
    rules := router.Group("/token-rules")
    {
        rules.POST("", h.CreateRule)
        rules.GET("", h.ListRules)
        rules.GET("/:id", h.GetRule)
        rules.PUT("/:id", h.UpdateRule)
        rules.DELETE("/:id", h.DeleteRule)
        rules.POST("/:id/enable", h.EnableRule)
        rules.POST("/:id/disable", h.DisableRule)
        rules.POST("/calculate", h.CalculateConsumption)
        rules.POST("/test", h.TestRule)
    }
}

// 创建规则
func (h *RuleHandler) CreateRule(c *gin.Context) {
    var rule ConsumptionRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    if err := h.repository.Create(c.Request.Context(), &rule); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusCreated, rule)
}

// 计算消费
func (h *RuleHandler) CalculateConsumption(c *gin.Context) {
    var req CalculateConsumptionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    context := &ConsumptionContext{
        UserID:      req.UserID,
        Feature:     req.Feature,
        UserPlan:    req.UserPlan,
        AccessMode:  req.AccessMode,
        Quantity:    req.Quantity,
        Volume:      req.Volume,
        RequestTime: time.Now(),
        Metadata:    req.Metadata,
    }
    
    result, err := h.engine.CalculateConsumption(c.Request.Context(), context)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, result)
}

// 测试规则
func (h *RuleHandler) TestRule(c *gin.Context) {
    var req TestRuleRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // 创建临时规则
    rule := &ConsumptionRule{
        ID:         "test-rule",
        Name:       "Test Rule",
        Feature:    req.Feature,
        UserPlan:   req.UserPlan,
        AccessMode: req.AccessMode,
        UnitType:   req.UnitType,
        UnitPrice:  req.UnitPrice,
        Conditions: req.Conditions,
        Discounts:  req.Discounts,
    }
    
    context := &ConsumptionContext{
        UserID:      req.UserID,
        Feature:     req.Feature,
        UserPlan:    req.UserPlan,
        AccessMode:  req.AccessMode,
        Quantity:    req.Quantity,
        Volume:      req.Volume,
        RequestTime: time.Now(),
    }
    
    // 应用规则
    application, err := h.engine.applyRule(rule, context)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "rule":        rule,
        "application": application,
    })
}
```

### 4.7 监控与运维

#### 4.7.1 指标监控

**系统指标**:
- CPU 使用率
- 内存使用量
- 磁盘使用量
- 网络流量

**业务指标**:
- 用户注册数
- 任务执行数
- Token 消费量
- API 调用量

#### 4.6.2 日志管理

**日志级别**:
- ERROR：错误信息
- WARN：警告信息
- INFO：一般信息
- DEBUG：调试信息

**日志存储**:
- 文件存储 + Elasticsearch
- 日志轮转和归档
- 保留 30 天

#### 4.7.3 监控告警系统实现

**指标收集器**:
```go
// app/autoads/monitor/metrics.go
package monitor

import (
    "context"
    "runtime"
    "time"
    
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
    "gofly/utils/tools/gtimer"
)

var (
    // 业务指标
    TaskCounter = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "autoads_tasks_total",
            Help: "Total number of tasks processed",
        },
        []string{"type", "status"},
    )
    
    TaskDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "autoads_task_duration_seconds",
            Help:    "Task execution duration",
            Buckets: prometheus.DefBuckets,
        },
        []string{"type"},
    )
    
    TokenUsage = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "autoads_tokens_consumed_total",
            Help: "Total tokens consumed",
        },
        []string{"user_id", "feature"},
    )
    
    // API 指标
    APICounter = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "autoads_api_requests_total",
            Help: "Total API requests",
        },
        []string{"endpoint", "method", "status"},
    )
    
    APIDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "autoads_api_duration_seconds",
            Help:    "API request duration",
            Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
        },
        []string{"endpoint", "method"},
    )
    
    // 系统指标
    SystemMemory = promauto.NewGaugeFunc(
        prometheus.GaugeOpts{
            Name: "autoads_system_memory_bytes",
            Help: "System memory usage",
        },
        func() float64 {
            var m runtime.MemStats
            runtime.ReadMemStats(&m)
            return float64(m.Alloc)
        },
    )
    
    ActiveGoroutines = promauto.NewGaugeFunc(
        prometheus.GaugeOpts{
            Name: "autoads_goroutines_active",
            Help: "Number of active goroutines",
        },
        func() float64 {
            return float64(runtime.NumGoroutine())
        },
    )
)

type MetricsCollector struct {
    ctx context.Context
}

func NewMetricsCollector(ctx context.Context) *MetricsCollector {
    return &MetricsCollector{
        ctx: ctx,
    }
}

func (mc *MetricsCollector) Start() {
    // 定期收集自定义指标
    gtimer.AddSingleton(mc.ctx, time.Minute, func(ctx context.Context) {
        mc.collectCustomMetrics()
    })
}

func (mc *MetricsCollector) collectCustomMetrics() {
    // 收集数据库连接数
    if dbPool := GetDBPool(); dbPool != nil {
        activeConns := float64(dbPool.ActiveCount())
        idleConns := float64(dbPool.IdleCount())
        
        promauto.NewGauge(prometheus.GaugeOpts{
            Name: "autoads_db_connections_active",
        }).Set(activeConns)
        
        promauto.NewGauge(prometheus.GaugeOpts{
            Name: "autoads_db_connections_idle",
        }).Set(idleConns)
    }
    
    // 收集缓存命中率
    if cache := GetCache(); cache != nil {
        hitRate := cache.HitRate()
        promauto.NewGauge(prometheus.GaugeOpts{
            Name: "autoads_cache_hit_rate",
        }).Set(hitRate)
    }
}

// 记录任务指标
func RecordTaskMetrics(taskType string, duration time.Duration, success bool) {
    status := "success"
    if !success {
        status = "failed"
    }
    
    TaskCounter.WithLabelValues(taskType, status).Inc()
    TaskDuration.WithLabelValues(taskType).Observe(duration.Seconds())
}

// 记录 API 指标
func RecordAPIMetrics(endpoint, method, status string, duration time.Duration) {
    APICounter.WithLabelValues(endpoint, method, status).Inc()
    APIDuration.WithLabelValues(endpoint, method).Observe(duration.Seconds())
}

// 记录 Token 消费
func RecordTokenUsage(userID, feature string, amount float64) {
    TokenUsage.WithLabelValues(userID, feature).Add(amount)
}
```

**告警管理器**:
```go
// app/autoads/monitor/alert.go
package monitor

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "sort"
    "sync"
    "time"
)

type AlertLevel string

const (
    LevelInfo    AlertLevel = "info"
    LevelWarning AlertLevel = "warning"
    LevelError   AlertLevel = "error"
    LevelCritical AlertLevel = "critical"
)

type Alert struct {
    ID        string                 `json:"id"`
    Level     AlertLevel             `json:"level"`
    Title     string                 `json:"title"`
    Message   string                 `json:"message"`
    Tags      map[string]string      `json:"tags"`
    Timestamp time.Time              `json:"timestamp"`
    Resolved  bool                   `json:"resolved"`
    Metadata  map[string]interface{} `json:"metadata"`
}

type AlertRule struct {
    ID          string        `json:"id"`
    Name        string        `json:"name"`
    Condition   string        `json:"condition"`
    Level       AlertLevel    `json:"level"`
    Duration    time.Duration `json:"duration"`
    Threshold   float64       `json:"threshold"`
    Query       string        `json:"query"`
    Enabled     bool          `json:"enabled"`
    LastTrigger time.Time     `json:"last_trigger"`
}

type Notifier interface {
    Send(ctx context.Context, alert *Alert) error
    Name() string
}

type AlertManager struct {
    rules      map[string]*AlertRule
    notifiers  []Notifier
    alerts     map[string]*Alert
    mu         sync.RWMutex
    httpClient *http.Client
}

func NewAlertManager() *AlertManager {
    return &AlertManager{
        rules:      make(map[string]*AlertRule),
        notifiers:  make([]Notifier, 0),
        alerts:     make(map[string]*Alert),
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
}

func (am *AlertManager) AddRule(rule *AlertRule) {
    am.mu.Lock()
    defer am.mu.Unlock()
    
    am.rules[rule.ID] = rule
}

func (am *AlertManager) AddNotifier(notifier Notifier) {
    am.notifiers = append(am.notifiers, notifier)
}

func (am *AlertManager) Evaluate(ctx context.Context, metrics map[string]interface{}) {
    am.mu.RLock()
    defer am.mu.RUnlock()
    
    for _, rule := range am.rules {
        if !rule.Enabled {
            continue
        }
        
        // 执行查询
        value, err := am.executeQuery(rule.Query, metrics)
        if err != nil {
            continue
        }
        
        // 检查条件
        triggered := false
        switch rule.Condition {
        case ">", ">=":
            triggered = value >= rule.Threshold
        case "<", "<=":
            triggered = value <= rule.Threshold
        case "==":
            triggered = value == rule.Threshold
        case "!=":
            triggered = value != rule.Threshold
        }
        
        if triggered {
            // 检查持续时间
            if time.Since(rule.LastTrigger) >= rule.Duration {
                am.triggerAlert(rule, value)
                rule.LastTrigger = time.Now()
            }
        }
    }
}

func (am *AlertManager) triggerAlert(rule *AlertRule, value float64) {
    alert := &Alert{
        ID:        fmt.Sprintf("%s-%d", rule.ID, time.Now().Unix()),
        Level:     rule.Level,
        Title:     rule.Name,
        Message:   fmt.Sprintf("Threshold %.2f exceeded: %.2f", rule.Threshold, value),
        Tags:      map[string]string{"rule_id": rule.ID},
        Timestamp: time.Now(),
        Metadata: map[string]interface{}{
            "threshold": rule.Threshold,
            "value":     value,
            "query":     rule.Query,
        },
    }
    
    // 保存告警
    am.alerts[alert.ID] = alert
    
    // 发送通知
    for _, notifier := range am.notifiers {
        go func(n Notifier) {
            if err := n.Send(context.Background(), alert); err != nil {
                fmt.Printf("Failed to send alert via %s: %v\n", n.Name(), err)
            }
        }(notifier)
    }
}

func (am *AlertManager) executeQuery(query string, metrics map[string]interface{}) (float64, error) {
    // 简化的查询执行
    // 实际实现可以使用 PromQL 或自定义表达式
    if value, ok := metrics[query]; ok {
        switch v := value.(type) {
        case float64:
            return v, nil
        case int:
            return float64(v), nil
        case int64:
            return float64(v), nil
        }
    }
    return 0, fmt.Errorf("metric not found: %s", query)
}

// 飞书 Webhook 通知器
type FeishuNotifier struct {
    webhookURL string
}

func NewFeishuNotifier(webhookURL string) *FeishuNotifier {
    return &FeishuNotifier{
        webhookURL: webhookURL,
    }
}

func (fn *FeishuNotifier) Send(ctx context.Context, alert *Alert) error {
    message := map[string]interface{}{
        "msg_type": "interactive",
        "card": map[string]interface{}{
            "config": map[string]interface{}{
                "wide_screen_mode": true,
            },
            "elements": []map[string]interface{}{
                {
                    "tag": "div",
                    "text": map[string]interface{}{
                        "content": fmt.Sprintf("**%s**\n\n%s", alert.Title, alert.Message),
                        "tag":     "lark_md",
                    },
                },
                {
                    "tag": "hr",
                },
                {
                    "tag": "action",
                    "actions": []map[string]interface{}{
                        {
                            "tag":  "button",
                            "text": map[string]interface{}{"content": "查看详情", "tag": "plain_text"},
                            "type": "primary",
                            "url":  fmt.Sprintf("http://localhost:3000/alerts/%s", alert.ID),
                        },
                    },
                },
            },
        },
    }
    
    data, _ := json.Marshal(message)
    resp, err := http.Post(fn.webhookURL, "application/json", bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != 200 {
        return fmt.Errorf("feishu webhook returned status %d", resp.StatusCode)
    }
    
    return nil
}

func (fn *FeishuNotifier) Name() string {
    return "Feishu Webhook"
}
```

**健康检查端点**:
```go
// app/autoads/monitor/health.go
package monitor

import (
    "context"
    "database/sql"
    "encoding/json"
    "net/http"
    "time"
    
    "gofly/utils/gf"
    "gofly/utils/tools/gredis"
)

type HealthStatus struct {
    Status      string            `json:"status"`
    Timestamp   time.Time         `json:"timestamp"`
    Version     string            `json:"version"`
    Components  map[string]bool   `json:"components"`
    Metrics     map[string]float64 `json:"metrics"`
    Checks      []HealthCheck     `json:"checks"`
}

type HealthCheck struct {
    Name     string        `json:"name"`
    Status   string        `json:"status"`
    Duration time.Duration `json:"duration"`
    Error    string        `json:"error,omitempty"`
}

type HealthChecker interface {
    Check(ctx context.Context) HealthCheck
    Name() string
}

func NewHealthHandler() http.Handler {
    checkers := []HealthChecker{
        &DatabaseChecker{},
        &RedisChecker{},
        &APIChecker{},
    }
    
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()
        
        status := HealthStatus{
            Status:     "healthy",
            Timestamp:  time.Now(),
            Version:    "4.0.0",
            Components: make(map[string]bool),
            Metrics:    make(map[string]float64),
            Checks:     make([]HealthCheck, 0),
        }
        
        // 执行所有检查
        allHealthy := true
        for _, checker := range checkers {
            check := checker.Check(ctx)
            status.Checks = append(status.Checks, check)
            
            if check.Status == "healthy" {
                status.Components[checker.Name()] = true
            } else {
                status.Components[checker.Name()] = false
                allHealthy = false
            }
        }
        
        if !allHealthy {
            status.Status = "unhealthy"
        }
        
        // 收集系统指标
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        status.Metrics = map[string]float64{
            "memory_alloc":     float64(m.Alloc),
            "memory_sys":       float64(m.Sys),
            "goroutines":       float64(runtime.NumGoroutine()),
            "uptime_seconds":   time.Since(startTime).Seconds(),
        }
        
        w.Header().Set("Content-Type", "application/json")
        if allHealthy {
            w.WriteHeader(http.StatusOK)
        } else {
            w.WriteHeader(http.StatusServiceUnavailable)
        }
        
        json.NewEncoder(w).Encode(status)
    })
}

var startTime = time.Now()

// 数据库健康检查
type DatabaseChecker struct{}

func (dc *DatabaseChecker) Check(ctx context.Context) HealthCheck {
    start := time.Now()
    
    db := gf.DB()
    if err := db.Exec("SELECT 1").Error; err != nil {
        return HealthCheck{
            Name:     "database",
            Status:   "unhealthy",
            Duration: time.Since(start),
            Error:    err.Error(),
        }
    }
    
    return HealthCheck{
        Name:     "database",
        Status:   "healthy",
        Duration: time.Since(start),
    }
}

func (dc *DatabaseChecker) Name() string {
    return "database"
}

// Redis 健康检查
type RedisChecker struct{}

func (rc *RedisChecker) Check(ctx context.Context) HealthCheck {
    start := time.Now()
    
    redis := gf.Redis()
    if err := redis.Ping(ctx).Err(); err != nil {
        return HealthCheck{
            Name:     "redis",
            Status:   "unhealthy",
            Duration: time.Since(start),
            Error:    err.Error(),
        }
    }
    
    return HealthCheck{
        Name:     "redis",
        Status:   "healthy",
        Duration: time.Since(start),
    }
}

func (rc *RedisChecker) Name() string {
    return "redis"
}

// API 健康检查
type APIChecker struct{}

func (ac *APIChecker) Check(ctx context.Context) HealthCheck {
    start := time.Now()
    
    // 检查关键 API 端点
    client := &http.Client{Timeout: 5 * time.Second}
    resp, err := client.Get("http://localhost:8080/api/health")
    if err != nil {
        return HealthCheck{
            Name:     "api",
            Status:   "unhealthy",
            Duration: time.Since(start),
            Error:    err.Error(),
        }
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return HealthCheck{
            Name:     "api",
            Status:   "unhealthy",
            Duration: time.Since(start),
            Error:    fmt.Sprintf("status code: %d", resp.StatusCode),
        }
    }
    
    return HealthCheck{
        Name:     "api",
        Status:   "healthy",
        Duration: time.Since(start),
    }
}

func (ac *APIChecker) Name() string {
    return "api"
}
```

### 4.7 第三方 API 集成模式

#### 4.7.1 统一 API 客户端架构

**基础客户端抽象**:
```go
// app/autoads/api/client.go
package api

import (
    "context"
    "time"
    
    "gofly/utils/gf"
    "gofly/utils/tools/gcache"
)

type APIClient interface {
    // 基础请求方法
    Request(ctx context.Context, endpoint string, params interface{}) (*APIResponse, error)
    
    // 批量请求
    BatchRequest(ctx context.Context, requests []APIRequest) ([]*APIResponse, error)
    
    // 健康检查
    HealthCheck(ctx context.Context) error
    
    // 获取配额信息
    GetQuota(ctx context.Context) (*APIQuota, error)
}

type APIRequest struct {
    Endpoint string      `json:"endpoint"`
    Params   interface{} `json:"params"`
    Priority int         `json:"priority"` // 优先级 1-10
}

type APIResponse struct {
    Success   bool        `json:"success"`
    Data      interface{} `json:"data"`
    Error     string      `json:"error"`
    QuotaUsed int         `json:"quota_used"`
    Duration  time.Duration `json:"duration"`
}

type APIQuota struct {
    DailyLimit   int `json:"daily_limit"`
    DailyUsed    int `json:"daily_used"`
    MonthlyLimit int `json:"monthly_limit"`
    MonthlyUsed  int `json:"monthly_used"`
    ResetTime    time.Time `json:"reset_time"`
}

// API 客户端工厂
func NewClient(apiType string, config *APIConfig) APIClient {
    switch apiType {
    case "similarweb":
        return NewSimilarWebClient(config)
    case "googleads":
        return NewGoogleAdsClient(config)
    case "adspower":
        return NewAdsPowerClient(config)
    default:
        panic("unsupported API type: " + apiType)
    }
}
```

#### 4.7.2 SimilarWeb API 集成实现

**带缓存的 SimilarWeb 客户端**:
```go
// app/autoads/api/similarweb.go
package api

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "strconv"
    "strings"
    "time"
    
    "gofly/utils/gf"
    "gofly/utils/tools/gcache"
)

type SimilarWebClient struct {
    baseURL    string
    apiKey     string
    httpClient *http.Client
    cache      gcache.Cache
    quota      *APIQuota
}

type SimilarWebRequest struct {
    Domain   string `json:"domain"`
    Metric   string `json:"metric"` // traffic, engagement, demographics
    Period   string `json:"period"` // monthly, weekly, daily
    Country  string `json:"country"`
}

type SimilarWebResponse struct {
    Domain       string                 `json:"domain"`
    Metric       string                 `json:"metric"`
    Period       string                 `json:"period"`
    Data         map[string]interface{} `json:"data"`
    Timestamp    time.Time              `json:"timestamp"`
    Cached       bool                   `json:"cached"`
}

func NewSimilarWebClient(config *APIConfig) *SimilarWebClient {
    return &SimilarWebClient{
        baseURL:    "https://api.similarweb.com/v1",
        apiKey:     config.APIKey,
        httpClient: &http.Client{Timeout: 30 * time.Second},
        cache:      gcache.New(),
        quota: &APIQuota{
            DailyLimit:   config.DailyLimit,
            MonthlyLimit: config.MonthlyLimit,
        },
    }
}

func (c *SimilarWebClient) Request(ctx context.Context, endpoint string, params interface{}) (*APIResponse, error) {
    req := params.(*SimilarWebRequest)
    
    // 生成缓存键
    cacheKey := fmt.Sprintf("similarweb:%s:%s:%s:%s", 
        req.Domain, req.Metric, req.Period, req.Country)
    
    // 尝试从缓存获取
    if cached, err := c.cache.Get(ctx, cacheKey); err == nil {
        var response SimilarWebResponse
        if err := json.Unmarshal([]byte(cached.String()), &response); err == nil {
            response.Cached = true
            return &APIResponse{
                Success:  true,
                Data:     response,
                Duration: 0,
            }, nil
        }
    }
    
    // 检查配额
    if c.quota.DailyUsed >= c.quota.DailyLimit {
        return nil, fmt.Errorf("daily quota exceeded")
    }
    
    // 构建请求 URL
    u, err := url.Parse(c.baseURL + endpoint)
    if err != nil {
        return nil, err
    }
    
    q := u.Query()
    q.Set("api_key", c.apiKey)
    q.Set("domain", req.Domain)
    q.Set("metric", req.Metric)
    q.Set("period", req.Period)
    if req.Country != "" {
        q.Set("country", req.Country)
    }
    u.RawQuery = q.Encode()
    
    // 发送请求
    start := time.Now()
    resp, err := c.httpClient.Get(u.String())
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // 解析响应
    var result map[string]interface{}
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    duration := time.Since(start)
    
    // 构建响应
    response := &SimilarWebResponse{
        Domain:    req.Domain,
        Metric:    req.Metric,
        Period:    req.Period,
        Data:      result,
        Timestamp: time.Now(),
        Cached:    false,
    }
    
    // 缓存结果（根据数据类型设置不同的 TTL）
    ttl := time.Hour
    if req.Period == "daily" {
        ttl = 6 * time.Hour
    } else if req.Period == "weekly" {
        ttl = 24 * time.Hour
    }
    
    if data, err := json.Marshal(response); err == nil {
        c.cache.Set(ctx, cacheKey, data, ttl)
    }
    
    // 更新配额
    c.quota.DailyUsed++
    c.quota.MonthlyUsed++
    
    return &APIResponse{
        Success:   true,
        Data:      response,
        QuotaUsed: 1,
        Duration:  duration,
    }, nil
}

func (c *SimilarWebClient) BatchRequest(ctx context.Context, requests []APIRequest) ([]*APIResponse, error) {
    results := make([]*APIResponse, len(requests))
    
    // 使用 GoFly 的并发工具
    for i, req := range requests {
        result, err := c.Request(ctx, req.Endpoint, req.Params)
        if err != nil {
            results[i] = &APIResponse{
                Success: false,
                Error:   err.Error(),
            }
        } else {
            results[i] = result
        }
    }
    
    return results, nil
}

func (c *SimilarWebClient) HealthCheck(ctx context.Context) error {
    testReq := &SimilarWebRequest{
        Domain: "google.com",
        Metric: "traffic",
        Period: "monthly",
    }
    
    _, err := c.Request(ctx, "/website-rank", testReq)
    return err
}

func (c *SimilarWebClient) GetQuota(ctx context.Context) (*APIQuota, error) {
    return c.quota, nil
}
```

#### 4.7.3 Google Ads API 集成实现

**OAuth 2.0 + Google Ads API 客户端**:
```go
// app/autoads/api/googleads.go
package api

import (
    "context"
    "fmt"
    "time"
    
    "google.golang.org/api/option"
    "google.golang.org/api/transport"
    googleads "google.golang.org/api/googleads/v15"
    
    "gofly/utils/gf"
    "gofly/utils/tools/gcache"
)

type GoogleAdsClient struct {
    customerID string
    config     *APIConfig
    service    *googleads.Service
    cache      gcache.Cache
    oauthToken string
}

type GoogleAdsRequest struct {
    CustomerID string                 `json:"customer_id"`
    Query      string                 `json:"query"`
    Variables  map[string]interface{} `json:"variables"`
}

type GoogleAdsResponse struct {
    Results []map[string]interface{} `json:"results"`
    Summary map[string]interface{}   `json:"summary"`
}

func NewGoogleAdsClient(config *APIConfig) *GoogleAdsClient {
    return &GoogleAdsClient{
        customerID: config.CustomerID,
        config:     config,
        cache:      gcache.New(),
    }
}

// 初始化 Google Ads 服务
func (c *GoogleAdsClient) InitService(ctx context.Context) error {
    // 使用 OAuth 2.0 token 创建 HTTP 客户端
    client, err := transport.NewHTTPClient(ctx, option.WithTokenSource(
        oauth2.TokenSource{
            Token: &oauth2.Token{
                AccessToken: c.oauthToken,
                TokenType:   "Bearer",
            },
        },
    ))
    if err != nil {
        return err
    }
    
    // 创建 Google Ads 服务
    service, err := googleads.NewService(ctx, option.WithHTTPClient(client))
    if err != nil {
        return err
    }
    
    c.service = service
    return nil
}

func (c *GoogleAdsClient) Request(ctx context.Context, endpoint string, params interface{}) (*APIResponse, error) {
    req := params.(*GoogleAdsRequest)
    
    // 缓存键
    cacheKey := fmt.Sprintf("googleads:%s:%s", req.CustomerID, req.Query)
    
    // 检查缓存
    if cached, err := c.cache.Get(ctx, cacheKey); err == nil {
        var response GoogleAdsResponse
        if err := json.Unmarshal([]byte(cached.String()), &response); err == nil {
            return &APIResponse{
                Success: true,
                Data:    response,
            }, nil
        }
    }
    
    // 执行 Google Ads 查询
    searchRequest := &googleads.SearchGoogleAdsRequest{
        CustomerId: req.CustomerID,
        Query:      req.Query,
    }
    
    start := time.Now()
    response, err := c.service.Customers.Search(searchRequest).Do()
    if err != nil {
        return nil, err
    }
    
    duration := time.Since(start)
    
    // 转换响应格式
    result := &GoogleAdsResponse{
        Results: make([]map[string]interface{}, len(response.Results)),
        Summary: make(map[string]interface{}),
    }
    
    for i, row := range response.Results {
        result.Results[i] = row.ToMap()
    }
    
    // 缓存结果
    if data, err := json.Marshal(result); err == nil {
        // Google Ads 数据缓存时间较短
        ttl := 5 * time.Minute
        c.cache.Set(ctx, cacheKey, data, ttl)
    }
    
    return &APIResponse{
        Success:  true,
        Data:     result,
        Duration: duration,
    }, nil
}

// 获取广告系列列表
func (c *GoogleAdsClient) GetCampaigns(ctx context.Context, customerID string) ([]*APIResponse, error) {
    query := `
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.bidding_strategy_type,
            campaign.advertising_channel_type,
            campaign.start_date,
            campaign.end_date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 50
    `
    
    req := &GoogleAdsRequest{
        CustomerID: customerID,
        Query:      query,
    }
    
    return c.BatchRequest(ctx, []APIRequest{
        {
            Endpoint: "search",
            Params:   req,
            Priority: 5,
        },
    })
}
```

#### 4.7.4 AdsPower API 集成实现

**浏览器自动化管理客户端**:
```go
// app/autoads/api/adspower.go
package api

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    
    "gofly/utils/gf"
)

type AdsPowerClient struct {
    baseURL    string
    apiKey     string
    httpClient *http.Client
    profiles   map[string]*BrowserProfile
}

type BrowserProfile struct {
    ID          string            `json:"id"`
    Name        string            `json:"name"`
    GroupID     string            `json:"group_id"`
    Status      string            `json:"status"`
    Proxy       string            `json:"proxy"`
    Fingerprint map[string]string `json:"fingerprint"`
    LastUsed    time.Time         `json:"last_used"`
}

type AutomationTask struct {
    ProfileID  string                 `json:"profile_id"`
    Actions    []AutomationAction     `json:"actions"`
    Variables  map[string]interface{} `json:"variables"`
    Timeout    time.Duration          `json:"timeout"`
}

type AutomationAction struct {
    Type   string                 `json:"type"`   // click, input, wait, navigate, screenshot
    Params map[string]interface{} `json:"params"`
}

func NewAdsPowerClient(config *APIConfig) *AdsPowerClient {
    return &AdsPowerClient{
        baseURL:    config.BaseURL,
        apiKey:     config.APIKey,
        httpClient: &http.Client{Timeout: 60 * time.Second},
        profiles:   make(map[string]*BrowserProfile),
    }
}

// 获取浏览器配置文件列表
func (c *AdsPowerClient) GetProfiles(ctx context.Context) ([]*BrowserProfile, error) {
    url := fmt.Sprintf("%s/api/v1/browser/profile/list?api_key=%s", c.baseURL, c.apiKey)
    
    resp, err := c.httpClient.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Code    int                `json:"code"`
        Message string             `json:"msg"`
        Data    []*BrowserProfile  `json:"data"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    if result.Code != 0 {
        return nil, fmt.Errorf("AdsPower API error: %s", result.Message)
    }
    
    // 更新缓存
    for _, profile := range result.Data {
        c.profiles[profile.ID] = profile
    }
    
    return result.Data, nil
}

// 启动浏览器
func (c *AdsPowerClient) StartBrowser(ctx context.Context, profileID string) (*BrowserSession, error) {
    url := fmt.Sprintf("%s/api/v1/browser/start?api_key=%s&profile_id=%s", 
        c.baseURL, c.apiKey, profileID)
    
    resp, err := c.httpClient.Post(url, "application/json", nil)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Code    int             `json:"code"`
        Message string          `json:"msg"`
        Data    *BrowserSession `json:"data"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    if result.Code != 0 {
        return nil, fmt.Errorf("AdsPower API error: %s", result.Message)
    }
    
    return result.Data, nil
}

// 执行自动化任务
func (c *AdsPowerClient) ExecuteTask(ctx context.Context, task *AutomationTask) (*TaskResult, error) {
    // 1. 启动浏览器
    session, err := c.StartBrowser(ctx, task.ProfileID)
    if err != nil {
        return nil, err
    }
    defer c.StopBrowser(ctx, session.ID)
    
    // 2. 执行任务
    result := &TaskResult{
        ProfileID: task.ProfileID,
        Actions:   make([]ActionResult, len(task.Actions)),
        StartTime: time.Now(),
    }
    
    for i, action := range task.Actions {
        actionResult, err := c.executeAction(ctx, session, action)
        if err != nil {
            result.Actions[i] = ActionResult{
                Type:    action.Type,
                Success: false,
                Error:   err.Error(),
            }
            break
        }
        result.Actions[i] = *actionResult
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    
    return result, nil
}

// 执行单个动作
func (c *AdsPowerClient) executeAction(ctx context.Context, session *BrowserSession, action AutomationAction) (*ActionResult, error) {
    url := fmt.Sprintf("%s/api/v1/browser/execute?api_key=%s&session_id=%s", 
        c.baseURL, c.apiKey, session.ID)
    
    reqBody, _ := json.Marshal(action)
    resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(reqBody))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Code    int         `json:"code"`
        Message string      `json:"msg"`
        Data    interface{} `json:"data"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    return &ActionResult{
        Type:    action.Type,
        Success: result.Code == 0,
        Data:    result.Data,
    }, nil
}

// 停止浏览器
func (c *AdsPowerClient) StopBrowser(ctx context.Context, sessionID string) error {
    url := fmt.Sprintf("%s/api/v1/browser/stop?api_key=%s&session_id=%s", 
        c.baseURL, c.apiKey, sessionID)
    
    resp, err := c.httpClient.Post(url, "application/json", nil)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    return nil
}
```

#### 4.7.5 API 调用优化策略

**1. 批量请求合并**:
```go
// app/autoads/api/batch_optimizer.go
package api

import (
    "context"
    "sync"
    "time"
)

type BatchOptimizer struct {
    maxSize    int
    maxWait    time.Duration
    queue      chan *APIRequest
    clients    map[string]APIClient
    mutex      sync.RWMutex
}

func NewBatchOptimizer(maxSize int, maxWait time.Duration) *BatchOptimizer {
    bo := &BatchOptimizer{
        maxSize: maxSize,
        maxWait: maxWait,
        queue:   make(chan *APIRequest, 1000),
        clients: make(map[string]APIClient),
    }
    
    go bo.processBatches()
    
    return bo
}

// 批量处理请求
func (bo *BatchOptimizer) processBatches() {
    ticker := time.NewTicker(bo.maxWait)
    defer ticker.Stop()
    
    batch := make([]*APIRequest, 0, bo.maxSize)
    
    for {
        select {
        case req := <-bo.queue:
            batch = append(batch, req)
            
            if len(batch) >= bo.maxSize {
                go bo.executeBatch(batch)
                batch = make([]*APIRequest, 0, bo.maxSize)
            }
            
        case <-ticker.C:
            if len(batch) > 0 {
                go bo.executeBatch(batch)
                batch = make([]*APIRequest, 0, bo.maxSize)
            }
        }
    }
}

// 执行批量请求
func (bo *BatchOptimizer) executeBatch(requests []*APIRequest) {
    // 按 API 类型分组
    groups := make(map[string][]*APIRequest)
    for _, req := range requests {
        groups[req.Endpoint] = append(groups[req.Endpoint], req)
    }
    
    // 并发执行各组请求
    var wg sync.WaitGroup
    for apiType, reqs := range groups {
        wg.Add(1)
        go func(at string, rs []*APIRequest) {
            defer wg.Done()
            
            if client, ok := bo.clients[at]; ok {
                client.BatchRequest(context.Background(), rs)
            }
        }(apiType, reqs)
    }
    
    wg.Wait()
}
```

**2. 智能重试机制**:
```go
// app/autoads/api/retry.go
package api

import (
    "context"
    "math"
    "math/rand"
    "time"
)

type RetryPolicy struct {
    MaxRetries    int           `json:"max_retries"`
    InitialDelay  time.Duration `json:"initial_delay"`
    MaxDelay      time.Duration `json:"max_delay"`
    BackoffFactor float64       `json:"backoff_factor"`
    Jitter        bool          `json:"jitter"`
}

type RetryableClient struct {
    client   APIClient
    policy   *RetryPolicy
}

func NewRetryableClient(client APIClient, policy *RetryPolicy) *RetryableClient {
    return &RetryableClient{
        client: client,
        policy: policy,
    }
}

func (rc *RetryableClient) Request(ctx context.Context, endpoint string, params interface{}) (*APIResponse, error) {
    var lastErr error
    
    for attempt := 0; attempt <= rc.policy.MaxRetries; attempt++ {
        resp, err := rc.client.Request(ctx, endpoint, params)
        if err == nil {
            return resp, nil
        }
        
        lastErr = err
        
        // 检查是否可重试的错误
        if !isRetryableError(err) {
            break
        }
        
        // 计算延迟时间
        delay := rc.calculateDelay(attempt)
        
        // 等待
        select {
        case <-time.After(delay):
            continue
        case <-ctx.Done():
            return nil, ctx.Err()
        }
    }
    
    return nil, lastErr
}

// 计算指数退避延迟
func (rc *RetryableClient) calculateDelay(attempt int) time.Duration {
    delay := float64(rc.policy.InitialDelay) * 
        math.Pow(rc.policy.BackoffFactor, float64(attempt))
    
    if delay > float64(rc.policy.MaxDelay) {
        delay = float64(rc.policy.MaxDelay)
    }
    
    if rc.policy.Jitter {
        // 添加随机抖动
        jitter := rand.Float64() * 0.1 * delay
        delay += jitter
    }
    
    return time.Duration(delay)
}

// 判断是否可重试的错误
func isRetryableError(err error) bool {
    // 根据错误类型判断
    return true
}
```

### 4.8 AdsCenterGo 实现详解

AdsCenterGo 是 ChangeLink 功能的 Go 语言重构版本，提供 Google Ads 多账户管理和自动化广告投放功能。

#### 4.8.1 核心架构设计

**模块结构**:
```
app/autoads/adscentergo/
├── account/          # Google Ads 账户管理
├── campaign/         # 广告活动管理
├── adgroup/          # 广告组管理
├── ad/               # 广告创意管理
├── keyword/          # 关键词管理
├── automation/       # 自动化规则引擎
├── monitoring/       # 执行监控
├── rule/             # 链接替换规则
└── client/           # API 客户端
```

**数据流设计**:
1. **账户同步层**: 定期同步 Google Ads 账户数据
2. **规则引擎层**: 处理链接替换和自动化规则
3. **执行层**: 通过 AdsPower 执行实际操作
4. **监控层**: 实时监控执行状态和结果

#### 4.8.2 Google Ads API 集成实现

**多账户管理器**:
```go
// app/autoads/adscentergo/account/manager.go
package account

import (
    "context"
    "sync"
    
    "google.golang.org/api/googleads/v16"
)

type AccountManager struct {
    clients map[string]*googleads.Service
    mutex   sync.RWMutex
    config  *AccountConfig
}

type AccountConfig struct {
    DeveloperToken   string
    ClientID         string
    ClientSecret     string
    RefreshToken     string
    LoginCustomerID  string
}

func NewAccountManager(config *AccountConfig) *AccountManager {
    return &AccountManager{
        clients: make(map[string]*googleads.Service),
        config:  config,
    }
}

// 添加 Google Ads 账户
func (am *AccountManager) AddAccount(customerID string) error {
    am.mutex.Lock()
    defer am.mutex.Unlock()
    
    // 创建 Google Ads 客户端
    client, err := googleads.NewService(
        context.Background(),
        am.config.DeveloperToken,
        customerID,
    )
    if err != nil {
        return err
    }
    
    am.clients[customerID] = client
    return nil
}

// 获取账户信息
func (am *AccountManager) GetAccountInfo(customerID string) (*AccountInfo, error) {
    am.mutex.RLock()
    client, exists := am.clients[customerID]
    am.mutex.RUnlock()
    
    if !exists {
        return nil, fmt.Errorf("account not found: %s", customerID)
    }
    
    // 查询账户信息
    req := &googleads.GetCustomerRequest{
        ResourceName: fmt.Sprintf("customers/%s", customerID),
    }
    
    customer, err := client.GetCustomer(context.Background(), req)
    if err != nil {
        return nil, err
    }
    
    return &AccountInfo{
        ID:          customer.Id,
        Name:        customer.DescriptiveName,
        Currency:    customer.CurrencyCode,
        TimeZone:    customer.TimeZone,
        Status:      customer.Status,
    }, nil
}

// 批量获取所有账户
func (am *AccountManager) GetAllAccounts() ([]*AccountInfo, error) {
    am.mutex.RLock()
    defer am.mutex.RUnlock()
    
    var accounts []*AccountInfo
    for customerID := range am.clients {
        info, err := am.GetAccountInfo(customerID)
        if err != nil {
            continue
        }
        accounts = append(accounts, info)
    }
    
    return accounts, nil
}
```

**广告活动管理器**:
```go
// app/autoads/adscentergo/campaign/manager.go
package campaign

import (
    "context"
    "fmt"
    
    "google.golang.org/api/googleads/v16"
)

type CampaignManager struct {
    accountManager *account.AccountManager
}

type Campaign struct {
    ID             string
    Name           string
    Status         string
    Budget         float64
    BiddingStrategy string
    StartDate      string
    EndDate        string
}

func NewCampaignManager(am *account.AccountManager) *CampaignManager {
    return &CampaignManager{
        accountManager: am,
    }
}

// 创建广告活动
func (cm *CampaignManager) CreateCampaign(customerID string, campaign *Campaign) error {
    client, err := cm.accountManager.GetClient(customerID)
    if err != nil {
        return err
    }
    
    // 构建创建请求
    req := &googleads.CreateCampaignRequest{
        CustomerId: customerID,
        Campaign: &googleads.Campaign{
            Name:         campaign.Name,
            Status:       campaign.Status,
            AdvertisingChannelType: "SEARCH",
            
            // 预算设置
            Budget: &googleads.CampaignBudget{
                AmountMicros: int64(campaign.Budget * 1000000),
            },
            
            // 出价策略
            BiddingStrategyType: campaign.BiddingStrategy,
            
            // 日期设置
            StartDate: campaign.StartDate,
            EndDate:   campaign.EndDate,
        },
    }
    
    // 执行创建
    resp, err := client.CreateCampaign(context.Background(), req)
    if err != nil {
        return err
    }
    
    campaign.ID = resp.ResourceName
    return nil
}

// 获取广告活动列表
func (cm *CampaignManager) ListCampaigns(customerID string) ([]*Campaign, error) {
    client, err := cm.accountManager.GetClient(customerID)
    if err != nil {
        return nil, err
    }
    
    req := &googleads.ListCampaignsRequest{
        CustomerId: customerID,
    }
    
    resp, err := client.ListCampaigns(context.Background(), req)
    if err != nil {
        return nil, err
    }
    
    var campaigns []*Campaign
    for _, c := range resp.Campaigns {
        campaigns = append(campaigns, &Campaign{
            ID:             c.ResourceName,
            Name:           c.Name,
            Status:         c.Status,
            Budget:         float64(c.Budget.AmountMicros) / 1000000,
            BiddingStrategy: c.BiddingStrategyType,
            StartDate:      c.StartDate,
            EndDate:        c.EndDate,
        })
    }
    
    return campaigns, nil
}
```

#### 4.8.3 链接替换规则引擎

**规则定义**:
```go
// app/autoads/adscentergo/rule/engine.go
package rule

import (
    "regexp"
    "strings"
)

type ReplacementRule struct {
    ID          string
    Name        string
    Pattern     string      // 匹配模式
    Replacement string      // 替换内容
    Type        RuleType    // 规则类型
    Priority    int         // 优先级
    Enabled     bool        // 是否启用
}

type RuleType int

const (
    RuleTypeRegex RuleType = iota // 正则表达式
    RuleTypeString               // 字符串替换
    RuleTypePrefix               // 前缀替换
    RuleTypeSuffix               // 后缀替换
)

type RuleEngine struct {
    rules    []*ReplacementRule
    compiled map[string]*regexp.Regexp
}

func NewRuleEngine() *RuleEngine {
    return &RuleEngine{
        rules:    make([]*ReplacementRule, 0),
        compiled: make(map[string]*regexp.Regexp),
    }
}

// 添加规则
func (re *RuleEngine) AddRule(rule *ReplacementRule) error {
    // 如果是正则表达式规则，预编译
    if rule.Type == RuleTypeRegex {
        regex, err := regexp.Compile(rule.Pattern)
        if err != nil {
            return err
        }
        re.compiled[rule.ID] = regex
    }
    
    re.rules = append(re.rules, rule)
    
    // 按优先级排序
    sort.Slice(re.rules, func(i, j int) bool {
        return re.rules[i].Priority > re.rules[j].Priority
    })
    
    return nil
}

// 执行链接替换
func (re *RuleEngine) ReplaceLink(originalURL string) (string, []*RuleLog) {
    var logs []*RuleLog
    result := originalURL
    
    for _, rule := range re.rules {
        if !rule.Enabled {
            continue
        }
        
        var applied bool
        var newResult string
        
        switch rule.Type {
        case RuleTypeRegex:
            if regex, exists := re.compiled[rule.ID]; exists {
                newResult = regex.ReplaceAllString(result, rule.Replacement)
                applied = newResult != result
            }
            
        case RuleTypeString:
            newResult = strings.ReplaceAll(result, rule.Pattern, rule.Replacement)
            applied = newResult != result
            
        case RuleTypePrefix:
            if strings.HasPrefix(result, rule.Pattern) {
                newResult = rule.Replacement + strings.TrimPrefix(result, rule.Pattern)
                applied = true
            }
            
        case RuleTypeSuffix:
            if strings.HasSuffix(result, rule.Pattern) {
                newResult = strings.TrimSuffix(result, rule.Pattern) + rule.Replacement
                applied = true
            }
        }
        
        if applied {
            logs = append(logs, &RuleLog{
                RuleID:       rule.ID,
                RuleName:     rule.Name,
                OriginalURL:  result,
                ReplacedURL:  newResult,
                AppliedAt:    time.Now(),
            })
            result = newResult
        }
    }
    
    return result, logs
}

// 批量处理链接
func (re *RuleEngine) BatchReplaceLinks(urls []string) ([]string, []*RuleLog) {
    var allLogs []*RuleLog
    results := make([]string, len(urls))
    
    for i, url := range urls {
        replaced, logs := re.ReplaceLink(url)
        results[i] = replaced
        allLogs = append(allLogs, logs...)
    }
    
    return results, allLogs
}
```

#### 4.8.4 AdsPower API 集成实现

**AdsPower 客户端**:
```go
// app/autoads/adscentergo/client/adspower.go
package client

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type AdsPowerClient struct {
    baseURL    string
    httpClient *http.Client
}

type Profile struct {
    ID       string `json:"group_id"`
    Name     string `json:"group_name"`
    Status   string `json:"status"`
    Browser  string `json:"browser_type"`
}

func NewAdsPowerClient(baseURL string) *AdsPowerClient {
    return &AdsPowerClient{
        baseURL: baseURL,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

// 启动浏览器配置文件
func (apc *AdsPowerClient) StartProfile(profileID string) (*ProfileSession, error) {
    url := fmt.Sprintf("%s/api/v1/browser/start?group_id=%s", apc.baseURL, profileID)
    
    resp, err := apc.httpClient.Get(url)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var result struct {
        Code    int             `json:"code"`
        Msg     string          `json:"msg"`
        Data    *ProfileSession `json:"data"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    if result.Code != 0 {
        return nil, fmt.Errorf("AdsPower API error: %s", result.Msg)
    }
    
    return result.Data, nil
}

// 关闭浏览器配置文件
func (apc *AdsPowerClient) CloseProfile(profileID string) error {
    url := fmt.Sprintf("%s/api/v1/browser/stop?group_id=%s", apc.baseURL, profileID)
    
    resp, err := apc.httpClient.Get(url)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    var result struct {
        Code int    `json:"code"`
        Msg  string `json:"msg"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return err
    }
    
    if result.Code != 0 {
        return fmt.Errorf("AdsPower API error: %s", result.Msg)
    }
    
    return nil
}

// 执行浏览器自动化
func (apc *AdsPowerClient) ExecuteAutomation(profileID string, automation *AutomationTask) error {
    // 1. 启动浏览器
    session, err := apc.StartProfile(profileID)
    if err != nil {
        return err
    }
    defer apc.CloseProfile(profileID)
    
    // 2. 连接到 Chrome DevTools Protocol
    cdpClient := NewCDPClient(session.WsURL)
    defer cdpClient.Close()
    
    // 3. 执行自动化任务
    ctx := context.Background()
    
    // 导航到目标页面
    if err := cdpClient.Navigate(ctx, automation.URL); err != nil {
        return err
    }
    
    // 等待页面加载
    if err := cdpClient.WaitForLoad(ctx); err != nil {
        return err
    }
    
    // 执行链接替换
    if automation.ReplaceLinks {
        links, err := cdpClient.ExtractLinks(ctx)
        if err != nil {
            return err
        }
        
        // 使用规则引擎替换链接
        replacedLinks, logs := re.ReplaceLinks(links)
        
        // 更新页面中的链接
        if err := cdpClient.ReplaceLinks(ctx, replacedLinks); err != nil {
            return err
        }
    }
    
    // 执行其他自动化操作
    for _, action := range automation.Actions {
        if err := apc.executeAction(ctx, cdpClient, action); err != nil {
            return err
        }
    }
    
    return nil
}

// 执行单个动作
func (apc *AdsPowerClient) executeAction(ctx context.Context, cdpClient *CDPClient, action *AutomationAction) error {
    switch action.Type {
    case "click":
        return cdpClient.Click(ctx, action.Selector)
        
    case "input":
        return cdpClient.Input(ctx, action.Selector, action.Value)
        
    case "wait":
        time.Sleep(time.Duration(action.Timeout) * time.Second)
        return nil
        
    case "screenshot":
        return cdpClient.Screenshot(ctx, action.Filename)
        
    default:
        return fmt.Errorf("unknown action type: %s", action.Type)
    }
}
```

#### 4.8.5 执行监控实现

**任务监控器**:
```go
// app/autoads/adscentergo/monitoring/monitor.go
package monitoring

import (
    "context"
    "sync"
    "time"
)

type TaskMonitor struct {
    tasks      map[string]*TaskStatus
    mutex      sync.RWMutex
    notifier   *Notifier
    storage    TaskStorage
}

type TaskStatus struct {
    ID          string
    Type        string
    Status      string // running, completed, failed
    Progress    int    // 0-100
    StartTime   time.Time
    EndTime     *time.Time
    Error       error
    Metrics     *TaskMetrics
    Logs        []*TaskLog
}

type TaskMetrics struct {
    TotalActions    int
    CompletedActions int
    FailedActions   int
    Duration        time.Duration
    SuccessRate     float64
}

func NewTaskMonitor(notifier *Notifier, storage TaskStorage) *TaskMonitor {
    return &TaskMonitor{
        tasks:    make(map[string]*TaskStatus),
        notifier: notifier,
        storage:  storage,
    }
}

// 开始监控任务
func (tm *TaskMonitor) StartTask(ctx context.Context, taskID string, taskType string) {
    tm.mutex.Lock()
    defer tm.mutex.Unlock()
    
    status := &TaskStatus{
        ID:        taskID,
        Type:      taskType,
        Status:    "running",
        StartTime: time.Now(),
        Metrics:   &TaskMetrics{},
        Logs:      make([]*TaskLog, 0),
    }
    
    tm.tasks[taskID] = status
    
    // 保存到存储
    tm.storage.SaveTaskStatus(ctx, status)
}

// 更新任务进度
func (tm *TaskMonitor) UpdateProgress(ctx context.Context, taskID string, progress int, message string) {
    tm.mutex.Lock()
    defer tm.mutex.Unlock()
    
    if task, exists := tm.tasks[taskID]; exists {
        task.Progress = progress
        task.Metrics.CompletedActions = progress
        
        // 添加日志
        task.Logs = append(task.Logs, &TaskLog{
            Timestamp: time.Now(),
            Message:   message,
            Level:     "info",
        })
        
        // 检查是否完成
        if progress >= 100 {
            task.Status = "completed"
            now := time.Now()
            task.EndTime = &now
            task.Metrics.Duration = now.Sub(task.StartTime)
            task.Metrics.SuccessRate = float64(task.Metrics.CompletedActions) / float64(task.Metrics.TotalActions)
        }
        
        // 保存更新
        tm.storage.SaveTaskStatus(ctx, task)
        
        // 发送通知
        if progress%10 == 0 { // 每10%发送一次进度通知
            tm.notifier.SendProgressNotification(taskID, progress, message)
        }
    }
}

// 处理任务失败
func (tm *TaskMonitor) HandleFailure(ctx context.Context, taskID string, err error) {
    tm.mutex.Lock()
    defer tm.mutex.Unlock()
    
    if task, exists := tm.tasks[taskID]; exists {
        task.Status = "failed"
        task.Error = err
        now := time.Now()
        task.EndTime = &now
        task.Metrics.Duration = now.Sub(task.StartTime)
        
        // 添加错误日志
        task.Logs = append(task.Logs, &TaskLog{
            Timestamp: time.Now(),
            Message:   err.Error(),
            Level:     "error",
        })
        
        // 保存状态
        tm.storage.SaveTaskStatus(ctx, task)
        
        // 发送失败通知
        tm.notifier.SendFailureNotification(taskID, err)
    }
}

// 获取任务状态
func (tm *TaskMonitor) GetTaskStatus(taskID string) (*TaskStatus, error) {
    tm.mutex.RLock()
    defer tm.mutex.RUnlock()
    
    if task, exists := tm.tasks[taskID]; exists {
        return task, nil
    }
    
    // 从存储中加载
    return tm.storage.GetTaskStatus(context.Background(), taskID)
}

// 获取所有任务状态
func (tm *TaskMonitor) GetAllTasks() ([]*TaskStatus, error) {
    tm.mutex.RLock()
    defer tm.mutex.RUnlock()
    
    tasks := make([]*TaskStatus, 0, len(tm.tasks))
    for _, task := range tm.tasks {
        tasks = append(tasks, task)
    }
    
    return tasks, nil
}
```

#### 4.8.6 API 端点设计

**RESTful API 设计**:
```go
// app/autoads/adscentergo/api/handler.go
package api

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
)

type AdsCenterHandler struct {
    accountManager  *account.AccountManager
    campaignManager *campaign.CampaignManager
    ruleEngine      *rule.RuleEngine
    taskMonitor     *monitoring.TaskMonitor
    adspowerClient  *client.AdsPowerClient
}

func NewAdsCenterHandler(
    am *account.AccountManager,
    cm *campaign.CampaignManager,
    re *rule.RuleEngine,
    tm *monitoring.TaskMonitor,
    apc *client.AdsPowerClient,
) *AdsCenterHandler {
    return &AdsCenterHandler{
        accountManager:  am,
        campaignManager: cm,
        ruleEngine:      re,
        taskMonitor:     tm,
        adspowerClient:  apc,
    }
}

// 注册路由
func (h *AdsCenterHandler) RegisterRoutes(router *gin.RouterGroup) {
    // 账户管理
    accounts := router.Group("/accounts")
    {
        accounts.POST("", h.CreateAccount)
        accounts.GET("", h.ListAccounts)
        accounts.GET("/:id", h.GetAccount)
        accounts.PUT("/:id", h.UpdateAccount)
        accounts.DELETE("/:id", h.DeleteAccount)
        accounts.POST("/:id/sync", h.SyncAccount)
    }
    
    // 广告活动管理
    campaigns := router.Group("/campaigns")
    {
        campaigns.POST("", h.CreateCampaign)
        campaigns.GET("", h.ListCampaigns)
        campaigns.GET("/:id", h.GetCampaign)
        campaigns.PUT("/:id", h.UpdateCampaign)
        campaigns.DELETE("/:id", h.DeleteCampaign)
        campaigns.POST("/:id/start", h.StartCampaign)
        campaigns.POST("/:id/stop", h.StopCampaign)
    }
    
    // 规则管理
    rules := router.Group("/rules")
    {
        rules.POST("", h.CreateRule)
        rules.GET("", h.ListRules)
        rules.GET("/:id", h.GetRule)
        rules.PUT("/:id", h.UpdateRule)
        rules.DELETE("/:id", h.DeleteRule)
        rules.POST("/test", h.TestRule)
    }
    
    // 任务管理
    tasks := router.Group("/tasks")
    {
        tasks.POST("", h.CreateTask)
        tasks.GET("", h.ListTasks)
        tasks.GET("/:id", h.GetTask)
        tasks.GET("/:id/status", h.GetTaskStatus)
        tasks.POST("/:id/stop", h.StopTask)
        tasks.GET("/:id/logs", h.GetTaskLogs)
    }
    
    // 自动化执行
    automation := router.Group("/automation")
    {
        automation.POST("/execute", h.ExecuteAutomation)
        automation.POST("/batch-execute", h.BatchExecuteAutomation)
        automation.GET("/profiles", h.ListAdsPowerProfiles)
        automation.POST("/profiles/:id/start", h.StartProfile)
        automation.POST("/profiles/:id/stop", h.StopProfile)
    }
}

// 创建账户
func (h *AdsCenterHandler) CreateAccount(c *gin.Context) {
    var req CreateAccountRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // 添加账户
    err := h.accountManager.AddAccount(req.CustomerID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    // 获取账户信息
    info, err := h.accountManager.GetAccountInfo(req.CustomerID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusCreated, gin.H{
        "message": "Account created successfully",
        "account": info,
    })
}

// 执行自动化任务
func (h *AdsCenterHandler) ExecuteAutomation(c *gin.Context) {
    var req ExecuteAutomationRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // 创建任务ID
    taskID := generateTaskID()
    
    // 开始监控
    h.taskMonitor.StartTask(c.Request.Context(), taskID, "automation")
    
    // 异步执行
    go func() {
        defer func() {
            if r := recover(); r != nil {
                h.taskMonitor.HandleFailure(c.Request.Context(), taskID, fmt.Errorf("panic: %v", r))
            }
        }()
        
        // 执行自动化
        err := h.adspowerClient.ExecuteAutomation(req.ProfileID, &client.AutomationTask{
            URL:          req.URL,
            ReplaceLinks: req.ReplaceLinks,
            Actions:      req.Actions,
        })
        
        if err != nil {
            h.taskMonitor.HandleFailure(c.Request.Context(), taskID, err)
        } else {
            h.taskMonitor.UpdateProgress(c.Request.Context(), taskID, 100, "Task completed successfully")
        }
    }()
    
    c.JSON(http.StatusAccepted, gin.H{
        "task_id": taskID,
        "message": "Automation task started",
    })
}
```

### 4.9 配置管理

#### 4.9.1 GoFly 配置文件

**主配置文件 (resource/config.yaml)**:
```yaml
# 数据库配置
database:
  driver: mysql
  host: ${DB_HOST:localhost}
  port: ${DB_PORT:3306}
  username: ${DB_USERNAME:autoads}
  password: ${DB_PASSWORD:autoads123}
  dbname: ${DB_NAME:autoads}
  charset: utf8mb4
  parseTime: true
  loc: Local
  maxIdleConns: 10
  maxOpenConns: 100
  connMaxLifetime: 3600

# Redis 配置
redis:
  host: ${REDIS_HOST:localhost}
  port: ${REDIS_PORT:6379}
  password: ${REDIS_PASSWORD:}
  db: ${REDIS_DB:0}
  poolSize: 10

# JWT 配置
jwt:
  secret: ${JWT_SECRET:your-jwt-secret-key}
  expires: 7200  # 2小时
  refreshExpires: 2592000  # 30天

# 应用配置
app:
  name: AutoAds
  version: 1.0.0
  debug: ${DEBUG:false}
  port: ${PORT:8080}
  
# OAuth 配置
oauth:
  google:
    clientID: ${GOOGLE_CLIENT_ID}
    clientSecret: ${GOOGLE_CLIENT_SECRET}
    redirectURL: ${GOOGLE_REDIRECT_URL:http://localhost:3000/auth/google/callback}

# 第三方 API 配置
apis:
  similarweb:
    apiUrl: ${SIMILARWEB_API_URL:-https://data.similarweb.com/api/v1/data}
    baseUrl: https://data.similarweb.com
    rateLimit: 1000  # 每月调用限制
    # 注意：SimilarWeb 服务通过模拟浏览器请求获取公开数据，无需 API 密钥
    
  googleAds:
    developerToken: ${GOOGLE_ADS_DEVELOPER_TOKEN}
    clientId: ${GOOGLE_ADS_CLIENT_ID}
    clientSecret: ${GOOGLE_ADS_CLIENT_SECRET}
    refreshToken: ${GOOGLE_ADS_REFRESH_TOKEN}

# 业务模块配置
modules:
  batchgo:
    enabled: true
    maxConcurrentTasks: 50
    defaultTimeout: 300  # 5分钟
    proxyCheckInterval: 60  # 代理检查间隔
    
  siterankgo:
    enabled: true
    cacheTTL: 86400  # 24小时缓存
    maxDomainsPerQuery: 1000
    
  adscentergo:
    enabled: true
    maxAccounts: 100
    taskQueueSize: 1000

# 监控配置
monitoring:
  enabled: true
  metricsPort: 9090
  healthCheckInterval: 30
```

#### 4.8.2 环境变量配置

**开发环境 (.env.development)**:
```bash
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=dev_user
DB_PASSWORD=dev_password
DB_NAME=autoads_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=dev-jwt-secret-very-long-string

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=http://localhost:3000/auth/google/callback

# 第三方 API
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
GOOGLE_ADS_DEVELOPER_TOKEN=your-ads-dev-token

# 应用配置
DEBUG=true
PORT=8080
```

**生产环境 (.env.production)**:
```bash
# 数据库
DB_HOST=prod-db.example.com
DB_PORT=3306
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=autoads_prod

# Redis
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}

# OAuth
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URL=https://autoads.example.com/auth/google/callback

# 应用配置
DEBUG=false
PORT=8080
```

#### 4.8.3 生产环境完整变量文档

**1. 核心应用配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `NODE_ENV` | `production` | ✅ | 应用运行环境 |
| `NEXT_PUBLIC_DEPLOYMENT_ENV` | `production` | ✅ | 部署环境标识 |
| `NEXT_PUBLIC_DOMAIN` | `autoads.dev` | ✅ | 应用域名 |
| `PORT` | `3000` | ❌ | 应用端口 |

**2. 数据库配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `DATABASE_URL` | - | ✅ | PostgreSQL 连接字符串 |
| `DATABASE_SSL` | `false` | ❌ | 是否启用 SSL 连接 |
| `DATABASE_POOL_SIZE` | `20` | ❌ | 数据库连接池大小 |

示例：
```bash
# PostgreSQL 连接格式
DATABASE_URL=postgresql://username:password@hostname:port/database?options

# 完整示例
DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/autoads?sslmode=prefer&connect_timeout=10
```

**3. Redis 配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `REDIS_URL` | - | ✅ | Redis 连接字符串 |
| `REDIS_PASSWORD` | - | ❌ | Redis 密码 |
| `REDIS_DB` | `0` | ❌ | Redis 数据库编号 |
| `REDIS_PREFIX` | `autoads:` | ❌ | Redis 键前缀 |

示例：
```bash
# Redis 连接格式
REDIS_URL=redis://default:password@hostname:port/db

# 完整示例
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/0
```

**4. 认证授权配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `AUTH_SECRET` | - | ✅ | JWT 密钥（64位字符） |
| `AUTH_URL` | - | ✅ | 认证服务 URL |
| `AUTH_GOOGLE_ID` | - | ✅ | Google OAuth 客户端 ID |
| `AUTH_GOOGLE_SECRET` | - | ✅ | Google OAuth 客户端密钥 |
| `JWT_EXPIRES_IN` | `7d` | ❌ | JWT 过期时间 |
| `NEXTAUTH_URL_INTERNAL` | `http://localhost:3000` | ❌ | 内部回调 URL |

示例：
```bash
# 生成 AUTH_SECRET 的命令
openssl rand -base64 64

# 完整示例
AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
AUTH_URL=https://www.autoads.dev
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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
```

**5. 第三方 API 配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `SIMILARWEB_API_URL` | `https://data.similarweb.com/api/v1/data` | ✅ | SimilarWeb API 地址 |
| `ADSPOWER_API_URL` | `http://local.adspower.net:50325` | ❌ | AdsPower API 地址 |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | - | ❌ | Google Ads 开发者令牌 |
| `GOOGLE_ADS_CLIENT_ID` | - | ❌ | Google Ads 客户端 ID |
| `GOOGLE_ADS_CLIENT_SECRET` | - | ❌ | Google Ads 客户端密钥 |
| `GOOGLE_ADS_REFRESH_TOKEN` | - | ❌ | Google Ads 刷新令牌 |

**6. 邮件服务配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `EMAIL_PROVIDER` | - | ❌ | 邮件服务提供商 |
| `SMTP_HOST` | - | ❌ | SMTP 服务器地址 |
| `SMTP_PORT` | `587` | ❌ | SMTP 端口 |
| `SMTP_USER` | - | ❌ | SMTP 用户名 |
| `SMTP_PASS` | - | ❌ | SMTP 密码 |
| `EMAIL_FROM` | - | ❌ | 发件人邮箱 |

示例：
```bash
# Gmail 配置示例
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@autoads.dev
```

**7. 监控和分析配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `NEXT_PUBLIC_GA_ID` | - | ❌ | Google Analytics ID |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | `true` | ❌ | 是否启用分析 |
| `SENTRY_DSN` | - | ❌ | Sentry 错误监控 DSN |
| `LOG_LEVEL` | `info` | ❌ | 日志级别 |
| `LOG_FORMAT` | `json` | ❌ | 日志格式 |

**8. 文件存储配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `UPLOAD_DIR` | `./uploads` | ❌ | 上传文件目录 |
| `MAX_FILE_SIZE` | `10485760` | ❌ | 最大文件大小（字节） |
| `ALLOWED_FILE_TYPES` | `jpg,jpeg,png,gif,pdf,doc,docx` | ❌ | 允许的文件类型 |

**9. 安全配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `CORS_ORIGIN` | `*` | ❌ | CORS 允许的源 |
| `RATE_LIMIT_WINDOW` | `900000` | ❌ | 限流时间窗口（毫秒） |
| `RATE_LIMIT_MAX` | `100` | ❌ | 限流最大请求数 |
| `API_KEY_HEADER` | `X-API-Key` | ❌ | API 密钥请求头名称 |

**10. 缓存配置**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `CACHE_TTL` | `3600` | ❌ | 缓存过期时间（秒） |
| `CACHE_PREFIX` | `cache:` | ❌ | 缓存键前缀 |
| `ENABLE_CACHE` | `true` | ❌ | 是否启用缓存 |

**11. 功能开关**

| 变量名 | 默认值 | 必需 | 说明 |
|--------|--------|------|------|
| `ENABLE_SIGNUP` | `true` | ❌ | 是否允许注册 |
| `ENABLE_OAUTH` | `true` | ❌ | 是否启用 OAuth |
| `ENABLE_API` | `true` | ❌ | 是否启用 API |
| `ENABLE_DEMO_MODE` | `false` | ❌ | 是否启用演示模式 |

**12. 预发环境示例 (.env.preview)**

```bash
# ===== 核心配置 =====
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
NEXT_PUBLIC_DOMAIN=urlchecker.dev

# ===== 数据库配置 =====
DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/autoads_preview?sslmode=prefer
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/0

# ===== 认证配置 =====
AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
AUTH_URL=https://www.urlchecker.dev
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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

# ===== 可选功能配置 =====
# 第三方 API（如需要）
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
ADSPOWER_API_URL=http://local.adspower.net:50325

# 监控配置
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_ANALYTICS=true
LOG_LEVEL=debug
```

**13. 生产环境示例 (.env.production)**

```bash
# ===== 核心配置 =====
NODE_ENV=production
NEXT_PUBLIC_DEPLOYMENT_ENV=production
NEXT_PUBLIC_DOMAIN=autoads.dev

# ===== 数据库配置 =====
DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/autoads_production?sslmode=require
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/0
DATABASE_POOL_SIZE=30

# ===== 认证配置 =====
AUTH_SECRET=your-production-secret-key-must-be-64-characters-long
AUTH_URL=https://www.autoads.dev
AUTH_GOOGLE_ID=your-production-google-client-id
AUTH_GOOGLE_SECRET=your-production-google-client-secret
JWT_EXPIRES_IN=7d

# ===== 安全配置 =====
CORS_ORIGIN=https://autoads.dev,https://www.autoads.dev
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# ===== 邮件配置（如需要） =====
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@autoads.dev
SMTP_PASS=your-app-password
EMAIL_FROM=AutoAds <noreply@autoads.dev>

# ===== 第三方 API 配置 =====
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
ADSPOWER_API_URL=http://local.adspower.net:50325
GOOGLE_ADS_DEVELOPER_TOKEN=your-ads-dev-token
GOOGLE_ADS_CLIENT_ID=your-ads-client-id
GOOGLE_ADS_CLIENT_SECRET=your-ads-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-ads-refresh-token

# ===== 监控配置 =====
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ENABLE_ANALYTICS=true
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=info
LOG_FORMAT=json

# ===== 文件存储配置 =====
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx

# ===== 缓存配置 =====
CACHE_TTL=3600
CACHE_PREFIX=autoads:prod:
ENABLE_CACHE=true

# ===== 功能开关 =====
ENABLE_SIGNUP=true
ENABLE_OAUTH=true
ENABLE_API=true
ENABLE_DEMO_MODE=false
```

**14. 环境变量管理最佳实践**

1. **安全原则**
   - 所有敏感信息必须通过环境变量传递
   - 不要将 .env 文件提交到版本控制
   - 定期轮换密钥和令牌

2. **部署流程**
   - 使用 ClawCloud 的环境变量管理功能
   - 不同环境使用不同的变量值
   - 敏感变量通过加密渠道传输

3. **验证检查**
   - 启动时验证必需的环境变量
   - 提供友好的错误提示
   - 记录环境变量配置状态

### 4.9 部署指南

#### 4.9.1 开发环境部署

**1. 环境准备**:
```bash
# 安装 Go 1.21+
wget https://golang.org/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz

# 设置环境变量
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
source ~/.bashrc

# 安装 Node.js 18+ (用于前端)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**2. 项目初始化**:
```bash
# 克隆项目
git clone https://github.com/your-org/autoads.git
cd autoads

# 初始化 GoFly 子模块
git submodule update --init --recursive

# 安装 Go 依赖
cd gofly_admin_v3
go mod download
go mod tidy

# 安装前端依赖
cd ../frontend
npm install
```

**3. 启动开发服务器**:
```bash
# 启动数据库和 Redis
docker-compose up -d mysql redis

# 配置环境变量
cp .env.development .env
# 编辑 .env 文件，填入必要的配置

# 启动后端服务
cd gofly_admin_v3
go run main.go

# 启动前端开发服务器
cd ../frontend
npm run dev
```

#### 4.9.2 生产环境部署

根据 docs/MustKnow.md 中的部署流程，采用 GitHub Actions + ClawCloud 两步部署策略：

**1. 部署架构**:
- **代码构建**: GitHub Actions 自动构建 Docker 镜像
- **容器部署**: ClawCloud 平台托管容器服务
- **环境隔离**: 预发环境（preview）和生产环境（production）完全隔离

**2. GitHub Actions 自动构建**:

镜像构建触发条件：
- 代码推送到 `main` 分支 → 构建预发环境镜像（tag: preview-latest）
- 代码推送到 `production` 分支 → 构建生产环境镜像（tag: prod-latest）
- production 分支打 tag（如 v3.0.0）→ 构建版本镜像（tag: prod-v3.0.0）

使用的 Dockerfile：`Dockerfile.gofly`（Go 架构专用）

**3. Dockerfile.gofly 完整配置**:

```dockerfile
# AutoAds Go 架构专用 Dockerfile
# 遵循简单实用原则，支持2C4G环境
# 基于 GoFly Admin V3 框架构建

# 构建阶段
FROM golang:1.21-alpine AS builder

# 安装必要的构建工具
RUN apk add --no-cache \
    git \
    ca-certificates \
    tzdata \
    curl \
    bash \
    && update-ca-certificates \
    && rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# 复制 go mod 文件
COPY go.mod go.sum ./

# 配置 Go 环境
ENV GOPROXY=https://goproxy.cn,direct
ENV GO111MODULE=on
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用（静态链接，优化大小）
RUN go build \
    -ldflags="-w -s -extldflags '-static' -X 'main.Version=$(git describe --tags --always)' -X 'main.BuildTime=$(date -u '+%Y-%m-%d %H:%M:%S UTC')'" \
    -o autoads \
    ./cmd/server.go

# 运行阶段
FROM alpine:3.19 AS runner

# 安装必要的运行时依赖
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    bash \
    && update-ca-certificates \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/autoads .

# 复制配置文件和资源
COPY --from=builder /app/config ./config
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/migrations ./migrations

# 创建必要的目录
RUN mkdir -p /app/logs /app/data /app/uploads /app/temp && \
    chown -R appuser:appuser /app

# 设置正确的权限
RUN chmod +x ./scripts/*.sh 2>/dev/null || true

# 切换到非root用户
USER appuser

# 设置时区
ENV TZ=Asia/Shanghai

# 应用环境变量
ENV GIN_MODE=release
ENV PORT=8080
ENV HOST=0.0.0.0

# 数据库连接池配置（2C4G优化）
ENV DB_MAX_IDLE_CONNS=5
ENV DB_MAX_OPEN_CONNS=20
ENV DB_CONN_MAX_LIFETIME=300

# Redis 配置
ENV REDIS_POOL_SIZE=10
ENV REDIS_MIN_IDLE_CONNS=3

# 日志配置
ENV LOG_LEVEL=info
ENV LOG_OUTPUT=file
ENV LOG_FILE=/app/logs/app.log

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# 启动脚本（支持多种启动模式）
COPY --from=builder /app/scripts/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
```

**4. docker-entrypoint.sh 启动脚本**:

```bash
#!/bin/bash
set -e

# 等待数据库就绪
wait_for_db() {
    echo "等待数据库连接..."
    until nc -z -v -w30 ${DB_HOST:-localhost} ${DB_PORT:-3306}
    do
        echo "等待 MySQL..."
        sleep 3
    done
    echo "数据库已就绪"
}

# 等待 Redis 就绪
wait_for_redis() {
    echo "等待 Redis 连接..."
    until nc -z -v -w30 ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}
    do
        echo "等待 Redis..."
        sleep 3
    done
    echo "Redis 已就绪"
}

# 运行数据库迁移
run_migrations() {
    if [ "$RUN_MIGRATIONS" = "true" ]; then
        echo "运行数据库迁移..."
        ./scripts/migrate.sh up
    fi
}

# 初始化应用
init_app() {
    # 创建日志目录
    mkdir -p /app/logs
    
    # 设置时区
    if [ ! -z "$TZ" ]; then
        ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
    fi
    
    # 打印启动信息
    echo "====================================="
    echo "AutoAds Go 版本: $(./autoads version)"
    echo "启动时间: $(date)"
    echo "环境: ${GIN_MODE:-release}"
    echo "端口: ${PORT:-8080}"
    echo "====================================="
}

# 主启动流程
main() {
    init_app
    
    # 根据环境决定是否等待依赖服务
    if [ "$SKIP_DEPENDENCY_CHECK" != "true" ]; then
        wait_for_db
        wait_for_redis
        run_migrations
    fi
    
    # 启动应用
    exec ./autoads "$@"
}

# 信号处理
trap 'echo "收到停止信号，正在关闭..."; exit 0' SIGTERM SIGINT

# 执行主函数
main "$@"
```

**5. GitHub Actions 完整工作流** (.github/workflows/deploy.yml):

```yaml
name: Build and Deploy AutoAds Go

on:
  push:
    branches: [ main, production ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: xxrenzhe/autoads

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Set up Go
      uses: actions/setup-go@v4
      with:
        go-version: '1.21'
        cache: true

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Run tests
      run: |
        go test -v ./...
        go vet ./...

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.gofly
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        build-args: |
          VERSION=${{ github.sha }}
          BUILD_DATE=${{ github.event.created_at }}

    - name: Generate deployment manifest
      run: |
        cat > deployment-manifest.yml << EOF
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: autoads-${{ github.ref_name }}
          labels:
            app: autoads
            version: ${{ github.sha }}
        spec:
          replicas: 2
          selector:
            matchLabels:
              app: autoads
          template:
            metadata:
              labels:
                app: autoads
                version: ${{ github.sha }}
            spec:
              containers:
              - name: autoads
                image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.meta.outputs.version }}
                ports:
                - containerPort: 8080
                env:
                - name: GIN_MODE
                  value: "release"
                - name: PORT
                  value: "8080"
                resources:
                  limits:
                    cpu: "2"
                    memory: "4Gi"
                  requests:
                    cpu: "500m"
                    memory: "1Gi"
                livenessProbe:
                  httpGet:
                    path: /api/health
                    port: 8080
                  initialDelaySeconds: 30
                  periodSeconds: 10
                readinessProbe:
                  httpGet:
                    path: /api/ready
                    port: 8080
                  initialDelaySeconds: 5
                  periodSeconds: 5
        EOF

    - name: Upload deployment manifest
      uses: actions/upload-artifact@v3
      with:
        name: deployment-manifest
        path: deployment-manifest.yml

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging

    steps:
    - name: Download manifest
      uses: actions/download-artifact@v3
      with:
        name: deployment-manifest

    - name: Deploy to staging
      run: |
        echo "部署到预发环境..."
        # 这里可以添加具体的部署命令，例如调用 ClawCloud API
        # 或者使用 kubectl 部署到 K8s 集群

  deploy-production:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/production' || startsWith(github.ref, 'refs/tags/v')
    environment: production

    steps:
    - name: Download manifest
      uses: actions/download-artifact@v3
      with:
        name: deployment-manifest

    - name: Deploy to production
      run: |
        echo "部署到生产环境..."
        # 生产环境部署逻辑
```

**6. ClawCloud 部署步骤**:

1) **登录 ClawCloud 控制台**
   - 访问 ClawCloud 管理平台
   - 选择对应环境（预发/生产）

2) **配置容器服务**
   - 镜像地址：`ghcr.io/xxrenzhe/autoads:preview-latest`（预发环境）
   - 镜像地址：`ghcr.io/xxrenzhe/autoads:prod-latest`（生产环境）
   - 容器规格：2C4G（2核CPU、4GB内存）

3) **配置环境变量**
   
   **预发环境核心变量**：
   ```bash
   # 应用配置
   GIN_MODE=release
   PORT=8080
   HOST=0.0.0.0
   DEPLOYMENT_ENV=preview
   DOMAIN=urlchecker.dev
   
   # 数据库配置
   DATABASE_URL=mysql://root:jtl85fn8@dbprovider.sg-members-1.clawcloudrun.com:30354/autoads?charset=utf8mb4&parseTime=True&loc=Local
   DB_MAX_IDLE_CONNS=5
   DB_MAX_OPEN_CONNS=20
   DB_CONN_MAX_LIFETIME=300
   
   # Redis 配置
   REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/0
   REDIS_POOL_SIZE=10
   REDIS_MIN_IDLE_CONNS=3
   
   # JWT 认证配置
   JWT_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
   JWT_EXPIRE=168h
   
   # Google OAuth 配置
   GOOGLE_CLIENT_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   GOOGLE_CALLBACK_URL=https://www.urlchecker.dev/api/auth/google/callback
   
   # SimilarWeb 配置
   SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
   
   # 日志配置
   LOG_LEVEL=info
   LOG_OUTPUT=file
   LOG_FILE=/app/logs/app.log
   ```
   
   **生产环境核心变量**：
   ```bash
   # 应用配置
   GIN_MODE=release
   PORT=8080
   HOST=0.0.0.0
   DEPLOYMENT_ENV=production
   DOMAIN=autoads.dev
   
   # 数据库配置
   DATABASE_URL=postgresql://postgres:w8mhnnqh@dbprovider.sg-members-1.clawcloudrun.com:32404/autoads?sslmode=require
   DB_MAX_IDLE_CONNS=10
   DB_MAX_OPEN_CONNS=50
   DB_CONN_MAX_LIFETIME=600
   
   # Redis 配置
   REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284/0
   REDIS_POOL_SIZE=20
   REDIS_MIN_IDLE_CONNS=5
   
   # JWT 认证配置
   JWT_SECRET=your-production-jwt-secret-must-be-64-characters-long
   JWT_EXPIRE=168h
   JWT_REFRESH_EXPIRE=720h
   
   # Google OAuth 配置
   GOOGLE_CLIENT_ID=your-production-google-client-id
   GOOGLE_CLIENT_SECRET=your-production-google-client-secret
   GOOGLE_CALLBACK_URL=https://www.autoads.dev/api/auth/google/callback
   
   # SimilarWeb 配置
   SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
   
   # 邮件配置（可选）
   EMAIL_ENABLED=false
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-password
   
   # 监控配置
   SENTRY_DSN=your-sentry-dsn
   ENABLE_METRICS=true
   ```

4) **网络配置**
   - 预发环境域名：urlchecker.dev（自动301跳转到 www.urlchecker.dev）
   - 生产环境域名：autoads.dev（自动301跳转到 www.autoads.dev）
   - 容器内部端口：8080
   - 健康检查路径：/api/health
   - 就绪检查路径：/api/ready
   
   **5. 健康检查配置**
   ```yaml
   livenessProbe:
     httpGet:
       path: /api/health
       port: 8080
     initialDelaySeconds: 30
     periodSeconds: 10
     timeoutSeconds: 5
     failureThreshold: 3
   
   readinessProbe:
     httpGet:
       path: /api/ready
       port: 8080
     initialDelaySeconds: 5
     periodSeconds: 5
     timeoutSeconds: 3
     failureThreshold: 1
   ```

**4. 部署流程**:

1. 开发者完成代码开发并推送到对应分支
2. GitHub Actions 自动触发构建，生成 Docker 镜像
3. 构建成功后，镜像推送到 GitHub Container Registry
4. 运维人员在 ClawCloud 控制台更新镜像版本
5. 配置环境变量（首次部署或配置变更时）
6. 启动容器服务，验证部署状态
7. 通过域名访问服务，确认功能正常

**5. 回滚机制**:
- 快速回滚：在 ClawCloud 控制台切换到上一个稳定版本的镜像
- 数据保护：生产数据库定期自动备份
- 监控告警：部署后自动监控系统健康状态

**传统服务器部署（备选方案）**:

**1. 服务器要求**:
- CPU: 4 核以上
- 内存: 8GB 以上
- 磁盘: 100GB SSD
- 操作系统: Ubuntu 20.04 LTS 或 CentOS 8+

**2. 使用 Docker 部署**:
```dockerfile
# Dockerfile
FROM golang:1.21-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 go.mod 和 go.sum
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 最终镜像
FROM alpine:latest

# 安装 ca-certificates 和时区数据
RUN apk --no-cache add ca-certificates tzdata

# 设置时区
ENV TZ=Asia/Shanghai

# 创建非 root 用户
RUN addgroup -g 1000 appgroup && \
    adduser -D -u 1000 -G appgroup appuser

# 复制二进制文件
WORKDIR /app
COPY --from=builder /app/main .
COPY --from=builder /app/resource ./resource

# 创建必要的目录
RUN mkdir -p logs static/uploads && \
    chown -R appuser:appgroup /app

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 启动命令
CMD ["./main"]
```

**3. Docker Compose 配置**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=mysql
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    volumes:
      - ./logs:/app/logs
      - ./static:/app/static
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: autoads
      MYSQL_USER: autoads
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

**4. 使用 systemd 管理服务**:
```ini
# /etc/systemd/system/autoads.service
[Unit]
Description=AutoAds Application
After=network.target mysql.service redis.service

[Service]
Type=simple
User=autoads
WorkingDirectory=/opt/autoads
ExecStart=/opt/autoads/main
Restart=always
RestartSec=5
Environment=GO_ENV=production
EnvironmentFile=/opt/autoads/.env

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/autoads/logs
ReadWritePaths=/opt/autoads/static/uploads

[Install]
WantedBy=multi-user.target
```

**5. 部署脚本**:
```bash
#!/bin/bash
# deploy.sh

set -e

echo "开始部署 AutoAds..."

# 1. 备份当前版本
if [ -d "/opt/autoads" ]; then
    cp -r /opt/autoads /opt/autoads.backup.$(date +%Y%m%d%H%M%S)
fi

# 2. 停止服务
systemctl stop autoads

# 3. 部署新版本
mkdir -p /opt/autoads
cp -r ./* /opt/autoads/
chown -R autoads:autoads /opt/autoads
chmod +x /opt/autoads/main

# 4. 执行数据库迁移
cd /opt/autoads
./main migrate

# 5. 启动服务
systemctl start autoads

# 6. 检查服务状态
sleep 5
if systemctl is-active --quiet autoads; then
    echo "部署成功！"
else
    echo "部署失败，请检查日志"
    journalctl -u autoads -n 50
    exit 1
fi
```

### 4.9 性能优化和并发管理

#### 4.9.1 Go 并发模式实现

**Worker Pool 模式**:
```go
// app/autoads/concurrency/worker_pool.go
package concurrency

import (
    "context"
    "sync"
    "time"
)

type Task interface {
    Execute(ctx context.Context) error
    Priority() int
}

type WorkerPool struct {
    workers    int
    taskQueue  chan Task
    resultChan chan error
    wg         sync.WaitGroup
    ctx        context.Context
    cancel     context.CancelFunc
}

func NewWorkerPool(ctx context.Context, workers int, queueSize int) *WorkerPool {
    poolCtx, cancel := context.WithCancel(ctx)
    
    pool := &WorkerPool{
        workers:    workers,
        taskQueue:  make(chan Task, queueSize),
        resultChan: make(chan error, queueSize),
        ctx:        poolCtx,
        cancel:     cancel,
    }
    
    // 启动 worker
    for i := 0; i < workers; i++ {
        pool.wg.Add(1)
        go pool.worker()
    }
    
    return pool
}

func (p *WorkerPool) worker() {
    defer p.wg.Done()
    
    for {
        select {
        case <-p.ctx.Done():
            return
            
        case task := <-p.taskQueue:
            err := task.Execute(p.ctx)
            select {
            case p.resultChan <- err:
            case <-p.ctx.Done():
                return
            }
        }
    }
}

func (p *WorkerPool) Submit(task Task) error {
    select {
    case p.taskQueue <- task:
        return nil
    case <-p.ctx.Done():
        return p.ctx.Err()
    }
}

func (p *WorkerPool) Results() <-chan error {
    return p.resultChan
}

func (p *WorkerPool) Stop() {
    p.cancel()
    p.wg.Wait()
    close(p.taskQueue)
    close(p.resultChan)
}
```

**优先级队列实现**:
```go
// app/autoads/concurrency/priority_queue.go
package concurrency

import (
    "container/heap"
)

type PriorityQueue struct {
    items []Task
    mu    sync.Mutex
}

func NewPriorityQueue() *PriorityQueue {
    return &PriorityQueue{
        items: make([]Task, 0),
    }
}

func (pq *PriorityQueue) Push(task Task) {
    pq.mu.Lock()
    defer pq.mu.Unlock()
    
    heap.Push(pq, task)
}

func (pq *PriorityQueue) Pop() Task {
    pq.mu.Lock()
    defer pq.mu.Unlock()
    
    if len(pq.items) == 0 {
        return nil
    }
    
    return heap.Pop(pq).(Task)
}

func (pq *PriorityQueue) Len() int {
    pq.mu.Lock()
    defer pq.mu.Unlock()
    
    return len(pq.items)
}

// 实现 heap.Interface
func (pq *PriorityQueue) Less(i, j int) bool {
    return pq.items[i].Priority() > pq.items[j].Priority()
}

func (pq *PriorityQueue) Swap(i, j int) {
    pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
}

func (pq *PriorityQueue) Push(x interface{}) {
    pq.items = append(pq.items, x.(Task))
}

func (pq *PriorityQueue) Pop() interface{} {
    old := pq.items
    n := len(old)
    item := old[n-1]
    pq.items = old[0 : n-1]
    return item
}
```

#### 4.9.2 连接池管理

**数据库连接池优化**:
```go
// app/autoads/pool/db_pool.go
package pool

import (
    "context"
    "fmt"
    "sync"
    "time"
    
    "gofly/utils/gform"
)

type ConnectionPool struct {
    maxSize     int
    currentSize int
    idleConns   chan *gform.DB
    activeConns map[*gform.DB]time.Time
    mu          sync.RWMutex
    factory     func() (*gform.DB, error)
}

func NewConnectionPool(maxSize int, factory func() (*gform.DB, error)) *ConnectionPool {
    return &ConnectionPool{
        maxSize:     maxSize,
        idleConns:   make(chan *gform.DB, maxSize),
        activeConns: make(map[*gform.DB]time.Time),
        factory:     factory,
    }
}

func (p *ConnectionPool) Get(ctx context.Context) (*gform.DB, error) {
    // 1. 尝试从空闲连接获取
    select {
    case conn := <-p.idleConns:
        p.mu.Lock()
        p.activeConns[conn] = time.Now()
        p.mu.Unlock()
        return conn, nil
    default:
        // 没有空闲连接
    }
    
    // 2. 检查是否可以创建新连接
    p.mu.Lock()
    defer p.mu.Unlock()
    
    if p.currentSize < p.maxSize {
        conn, err := p.factory()
        if err != nil {
            return nil, err
        }
        
        p.currentSize++
        p.activeConns[conn] = time.Now()
        return conn, nil
    }
    
    // 3. 等待其他连接释放
    select {
    case conn := <-p.idleConns:
        p.activeConns[conn] = time.Now()
        return conn, nil
    case <-ctx.Done():
        return nil, ctx.Err()
    }
}

func (p *ConnectionPool) Put(conn *gform.DB) {
    p.mu.Lock()
    defer p.mu.Unlock()
    
    delete(p.activeConns, conn)
    
    select {
    case p.idleConns <- conn:
        // 成功放回池中
    default:
        // 池已满，关闭连接
        conn.Close()
        p.currentSize--
    }
}

func (p *ConnectionPool) Close() error {
    p.mu.Lock()
    defer p.mu.Unlock()
    
    // 关闭所有连接
    for conn := range p.activeConns {
        conn.Close()
        delete(p.activeConns, conn)
        p.currentSize--
    }
    
    close(p.idleConns)
    
    return nil
}

// 定期清理过期连接
func (p *ConnectionPool) StartCleaner(interval time.Duration) {
    ticker := time.NewTicker(interval)
    go func() {
        for range ticker.C {
            p.cleanExpired()
        }
    }()
}

func (p *ConnectionPool) cleanExpired() {
    p.mu.Lock()
    defer p.mu.Unlock()
    
    now := time.Now()
    expired := time.Minute * 5 // 5分钟未使用视为过期
    
    for conn, lastUsed := range p.activeConns {
        if now.Sub(lastUsed) > expired {
            conn.Close()
            delete(p.activeConns, conn)
            p.currentSize--
        }
    }
}
```

#### 4.9.3 缓存策略优化

**多级缓存实现**:
```go
// app/autoads/cache/multi_level.go
package cache

import (
    "context"
    "encoding/json"
    "fmt"
    "time"
    
    "gofly/utils/tools/gcache"
    "gofly/utils/tools/gredis"
)

type CacheLevel int

const (
    LevelMemory CacheLevel = iota
    LevelRedis
)

type MultiLevelCache struct {
    memory *gcache.Cache
    redis  *gredis.Redis
    ttl    time.Duration
}

type CacheItem struct {
    Value      interface{} `json:"value"`
    ExpiredAt  time.Time   `json:"expired_at"`
    AccessTime time.Time   `json:"access_time"`
    HitCount   int         `json:"hit_count"`
}

func NewMultiLevelCache(redis *gredis.Redis, defaultTTL time.Duration) *MultiLevelCache {
    return &MultiLevelCache{
        memory: gcache.New(),
        redis:  redis,
        ttl:    defaultTTL,
    }
}

func (c *MultiLevelCache) Get(ctx context.Context, key string, dest interface{}) error {
    // 1. 先查内存缓存
    if item, err := c.memory.Get(ctx, key); err == nil {
        cacheItem := item.(*CacheItem)
        if time.Now().Before(cacheItem.ExpiredAt) {
            // 更新访问信息
            cacheItem.AccessTime = time.Now()
            cacheItem.HitCount++
            return json.Unmarshal([]byte(cacheItem.Value.(string)), dest)
        }
        // 内存缓存过期，删除
        c.memory.Remove(ctx, key)
    }
    
    // 2. 查 Redis 缓存
    redisKey := fmt.Sprintf("cache:%s", key)
    data, err := c.redis.Get(ctx, redisKey).Bytes()
    if err == nil {
        // 反序列化
        var item CacheItem
        if err := json.Unmarshal(data, &item); err == nil {
            if time.Now().Before(item.ExpiredAt) {
                // 回填内存缓存
                c.memory.Set(ctx, key, &item, c.ttl)
                return json.Unmarshal([]byte(item.Value.(string)), dest)
            }
            // Redis 缓存也过期，删除
            c.redis.Del(ctx, redisKey)
        }
    }
    
    return fmt.Errorf("key not found: %s", key)
}

func (c *MultiLevelCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
    // 序列化值
    valueBytes, err := json.Marshal(value)
    if err != nil {
        return err
    }
    
    // 创建缓存项
    item := &CacheItem{
        Value:      string(valueBytes),
        ExpiredAt:  time.Now().Add(ttl),
        AccessTime:  time.Now(),
        HitCount:   0,
    }
    
    // 序列化缓存项
    itemBytes, err := json.Marshal(item)
    if err != nil {
        return err
    }
    
    // 同时设置内存和 Redis 缓存
    redisKey := fmt.Sprintf("cache:%s", key)
    
    // 使用 pipeline 批量设置
    pipe := c.redis.Pipeline()
    pipe.Set(ctx, redisKey, itemBytes, ttl)
    _, err = pipe.Exec(ctx)
    
    if err == nil {
        c.memory.Set(ctx, key, item, ttl)
    }
    
    return err
}

func (c *MultiLevelCache) Delete(ctx context.Context, key string) error {
    redisKey := fmt.Sprintf("cache:%s", key)
    
    // 并发删除
    var wg sync.WaitGroup
    var errs []error
    var mu sync.Mutex
    
    wg.Add(2)
    
    // 删除内存缓存
    go func() {
        defer wg.Done()
        c.memory.Remove(ctx, key)
    }()
    
    // 删除 Redis 缓存
    go func() {
        defer wg.Done()
        if err := c.redis.Del(ctx, redisKey).Err(); err != nil {
            mu.Lock()
            errs = append(errs, err)
            mu.Unlock()
        }
    }()
    
    wg.Wait()
    
    if len(errs) > 0 {
        return errs[0]
    }
    
    return nil
}
```

#### 4.9.4 限流和熔断

**令牌桶限流器**:
```go
// app/autoads/limiter/token_bucket.go
package limiter

import (
    "context"
    "sync"
    "time"
)

type TokenBucket struct {
    capacity    int64
    tokens      int64
    refillRate  int64 // tokens per second
    lastRefill  time.Time
    mu          sync.Mutex
}

func NewTokenBucket(capacity int64, refillRate int64) *TokenBucket {
    return &TokenBucket{
        capacity:   capacity,
        tokens:     capacity,
        refillRate: refillRate,
        lastRefill: time.Now(),
    }
}

func (tb *TokenBucket) Allow() bool {
    tb.mu.Lock()
    defer tb.mu.Unlock()
    
    now := time.Now()
    elapsed := now.Sub(tb.lastRefill)
    
    // 计算新添加的令牌
    newTokens := int64(elapsed.Seconds()) * tb.refillRate
    if newTokens > 0 {
        tb.tokens = min(tb.capacity, tb.tokens+newTokens)
        tb.lastRefill = now
    }
    
    if tb.tokens > 0 {
        tb.tokens--
        return true
    }
    
    return false
}

func (tb *TokenBucket) Wait(ctx context.Context) error {
    for !tb.Allow() {
        select {
        case <-time.After(time.Second / time.Duration(tb.refillRate)):
            continue
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return nil
}

func min(a, b int64) int64 {
    if a < b {
        return a
    }
    return b
}
```

**熔断器模式**:
```go
// app/autoads/circuit/breaker.go
package circuit

import (
    "context"
    "sync"
    "time"
)

type State int

const (
    StateClosed State = iota
    StateOpen
    StateHalfOpen
)

type CircuitBreaker struct {
    maxFailures    int
    resetTimeout   time.Duration
    state          State
    failures       int
    lastFailure    time.Time
    mu             sync.RWMutex
}

func NewCircuitBreaker(maxFailures int, resetTimeout time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        maxFailures:  maxFailures,
        resetTimeout: resetTimeout,
        state:        StateClosed,
    }
}

func (cb *CircuitBreaker) Allow() bool {
    cb.mu.RLock()
    defer cb.mu.RUnlock()
    
    if cb.state == StateClosed {
        return true
    }
    
    if cb.state == StateOpen {
        // 检查是否可以尝试恢复
        if time.Since(cb.lastFailure) > cb.resetTimeout {
            return true
        }
        return false
    }
    
    // Half-open 状态，允许少量请求
    return true
}

func (cb *CircuitBreaker) RecordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    cb.failures = 0
    
    if cb.state == StateHalfOpen {
        cb.state = StateClosed
    }
}

func (cb *CircuitBreaker) RecordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    cb.failures++
    cb.lastFailure = time.Now()
    
    if cb.state == StateClosed && cb.failures >= cb.maxFailures {
        cb.state = StateOpen
    }
}

func (cb *CircuitBreaker) Execute(ctx context.Context, fn func() error) error {
    if !cb.Allow() {
        return fmt.Errorf("circuit breaker is open")
    }
    
    err := fn()
    
    if err != nil {
        cb.RecordFailure()
    } else {
        cb.RecordSuccess()
    }
    
    return err
}
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
- [ ] SiteRankGo 模块开发

#### 阶段三：AdsCenterGo 开发（3 周）
- [ ] Google Ads API 集成
- [ ] AdsPower API 对接
- [ ] 链接替换规则引擎
- [ ] 执行监控功能

#### 阶段四：管理后台开发（3 周）
- [ ] GoFly Admin 集成
- [ ] 用户管理界面
- [ ] 套餐管理功能
- [ ] 系统监控面板

#### 阶段五：测试与优化（2 周）
- [ ] 功能测试
- [ ] 性能测试
- [ ] 安全测试
- [ ] 兼容性测试

### 5.2 技术风险与应对

#### 风险 1：Go 语言学习曲线
- **风险**：团队 Go 语言经验不足
- **应对**：提前组织 Go 语言培训

#### 风险 2：第三方 API 限制
- **风险**：SimilarWeb API 调用限制
- **应对**：实现智能缓存

### 5.3 上线策略

#### 灰度发布
1. 邀请制：先邀请种子用户试用
2. 功能开关：可随时切换回原系统
3. 监控告警：实时监控系统健康状态

#### 数据迁移
- 新系统使用全新数据库
- 保留原系统 3 个月用于数据回滚
- 提供数据导出功能

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

### 6.2 性能验收

#### 响应时间
- [ ] API P95 响应时间 < 200ms
- [ ] 页面加载时间 < 2s
- [ ] BatchGo 任务启动时间 < 1s

#### 并发能力
- [ ] 支持 5000 用户同时在线
- [ ] BatchGo 支持预期并发数
- [ ] SiteRankGo 支持预期并发查询

### 6.3 安全验收

- [ ] JWT 认证机制安全
- [ ] 用户数据完全隔离
- [ ] 敏感数据加密存储
- [ ] API 限流有效

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

**关于并发能力的说明**:
- 系统支持的并发数受限于用户套餐
- Free 套餐：1 个并发任务
- Pro 套餐：5 个并发任务
- Max 套餐：50 个并发任务
- 实际并发能力取决于服务器配置和网络环境

### 7.3 Token 消费规则

**扣费触发点**:
- Basic 模式：点击打开时扣除
- Silent/Automated 模式：任务创建时预扣，失败时返还
- SiteRankGo：查询成功后扣除
- 缓存命中：不扣除 Token

**扣费失败处理**:
- 余额不足时拒绝创建任务
- 任务执行失败自动返还 Token
- 系统异常导致的双重扣费自动修复

### 7.4 试用期规则

**叠加规则**:
- 新用户注册：14 天 Pro
- 邀请注册：30 天 Pro（不与新用户奖励叠加）
- 多次邀请：可累加，最长 365 天
- 试用期间不能再次获得试用

### 7.5 SimilarWeb 配额管理

**配额使用策略**:
- 全局配额监控
- 达到限额自动降级
- 支持配额预约和排队
- 优先付费用户查询

## 8. 术语表

### 8.1 模块术语
- **BatchGo**: 批量访问功能的 Go 语言实现
- **SiteRankGo**: 网站排名功能的 Go 语言实现
- **AdsCenterGo**: 链接管理功能的 Go 语言实现

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
# SimilarWeb 服务通过模拟浏览器请求获取公开数据，无需 API 密钥
SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data
GOOGLE_ADS_DEVELOPER_TOKEN=your-google-ads-token
ADSPOWER_API_KEY=your-adspower-key

# 监控配置
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENDPOINT=http://localhost:9090
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
| v4.0 | 2025-09-13 | 全面修复文档不一致性和歧义问题，统一技术规格，优化文档结构 | 产品团队 |