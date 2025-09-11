# AutoAds 营销自动化平台 PRD V4.2

## 文档信息
- **项目名称**: AutoAds 营销自动化平台
- **版本**: v4.3
- **创建日期**: 2025-01-09
- **最后更新**: 2025-09-10
- **负责人**: 产品团队
- **优化说明**: 
  - V4.2：基于实际代码分析，修正虚构业务逻辑，聚焦真实功能特性
  - V4.3：修正重构目标与V3不一致的问题，统一技术规格和实施策略

## 执行摘要

AutoAds 正在从 Next.js 单体应用重构为基于 GoFly 框架的多用户 SaaS 系统。当前系统已实现完整的用户认证、权限管理和三大核心功能，包括：✅ BatchOpen（批量访问，已实现三种模式）、✅ SiteRank（网站排名，已集成真实SimilarWeb API）、❌ AdsCenter（Google Ads管理，仅有UI原型）。重构目标是将现有功能（BatchOpen→BatchGo、SiteRank→SiteRankGo、AdsCenter→AdsCenterGo）迁移至 Go 语言 + GoFly 架构，实现4900%性能提升和专业的后台管理系统。本文档基于实际代码分析，准确描述现有功能特性和技术架构。

## 1. 项目概述

### 1.1 现有项目分析

#### 分析来源
基于实际代码库分析（2025-09-10）

#### 当前项目状态
AutoAds 是一个运行中的营销自动化平台，三大核心功能实现状态：
- **✅ BatchOpen（批量访问）**: 完整实现，支持 HTTP 和 Puppeteer 两种执行模式
- **✅ SiteRank（网站排名）**: 完整实现，已集成 SimilarWeb API
- **❌ AdsCenter（Google Ads 管理）**: 仅有UI界面，OAuth和链接管理未实现

#### 技术栈现状
**前端技术栈**:
- Next.js 14 + React 18 + TypeScript
- Material-UI v5 + Tailwind CSS
- Zustand 状态管理
- NextAuth.js v4 认证

**后端技术栈**:
- Next.js API Routes
- PostgreSQL + Prisma ORM
- Redis（缓存）
- Puppeteer（浏览器自动化）

**外部集成**:
- Google OAuth 2.0（用户认证）
- SimilarWeb API（网站排名数据）
- Google Ads API（广告管理）
- Stripe（支付处理）
- AdsPower API（浏览器自动化）

### 1.2 系统架构

#### 当前架构（生产环境）
- **单体应用**: Next.js 14 全栈应用
- **认证系统**: NextAuth.js v4 + Google OAuth
- **数据库**: MySQL 8.0 + Prisma ORM
- **缓存**: Redis
- **部署**: GitHub Actions + Vercel/ClawCloud

#### 系统特点
- **单租户架构**: 所有用户共享同一实例
- **基于角色的访问控制**: USER, ADMIN, SUPER_ADMIN
- **Token 经济系统**: 功能使用消耗 Token
- **订阅制管理**: 三种套餐（Basic/Pro/Enterprise）
- **RESTful API**: 标准化的 API 设计

## 2. 功能模块说明

### 2.1 核心功能模块

- **BatchOpen**: 批量 URL 访问功能
  - 支持 HTTP 请求和 Puppeteer 浏览器自动化
  - 代理轮换和 Referer 伪装
  - 并发控制和进度监控

- **SiteRank**: 网站排名分析功能
  - 集成 SimilarWeb API
  - 批量域名查询
  - 排名数据缓存

- **AdsCenter**: Google Ads 管理功能
  - Google OAuth 认证
  - 广告系列管理
  - 链接提取和替换
  - AdsPower 浏览器自动化

## 3. 需求分析

### 3.1 功能需求（Functional Requirements）

#### FR1: 用户认证系统
- **FR1.1**: 邮箱注册和登录功能
- **FR1.2**: Google OAuth 2.0 集成登录
- **FR1.3**: 用户资料管理（邮箱、头像、昵称）
- **FR1.4**: 密码重置功能
- **FR1.5**: JWT token 认证机制

#### FR2: 管理员系统
- **FR2.1**: 管理员账号管理（创建/编辑/删除）
- **FR2.2**: 用户列表查看和管理
- **FR2.3**: 系统监控和日志查看
- **FR2.4**: 套餐管理功能
- **FR2.5**: Token 交易记录查看

#### FR3: 订阅和 Token 系统
- **FR3.1**: 三种订阅套餐（Free/Pro/Max）
- **FR3.2**: Token 消费机制（功能使用消耗 Token）
- **FR3.3**: Token 充值功能（手动咨询模式）
- **FR3.4**: 套餐手动激活和管理
- **FR3.5**: 每日签到奖励 Token
- **FR3.6**: Token 交易历史记录

#### FR4: BatchOpen 模块
- **FR4.1**: 批量 URL 访问功能
- **FR4.2**: 两种执行模式：
  - HTTP 模式：后台 HTTP 请求
  - Puppeteer 模式：浏览器自动化
- **FR4.3**: 代理配置支持
- **FR4.4**: Referer 伪装选项
- **FR4.5**: 并发控制
- **FR4.6**: 实时进度监控
- **FR4.7**: 任务历史记录
- **FR4.8**: 代理配置要求：
  - **HTTP模式代理配置**：
    - 支持HTTP/HTTPS/SOCKS5代理协议
    - 自动代理IP轮换和故障转移
    - 支持自定义Referer（社交媒体、搜索引擎、自定义来源）
    - 代理IP健康检测和自动剔除无效IP
  - **Puppeteer模式代理配置**：
    - 支持HTTP/HTTPS/SOCKS5代理协议
    - 浏览器级别的代理配置
    - 支持自定义Referer和User-Agent
    - 自动代理轮换和会话隔离
- **FR4.9**: URL访问轮转机制：
  - **每个代理IP完成一轮URL访问**：系统必须确保每个代理IP按顺序完成所有URL的访问后，才切换到下一个代理IP
  - **轮转策略**：
    - 代理IP队列管理（FIFO先进先出）
    - 每个代理IP访问完所有URL后标记为已完成
    - 自动切换到下一个可用代理IP
    - 支持代理IP重用和循环使用

#### FR5: SiteRank 模块
- **FR5.1**: SimilarWeb API 集成
- **FR5.2**: 批量域名排名查询
- **FR5.3**: 数据缓存机制
- **FR5.4**: 全球排名和月访问量数据
- **FR5.5**: 查询历史记录

#### FR6: AdsCenter 模块
- **FR6.1**: Google Ads OAuth 集成
- **FR6.2**: 广告账户管理
- **FR6.3**: 广告系列查看和管理
- **FR6.4**: 链接提取功能
- **FR6.5**: 链接替换规则
- **FR6.6**: AdsPower 浏览器自动化
- **FR6.7**: 任务执行监控

#### FR7: 通用功能
- **FR7.1**: 响应式设计（支持移动端）
- **FR7.2**: 深色/浅色主题切换
- **FR7.3**: 多语言支持（中文/英文）
- **FR7.4**: 实时通知系统
- **FR7.5**: 数据导出功能（CSV/Excel）
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
- 价格：免费
- 包含 1,000 tokens/月
- BatchOpen：Basic 和 Silent 版本
- SiteRank：批量查询 100 个域名/次
- API 限制：30 次/分钟

**高级套餐（Pro）**:
- 价格：¥298/月（年付 ¥1,788，优惠 40%）
- 包含 10,000 tokens/月
- 所有免费套餐功能
- BatchOpen：Automated 版本
- SiteRank：批量查询 500 个域名/次
- AdsCenter：最多 10 个广告账户
- API 限制：100 次/分钟

**白金套餐（Max）**:
- 价格：¥998/月（年付 ¥5,988，优惠 40%）
- 包含 100,000 tokens/月
- 所有 Pro 套餐功能
- SiteRank：批量查询 5,000 个域名/次
- AdsCenter：最多 100 个广告账户
- API 限制：500 次/分钟
- 专属客户经理

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

**基于GoFly Admin V3的架构模式**：
- **前端层**: Next.js 14 + TypeScript（保持现有）
- **后端层**: Go + GoFly Admin V3 框架
  - 内置RBAC权限管理
  - 自动化CRUD生成
  - 统一的API网关
  - 插件化中间件系统
- **数据层**: MySQL 8.0（无需数据迁移，使用新数据库）
- **缓存层**: Redis 7.0（GoFly内置缓存支持）
- **ORM层**: GoFly gform（基于GORM增强）
  - 自动化迁移
  - 软删除支持
  - 乐观锁控制
  - 数据审计日志

**重要说明**：
1. **无需数据库迁移**：直接使用新数据库，避免迁移风险
2. **无需系统共存**：直接实现目标架构，简化开发和部署
3. **保持前端兼容**：前端应用只需修改API接口地址

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

#### 4.5.2 GoFly 框架优势

**1. 内置功能模块**:
- 用户认证和权限管理
- 数据库 ORM（基于 GORM）
- 缓存系统（Redis）
- 日志系统
- 配置管理
- API 自动生成

**2. 管理后台**:
- 现成的管理界面
- 数据可视化
- 系统监控
- 用户管理

**3. 性能优势**:
- Go 语言的高并发特性
- 更低的内存占用
- 更快的执行效率

### 4.6 数据库设计（GoFly gform）

基于 GoFly 的 gform ORM，定义数据模型：
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

### 4.2 数据库设计

基于 MustKnow.md 的配置规范，设计核心业务表结构：

#### 4.2.1 核心业务表

**用户表 (users)**:
```sql
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
```

**套餐表 (plans)**:
```sql
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
```

**Token交易表 (token_transactions)**:
```sql
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
```

**Token使用记录表 (token_usage)**:
```sql
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
```

**批量执行表 (batch_executions)**:
```sql
CREATE TABLE batch_executions (
    id VARCHAR(191) PRIMARY KEY,         -- CUID
    user_id VARCHAR(191) NOT NULL,
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
    config JSON,                          -- 任务配置
    results JSON,                         -- 执行结果
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**订阅表 (subscriptions)**:
```sql
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
```

**邀请码表 (invitations)**:
```sql
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
```

**咨询申请表 (consultation_requests)**:
```sql
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
```

### 4.3 系统架构设计

#### 4.3.1 前端架构
- **框架**: Next.js 14 + TypeScript
- **状态管理**: React Context + Hooks
- **UI组件库**: Material-UI (MUI)
- **样式方案**: Tailwind CSS + CSS Modules
- **认证**: NextAuth.js v5

#### 4.3.2 后端架构
- **框架**: GoFly Admin V3 (Go语言)
- **ORM**: GoFly gform (基于GORM)
- **认证**: JWT + Session
- **权限**: RBAC模型
- **缓存**: Redis (内存+Redis二级缓存)
- **日志**: GoFly内置日志系统

#### 4.3.3 数据层架构
- **数据库**: MySQL 8.0
- **连接池**: GoFly内置连接池
- **迁移**: GoFly AutoMigrate
- **备份**: 定时备份策略

#### 4.3.4 部署架构
- **容器化**: Docker + Docker Compose
- **Web服务器**: Nginx (反向代理)
- **进程管理**: Systemd
- **监控**: GoFly内置监控

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

#### 阶段四：管理后台开发（3周）
- [ ] 用户管理模块
- [ ] 系统配置功能
- [ ] 数据统计面板
- [ ] 监控告警系统

### 5.2 技术栈选择

#### 5.2.1 后端技术栈
- **框架**: GoFly Admin V3
- **语言**: Go 1.21+
- **ORM**: GoFly gform (GORM)
- **缓存**: Redis
- **认证**: JWT
- **日志**: GoFly 内置日志

#### 5.2.2 数据库技术栈
- **主库**: MySQL 8.0
- **缓存**: Redis 7.0
- **连接池**: GoFly 内置连接池

### 5.3 部署方案

#### 5.3.1 开发环境
- Docker Compose 本地开发
- 热重载支持
- 本地数据库和 Redis

#### 5.3.2 生产环境
- Docker 容器化部署
- Nginx 反向代理
- MySQL 主从架构
- Redis Cluster

## 6. 验收标准

### 6.1 功能验收

- [ ] 用户注册登录功能正常
- [ ] Google OAuth 集成可用
- [ ] Token 充值消费功能完整
- [ ] 三大核心功能可用
- [ ] 管理后台功能完整

### 6.2 性能验收

- [ ] API 响应时间 < 500ms
- [ ] 支持 1000+ 并发用户
- [ ] 数据库查询优化
- [ ] 缓存命中率 > 80%

### 6.3 安全验收

- [ ] JWT 认证机制安全
- [ ] 用户数据完全隔离
- [ ] 敏感数据加密存储
- [ ] API 限流有效
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

## 附录：GoFly框架核心特性

### A.1 配置管理

**环境配置 (config/config.yaml)**:
```yaml
app:
  name: autoads
  env: development
  port: 8080
  debug: true

database:
  driver: mysql
  host: localhost
  port: 3306
  database: autoads
  username: root
  password: ""
  charset: utf8mb4
  max_idle_conns: 10
  max_open_conns: 100
  conn_max_lifetime: 3600

redis:
  host: localhost
  port: 6379
  password: ""
  db: 0
  pool_size: 10

jwt:
  secret: your-secret-key
  expire: 168h
  refresh_expire: 720h

log:
  level: info
  format: json
  output: stdout
  file: logs/app.log
```

**代码中读取配置**:
```go
var config struct {
    App struct {
        Name string `yaml:"name"`
        Env  string `yaml:"env"`
        Port int    `yaml:"port"`
    } `yaml:"app"`
    Database struct {
        Host     string `yaml:"host"`
        Port     int    `yaml:"port"`
        Database string `yaml:"database"`
        Username string `yaml:"username"`
        Password string `yaml:"password"`
    } `yaml:"database"`
}

// 自动加载配置
gf.LoadConfig("config/config.yaml", &config)
```

### A.2 事件系统

**事件发布订阅**:
```go
// 定义事件
type UserRegisteredEvent struct {
    UserID   uuid.UUID
    Email    string
    Username string
}

// 事件处理器
func SendWelcomeEmail(ctx context.Context, event *UserRegisteredEvent) error {
    // 发送欢迎邮件逻辑
    return nil
}

// 注册事件处理器
gf.Event().Subscribe(&UserRegisteredEvent{}, SendWelcomeEmail)

// 发布事件
gf.Event().Publish(&UserRegisteredEvent{
    UserID:   userID,
    Email:    email,
    Username: username,
})
```

### A.3 缓存系统

**多级缓存**:
```go
// 使用Redis缓存
cache := gf.Cache("redis")

// 设置缓存
err := cache.Set(ctx, "user:123", user, 5*time.Minute)

// 获取缓存
var user models.User
err := cache.Get(ctx, "user:123", &user)

// 缓存标签（支持批量删除）
cache.Tag("users").Set(ctx, "user:123", user, time.Hour)
cache.Tag("users").Flush(ctx) // 删除所有users标签的缓存
```

### A.4 任务队列

**异步任务处理**:
```go
// 定义任务
type SendEmailTask struct {
    To      string
    Subject string
    Body    string
}

// 任务处理器
func (t *SendEmailTask) Handle(ctx context.Context) error {
    // 发送邮件逻辑
    return nil
}

// 投递任务
err := gf.Queue().Push(ctx, &SendEmailTask{
    To:      "user@example.com",
    Subject: "Welcome",
    Body:    "Thank you for registering!",
})

// 延迟任务
err = gf.Queue().PushDelayed(ctx, task, 10*time.Minute)
```

### A.5 监控和指标

**内置监控**:
```go
// 自定义指标
gf.Metrics().Counter("token_consumed_total", "标签", map[string]string{
    "feature": "batch_open",
    "user_tier": "pro",
}).Inc()

// 执行时间监控
timer := gf.Metrics().Timer("api_request_duration")
timer.Start()
// ... 执行逻辑
timer.ObserveDuration()

// 健康检查
gf.Health().AddCheck("database", &DatabaseChecker{})
gf.Health().AddCheck("redis", &RedisChecker{})
```
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