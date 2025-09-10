# AutoAds 多用户 SaaS 系统重构 PRD

## 文档信息
- **项目名称**: AutoAds 多用户 SaaS 系统重构
- **版本**: v2.0
- **创建日期**: 2025-01-09
- **最后更新**: 2025-01-10
- **负责人**: 产品团队

## 执行摘要

AutoAds 将重构为支持多用户访问的 SaaS 系统，使用 Go 语言重构后端核心功能以大幅提升性能。系统将区分普通用户和管理员用户：普通用户可通过邮箱或 Google OAuth 登录使用三大核心功能；管理员通过账号密码登录后台管理系统。重构将保持现有前端布局，优化 UI 设计，并通过 Go 单体应用架构实现 BatchGo、SiteRankGo、ChangeLinkGo 功能的并发性能提升 500% 以上。

## 1. 项目概述

### 1.1 现有项目分析

#### 分析来源
基于 IDE 的代码深度分析和 GoFly 框架研究

#### 当前项目状态
AutoAds 是一个成熟的自动化营销平台，已稳定运行并提供三大核心功能：
- **BatchOpen（批量访问）**: 使用 Puppeteer 实现三种执行模式的批量URL访问系统
- **SiteRank（网站排名）**: 集成 SimilarWeb API 的网站排名查询和分析系统
- **ChangeLink（链接管理）**: 集成 Google Ads API 和 AdsPower 的广告链接自动化管理系统

#### 技术栈现状
**前端技术栈**:
- Next.js 14 + React 18 + TypeScript
- MUI v7 + Tailwind CSS
- Zustand 状态管理
- Socket.io 实时通信

**后端技术栈**:
- Node.js + Express（Next.js API Routes）
- MySQL 8.0 + Prisma ORM
- Redis 7.0
- Puppeteer 浏览器自动化

**外部集成**:
- SimilarWeb API（网站数据）
- Google Ads API（广告管理）
- AdsPower API（浏览器自动化）

### 1.2 重构范围定义

#### 重构类型
- [x] 架构重构（Node.js单体 → Go单体+模块化）
- [x] 技术栈升级（Node.js → Go + Next.js）
- [x] 多用户支持（单用户 → 多用户系统）
- [x] 框架集成（集成GoFly后台管理）
- [x] 性能优化（并发性能提升500%+）

#### 重构描述
将现有应用重构为支持多用户的系统，后端使用Go语言重写三大核心功能并集成GoFly框架提供后台管理，前端保持Next.js布局并进行UI优化。

#### 影响评估
- [x] 重大影响（系统性重构）

### 1.3 目标和背景

#### 核心目标
1. **架构升级**: 从Node.js单体应用演进为Go单体应用+模块化设计，提升系统可扩展性
2. **性能提升**: 利用Go语言并发优势，实现核心功能性能提升500%以上
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

## 2. 需求分析

### 2.1 功能需求（Functional Requirements）

#### FR1: 用户认证系统
- **FR1.1**: 实现普通用户邮箱注册流程，包括邮箱验证
- **FR1.2**: 集成 Google OAuth2.0 一键登录功能
- **FR1.3**: 用户资料管理（头像、昵称、联系方式等）
- **FR1.4**: 用户密码重置和账号安全设置
- **FR1.5**: 登录状态保持和自动续期

#### FR2: 管理员系统
- **FR2.1**: 初始化超级管理员账号（用户名: admin，密码可配置）
- **FR2.2**: 管理员通过账号密码登录后台管理系统
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
  - 新用户通过邀请链接注册：获得30天Pro套餐（不与基础新用户14天奖励叠加）
  - 多次邀请奖励可累加，但最长不超过365天
  - 试用期从激活开始计算，不可暂停
- **FR3.10**: 套餐配置后台管理功能

#### FR4: BatchGo 模块（支持HTTP和Puppeteer访问模式）
- **FR4.1**: 完整迁移三种执行模式（Basic/Silent/Automated）
- **FR4.2**: 基于 Go 实现高并发任务处理，支持万级并发
- **FR4.3**: **HTTP访问模式**：
  - 轻量级HTTP请求库实现
  - 高性能并发处理（支持10倍Puppeteer并发量）
  - 支持自定义User-Agent和请求头
  - 自动处理Cookies和Session
  - 适合大规模批量访问任务

- **FR4.4**: **Puppeteer访问模式**：
  - 完整的浏览器环境模拟
  - 支持JavaScript渲染和动态内容
  - 自动处理验证码和反爬机制
  - 支持截图和页面调试
  - 适合需要真实浏览器环境的任务

- **FR4.5**: **Basic 版本权限**：
  - **纯前端实现**：使用浏览器原生 window.open() API
  - 在用户浏览器中批量打开新标签页
  - 不依赖后端服务器资源
  - 固定200ms打开间隔
  - 最大支持 100 个 URL/任务
  - 依赖用户手动配置代理
  - 适合简单的批量打开需求

- **FR4.6**: **Silent 版本权限**：
  - 支持多线程并发执行（最多 5 线程）
  - 支持 **HTTP访问模式** 和 **Puppeteer访问模式**
  - 高级代理池管理（自动检测和切换）
  - 智能重试机制和错误恢复
  - 支持自定义执行间隔
  - 最大支持 1000 个 URL/任务

- **FR4.7**: **Automated 版本权限**：
  - 支持大规模并发执行（最多 50 线程）
  - 支持 **HTTP访问模式** 和 **Puppeteer访问模式**
  - 企业级代理池（多地区、自动负载均衡）
  - 智能调度和优先级队列
  - 实时监控和性能分析
  - 支持定时任务和批量导入
  - 最大支持 5000 个 URL/任务

- **FR4.8**: 任务实时监控和结果统计
- **FR4.9**: 任务历史记录和回放功能

#### FR4.10: BatchGo 访问模式选择逻辑
- **FR4.10.1**: **模式选择界面**：
  - Basic版本：不提供模式选择（默认使用轻量级HTTP请求）
  - Silent/Automated版本：创建任务时提供模式选择选项
  - 模式选择说明：明确展示两种模式的优缺点和适用场景

- **FR4.10.2**: **HTTP模式推荐场景**：
  - 批量访问静态网页（无需JavaScript渲染）
  - 大规模URL快速验证
  - API接口测试
  - 简单数据抓取任务
  - 对性能要求高、资源消耗敏感的场景

- **FR4.10.3**: **Puppeteer模式推荐场景**：
  - 需要JavaScript渲染的SPA应用
  - 处理复杂验证码和反爬机制
  - 需要截图或页面调试的任务
  - 模拟真实用户行为
  - 对渲染准确性要求高的场景

- **FR4.10.4**: **智能模式建议**：
  - 系统根据URL特征自动推荐合适的模式
  - 提供模式切换的性能预估（时间、资源消耗）
  - 支持任务执行过程中动态调整模式

#### FR5: SiteRankGo 模块
- **FR5.1**: SimilarWeb API 集成和优化
- **FR5.2**: 批量查询性能提升（支持万级域名）
- **FR5.3**: 多层缓存策略（Redis + 本地缓存）
- **FR5.4**: 历史数据存储和趋势分析
- **FR5.5**: 自定义查询规则和报表

#### FR6: ChangeLinkGo 模块
- **FR6.1**: Google Ads API 多账户管理
- **FR6.2**: AdsPower 自动化流程优化
- **FR6.3**: 复杂链接替换规则引擎
- **FR6.4**: 执行状态实时监控
- **FR6.5**: 失败回滚和错误恢复机制

#### FR7: 前端界面优化
- **FR7.1**: 保持现有页面布局和导航结构
- **FR7.2**: 支持免登录访问网站页面（无需模糊预览）
- **FR7.3**: 功能按钮点击时强制引导登录：
  - SiteRank的"开始分析"按钮
  - BatchOpen的"代理认证"、"批量打开"、"新增任务"按钮
  - ChangeLink的"立即使用"按钮
  - 价格页面的"立即订阅"按钮
- **FR7.4**: 优化 UI 设计，提升视觉体验
- **FR7.5**: 响应式设计，支持移动端访问
- **FR7.6**: 实时数据展示和交互优化
- **FR7.7**: 多用户界面适配（用户信息展示等）

#### FR8: Token 管理系统
- **FR8.1**: 简化 Token 余额架构：
  - **单一 Token 余额**: 所有用户只有一个 token_balance 字段
  - **交易来源追踪**: 通过 transaction 记录区分 Token 来源（订阅/购买/活动奖励）
  - **优先级逻辑**: 消费时自动按优先级扣除不同来源的 Token

- **FR8.2**: Token 来源和优先级：
  1. **订阅赠送**: 套餐包含的 Tokens（优先使用，避免过期浪费）
  2. **活动奖励**: 签到、邀请等活动获得（有30天有效期）
  3. **用户购买**: 充值购买的 Tokens（无有效期限制）

- **FR8.3**: Token 充值和消费统计
- **FR8.4**: Token 消费规则配置
- **FR8.5**: Token 交易记录管理（记录每笔交易的来源）
- **FR8.6**: Token 使用分析报表
- **FR8.7**: 每日签到奖励 Token 机制

#### FR9: 用户中心功能
- **FR9.1**: 个人信息管理
- **FR9.2**: 订阅管理（查看套餐信息）
- **FR9.3**: Token 消费记录
- **FR9.4**: 每日签到功能
- **FR9.5**: 邀请好友功能
- **FR9.6**: 消息通知中心（包含飞书 Webhook 配置）

#### FR10: 管理员仪表板
- **FR10.1**: 关键指标趋势图（注册用户、日活、订阅数、收入等）
- **FR10.2**: 用户列表管理（禁用、充值、改套餐等）
- **FR10.3**: 角色管理（普通用户/管理员）
- **FR10.4**: 套餐配置管理
- **FR10.5**: Token 消费分析
- **FR10.6**: API 限速配置（热更新）
- **FR10.7**: 通知模板管理
- **FR10.8**: 支付记录查看（仅Token充值记录，无自动订阅扣费）

#### FR10.12: 支付系统说明
- **FR10.12.1**: **当前采用手动Token充值模式**：
  - 用户通过"立即订阅"按钮提交充值需求
  - 管理员审核后手动为用户充值对应Token数量
  - 不集成Stripe等自动支付系统
  - 无自动续费和定期扣费机制

- **FR10.12.2**: **订阅套餐激活流程**：
  - 用户选择套餐后提交申请
  - 管理员审核并手动激活套餐权限
  - 激活后自动赠送对应数量的Tokens
  - 套餐到期后自动降级至Free套餐

- **FR10.12.3**: **支付记录管理**：
  - 记录所有Token充值交易
  - 支持按用户、时间、金额筛选
  - 导出充值报表功能
  - 手动标记充值状态（待审核/已充值/已取消）
- **FR10.9**: API 监控统计
- **FR10.10**: 签到记录管理
- **FR10.11**: 邀请记录管理

#### FR11: GoFly 管理后台集成
- **FR11.1**: 选择性集成 GoFly Admin V3 核心模块：
  - 用户管理模块
  - RBAC权限系统
  - 系统配置管理
  - 操作日志审计
  - 数据可视化组件
- **FR11.2**: 自定义开发业务特定功能，避免GoFly过度耦合
- **FR11.3**: 系统日志和操作审计
- **FR11.4**: 数据可视化和报表系统
- **FR11.5**: 系统配置和参数管理

### 2.2 非功能需求（Non-Functional Requirements）

#### NFR1: 性能需求
- **NFR1.1**: 系统响应时间降低 50%（P95 < 200ms）
- **NFR1.2**: 支持 5,000+ 用户并发在线
- **NFR1.3**: BatchGo 并发处理能力提升 500%（支持 1000+ 并发）
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
- **NFR5.3**: 自动化测试和 CI/CD 流程
- **NFR5.4**: 完善的监控和告警系统

### 2.3 兼容性需求（Compatibility Requirements）

#### CR1: 数据配置
- **CR1.1**: 使用新的MySQL数据库，无需数据迁移
- **CR1.2**: 数据库连接使用环境变量DATABASE_URL
- **CR1.3**: Redis连接使用环境变量REDIS_URL
- **CR1.4**: 遵循docs/MustKnow.md中的配置信息，包含默认的DATABASE_URL和REDIS_URL值

#### CR2: 功能兼容性
- **CR2.1**: 三大核心功能 100% 兼容
- **CR2.2**: BatchGo支持HTTP和Puppeteer两种访问模式
- **CR2.3**: 用户体验保持一致

#### CR3: 界面兼容性
- **CR3.1**: 保持现有页面布局结构
- **CR3.2**: 优化 UI 但不改变核心交互
- **CR3.3**: 支持现有快捷键和操作习惯

### 2.4 用户套餐权限矩阵

#### 套餐配置详情

**免费套餐（Free）**:
- "真实点击"功能，包括"初级版本"（Basic，前端标签页打开）和"静默版本"（Silent，支持HTTP和Puppeteer模式）
- "网站排名"功能，批量查询域名上限 100 个/次
- 包含 1,000 tokens

**高级套餐（Pro）**:
- ¥298/月（年付优惠 50%）
- 支持所有免费套餐的功能
- "真实点击"功能，新增"自动化版本"（Automated，支持HTTP和Puppeteer模式）
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
| **单次任务URL数量** | 100 | 1,000 | 5,000 |
| **循环次数上限** | 10 | 100 | 100 |
| **并发任务数** | 1 | 5 | 50 |
| **HTTP模式并发倍数** | - | 10x | 10x |
| **SiteRankGo 查询限制** | 100/次 | 500/次 | 5,000/次 |
| **SiteRankGo 查询频率** | 无限制 | 无限制 | 无限制 |
| **ChangeLinkGo 账户数** | 不支持 | 10个 | 100个 |
| **包含Token数量** | 1,000 | 10,000 | 100,000 |
| **API 调用频率** | 100/小时 | 1,000/小时 | 10,000/小时 |

### 2.5 Token 充值价格

**Token 充值包**（充值越多，折扣越大）:
- 小包: ¥99 = 10,000 tokens
- 中包: ¥299 = 50,000 tokens (约 40% off)
- 大包: ¥599 = 200,000 tokens (约 67% off)
- 超大包: ¥999 = 500,000 tokens (约 80% off)

## 3. 技术架构设计

### 3.1 整体架构

#### 3.1.1 架构模式
采用**前后端分离 + 单体应用+模块化**的混合架构：
- **前端层**: Next.js 14 + TypeScript（保持现有）
- **网关层**: GoFly Router（统一入口）
- **服务层**: Go 单体应用 + 模块化设计（业务逻辑）
- **数据层**: MySQL + Redis（持久化存储）

#### 3.1.2 部署架构
```
┌─────────────────────────────────────────────────────────────┐
│                     CDN / Load Balancer                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
┌───────▼────────┐            ┌──────▼──────────┐
│  Next.js      │            │   GoFly API    │
│  Frontend     │◄──────────►│   Gateway      │
│  (现有)       │            │   (GoFly)      │
└───────────────┘            └───────┬──────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
    ┌───────▼───────┐         ┌──────▼────────┐        ┌──────▼────────┐
    │   BatchGo    │         │  SiteRankGo   │        │  ChangeLinkGo │
    │   Service    │         │    Service    │        │    Service    │
    │    (Go)      │         │     (Go)       │        │     (Go)      │
    └───────────────┘         └───────────────┘        └───────────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │        GoFly Admin System       │
                    │   (User/Tenant/Permission Mgmt)  │
                    └─────────────────┬─────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
    ┌───────▼───────┐         ┌──────▼────────┐        ┌──────▼────────┐
    │    MySQL      │         │     Redis      │        │  File Storage │
    │ (Multi-tenant)│        │   (Cache/Queue) │      │   (Uploads)   │
    └───────────────┘         └───────────────┘        └───────────────┘
```

### 3.2 模块化设计

#### 3.2.1 服务拆分原则
- **单一职责**: 每个服务专注特定业务领域
- **高内聚低耦合**: 服务间通过 API 通信
- **无状态设计**: 服务自身不保存状态
- **独立部署**: 每个服务可独立构建和部署

#### 3.2.2 服务列表
1. **API Gateway** (GoFly Router)
   - 路由转发
   - 认证授权
   - 限流熔断
   - 日志监控

2. **User Service** (基于 GoFly)
   - 用户注册登录
   - 个人资料管理
   - OAuth2 集成
   - 权限验证

3. **Tenant Service**
   - 租户管理
   - 套餐订阅
   - 资源配额
   - 域名配置

4. **BatchGo Service**
   - 任务管理
   - URL 批量处理
   - 代理管理
   - 结果统计

5. **SiteRankGo Service**
   - 排名查询
   - 数据缓存
   - 报表生成
   - 历史分析

6. **ChangeLinkGo Service**
   - 链接管理
   - 自动化执行
   - 账户管理
   - 监控回滚

### 3.3 数据库设计

#### 3.3.1 数据库配置
- **MySQL**: 使用环境变量DATABASE_URL连接
- **Redis**: 使用环境变量REDIS_URL连接
- **配置示例**: 
  - DATABASE_URL=mysql://root:jtl85fn8@dbprovider.sg-members-1.clawcloudrun.com:30354
  - REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284
- **注意**: 全新MySQL数据库部署，无需迁移现有数据

#### 3.3.2 用户数据隔离
采用**用户ID字段**方案，所有业务表包含 user_id 字段：
```sql
-- 用户表（基于现有Prisma schema优化）
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100),
    avatar VARCHAR(500),
    email_verified TINYINT DEFAULT 0,
    role ENUM('USER', 'ADMIN', 'SUPER_ADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED') DEFAULT 'ACTIVE',
    password_hash VARCHAR(255),
    plan_id BIGINT DEFAULT 1, -- 1:Free, 2:Pro, 3:Max
    -- Token余额统一字段
    token_balance INT DEFAULT 0,
    token_used_this_month INT DEFAULT 0,
    -- 用户行为字段
    trial_used TINYINT DEFAULT 0,
    login_count INT DEFAULT 0,
    last_login_at TIMESTAMP NULL,
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_plan_id (plan_id)
);

-- 管理员表
CREATE TABLE admin (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    role_id BIGINT,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 套餐配置表
CREATE TABLE subscription_plan (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    price DECIMAL(10,2) DEFAULT 0.00,
    annual_price DECIMAL(10,2) DEFAULT 0.00,
    tokens INT DEFAULT 0,
    features JSON,
    status TINYINT DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户订阅表
CREATE TABLE user_subscription (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active/expired/cancelled
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    auto_renew TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- Token 消费规则表
CREATE TABLE token_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    feature_code VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    token_cost INT DEFAULT 1,
    description VARCHAR(255),
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户 Token 余额表（统一Token系统）
CREATE TABLE user_token_balance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    -- 主Token余额（用于功能消费）
    main_balance INT DEFAULT 0,
    -- 活动获得余额（签到、邀请奖励等）
    activity_balance INT DEFAULT 0,
    -- 购买余额（充值获得）
    purchased_balance INT DEFAULT 0,
    -- 订阅赠送余额
    subscription_balance INT DEFAULT 0,
    total_earned INT DEFAULT 0,
    total_spent INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- Token 交易记录表
CREATE TABLE token_transaction (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL, -- earn/spend
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    source VARCHAR(50) NOT NULL, -- subscription/purchase/consumption/checkin/invite
    reference_id BIGINT, -- 关联业务ID
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_created_at (created_at)
);

-- 邀请记录表
CREATE TABLE invitation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    inviter_id BIGINT NOT NULL,
    invitee_id BIGINT,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending/success/expired
    reward_days INT DEFAULT 30,
    reward_granted TINYINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_inviter_id (inviter_id),
    INDEX idx_invite_code (invite_code)
);

-- 签到记录表
CREATE TABLE user_checkin (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    checkin_date DATE NOT NULL,
    consecutive_days INT DEFAULT 1,
    token_reward INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, checkin_date),
    INDEX idx_user_id (user_id)
);

-- 通知模板表
CREATE TABLE notification_template (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'system', -- system/email/webhook
    trigger_condition JSON,
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户通知表
CREATE TABLE user_notification (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    status VARCHAR(20) DEFAULT 'unread', -- unread/read
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- 用户飞书配置表
CREATE TABLE user_feishu_config (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    webhook_url VARCHAR(500),
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- API 限速配置表
CREATE TABLE api_rate_limit (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    api_path VARCHAR(100) NOT NULL,
    plan_id BIGINT NOT NULL,
    requests_per_minute INT DEFAULT 60,
    requests_per_hour INT DEFAULT 3600,
    requests_per_day INT DEFAULT 86400,
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_api_plan (api_path, plan_id)
);
```

#### 3.3.3 API 限速实现策略

**限流算法选择**: 滑动时间窗口算法

**Redis 键设计**:
```
rate_limit:{user_id}:{api_path}:{minute}
```

**实现示例**:
```go
func RateLimitMiddleware(apiPath string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        planID := getUserPlanID(userID)
        
        // 从Redis获取限流配置
        limits, _ := getRateLimits(apiPath, planID)
        
        // 滑动窗口计数
        key := fmt.Sprintf("rate_limit:%d:%s:%d", userID, apiPath, time.Now().Unix()/60)
        count, _ := redis.Incr(key)
        if count == 1 {
            redis.Expire(key, 60*time.Second)
        }
        
        if int(count) > limits.PerMinute {
            c.JSON(429, gin.H{
                "code": 429,
                "message": "请求过于频繁，请稍后再试",
                "retry_after": "60s"
            })
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

**热更新机制**:
- 限流配置变更时，发布到Redis频道
- 所有服务订阅配置变更，实时更新内存缓存
- 无需重启服务即可生效

#### 3.3.5 外部API Key管理

**API Key存储架构**:
```go
// API Key管理器
type APIKeyManager struct {
    redis   *redis.Client
    cipher  *crypto.Cipher
    config  *Config
}

// 加密存储API Key
func (m *APIKeyManager) StoreKey(service, key string) error {
    encrypted, err := m.cipher.Encrypt(key)
    if err != nil {
        return err
    }
    
    return m.redis.HSet("api_keys", service, encrypted)
}

// 获取API Key
func (m *APIKeyManager) GetKey(service string) (string, error) {
    encrypted, err := m.redis.HGet("api_keys", service)
    if err != nil {
        return "", err
    }
    
    return m.cipher.Decrypt(encrypted)
}
```

**Key轮换和监控**:
- 定期自动轮换API Key（每90天）
- 使用量监控和异常检测
- 多Key备份机制确保服务连续性
- Key失效自动切换到备用Key

**使用策略**:
- SimilarWeb API: 轮询使用多个Key
- Google Ads API: 每个用户独立的OAuth Token
- 代理服务API: 动态分配最优Key

#### 3.3.6 监控和告警系统

**监控指标收集**:
```yaml
# Prometheus配置示例
scrape_configs:
  - job_name: 'autoads_services'
    static_configs:
      - targets: ['api-gateway:8080']
      - targets: ['batchgo:8081']
      - targets: ['siterank:8082']
      - targets: ['changelink:8083']
```

**关键监控指标**:
- 系统指标: CPU、内存、磁盘、网络使用率
- 应用指标: QPS、响应时间、错误率、Token消耗速度
- 业务指标: 用户活跃度、任务成功率、API调用次数
- 数据库指标: 连接数、慢查询、锁等待时间

**告警规则配置**:
```yaml
groups:
- name: autoads_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "HTTP错误率过高"
      description: "5分钟内错误率超过10%"
  
  - alert: TokenBalanceLow
    expr: user_token_balance < 100
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "用户Token余额不足"
      description: "用户Token余额低于100"
```

**通知渠道**:
- 飞书Webhook: 实时告警通知
- 邮件通知: 每日/周报
- 短信告警: P0级故障

#### 3.3.7 业务表结构示例
```sql
-- BatchGo 任务表
CREATE TABLE batch_task (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    mode VARCHAR(20) DEFAULT 'basic', -- basic/silent/automated
    access_mode VARCHAR(20) DEFAULT 'http', -- http/puppeteer
    status VARCHAR(20) DEFAULT 'pending',
    total_urls INT DEFAULT 0,
    success_urls INT DEFAULT 0,
    failed_urls INT DEFAULT 0,
    config JSON,
    result JSON,
    start_time DATETIME,
    end_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (user_id, status)
);

-- SiteRankGo 查询表
CREATE TABLE siterank_query (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    domain VARCHAR(255) NOT NULL,
    query_data JSON,
    result_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_domain (domain)
);

#### 3.3.3 Token 消费规则配置

初始 Token 消费规则：
```sql
-- SiteRankGo 查询消耗
INSERT INTO token_rule (feature_code, action, token_cost, description) VALUES
('siterank', 'query', 1, '成功查询1个域名消耗1个token');

-- BatchGo HTTP 模式消耗
INSERT INTO token_rule (feature_code, action, token_cost, description) VALUES
('batchgo', 'http_access', 1, 'HTTP模式成功访问1个URL消耗1个token');

-- BatchGo Puppeteer 模式消耗
INSERT INTO token_rule (feature_code, action, token_cost, description) VALUES
('batchgo', 'puppeteer_access', 2, 'Puppeteer模式成功访问1个URL消耗2个token');
```

#### 3.3.4 初始套餐配置

```sql
-- Free 套餐
INSERT INTO subscription_plan (name, code, price, tokens, features, sort_order) VALUES
('免费套餐', 'free', 0.00, 1000, '{"batchgo_versions": ["basic", "silent"], "siterank_limit": 100, "changelink_accounts": 0}', 1);

-- Pro 套餐
INSERT INTO subscription_plan (name, code, price, annual_price, tokens, features, sort_order) VALUES
('高级套餐', 'pro', 298.00, 1490.00, 10000, '{"batchgo_versions": ["basic", "silent", "automated"], "siterank_limit": 500, "changelink_accounts": 10}', 2);

-- Max 套餐
INSERT INTO subscription_plan (name, code, price, annual_price, tokens, features, sort_order) VALUES
('白金套餐', 'max', 998.00, 4990.00, 100000, '{"batchgo_versions": ["basic", "silent", "automated"], "siterank_limit": 5000, "changelink_accounts": 100}', 3);
```
```

### 3.4 技术实现澄清

#### 3.4.1 GoFly 集成范围明细

**需要集成的 GoFly 模块**：
| 模块名称 | 集成方式 | 用途 |
|---------|----------|------|
| 用户管理 | 完整集成 | 用户注册、登录、资料管理 |
| RBAC权限 | 完整集成 | 角色权限控制 |
| 系统配置 | 完整集成 | 系统参数配置管理 |
| 操作日志 | 完整集成 | 审计日志记录 |
| 数据可视化 | 选择性集成 | 仅使用图表组件 |
| 菜单管理 | 自定义开发 | 根据业务需求定制 |
| 通知系统 | 自定义开发 | 集成飞书等特定需求 |

**自定义开发的功能模块**：
- 套餐管理系统
- Token 充值和消费系统
- 签到和邀请系统
- 三大核心业务功能

#### 3.4.2 简化服务架构

**架构决策**：采用**Go单体应用 + 模块化设计**，避免过度微服务化

**服务架构**：
```
GoFly 主应用 (单体架构)
├── 核心框架层
│   ├── RBAC权限系统
│   ├── 用户管理
│   ├── 系统配置
│   └── API网关
├── 业务模块层
│   ├── BatchGo模块
│   ├── SiteRankGo模块
│   ├── ChangeLinkGo模块
│   ├── Token系统模块
│   └── 用户运营模块（签到、邀请）
└── 基础设施层
    ├── Redis缓存
    ├── MySQL数据库
    └── 消息队列（Redis Pub/Sub）
```

**模块间通信**：
- **内部模块**: 函数调用（同一进程内）
- **外部API**: HTTP/HTTPS请求
- **实时通信**: Redis Pub/Sub + WebSocket
- **前端通信**: RESTful API

#### 3.4.3 性能指标明确定义

**BatchGo 性能基准**：
- **当前性能基准**: Node.js单进程，最高20并发
- **目标性能提升**: 500% (从20并发提升到100并发)
- **各套餐并发限制**:
  - Free: 1并发 (Basic版本)
  - Pro: 5并发 (Silent版本)
  - Max: 50并发 (Automated版本)
- **HTTP模式性能**: 10倍于Puppeteer模式并发量

**系统整体性能目标**：
- API响应时间: P95 < 200ms
- 支持并发用户: 5,000+
- 系统可用性: 99.9%
- 数据库查询: P95 < 100ms

#### 3.4.4 数据隔离实现策略

**数据库层面隔离**：
- 所有业务表必须包含 `user_id` 字段
- 所有查询必须包含 `user_id = ?` 条件
- 使用数据库视图简化常用查询

**应用层面隔离**：
```go
// 数据查询中间件示例
func UserDataMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        if userID == 0 {
            c.JSON(401, gin.H{"error": "未授权"})
            c.Abort()
            return
        }
        
        // 将user_id注入查询参数
        c.Set("db_user_id", userID)
        c.Next()
    }
}
```

**API层面隔离**：
- 所有API自动验证用户权限
- 禁止跨用户数据访问
- 操作日志记录所有数据访问

#### 3.4.5 缓存策略详解

**缓存层级**：
1. **Redis缓存** (共享)
   - 用户会话信息
   - 热点业务数据
   - API限流计数器

2. **本地缓存** (服务内)
   - 配置信息
   - 字典数据
   - 用户权限信息

**缓存失效策略**：
- **主动失效**: 数据更新时立即清除相关缓存
- **被动失效**: TTL过期自动清除
- **预热机制**: 系统启动时加载热点数据

**SiteRankGo缓存规则**：
- 查询结果缓存: 24小时
- 域名基本信息: 7天
- 趋势分析数据: 1小时

### 3.5 API 设计

#### 3.5.1 RESTful API 规范
```
# 用户认证相关
POST   /api/v1/auth/register          # 用户注册
POST   /api/v1/auth/login             # 用户登录
POST   /api/v1/auth/oauth/google      # Google 登录
POST   /api/v1/auth/logout            # 用户登出
POST   /api/v1/auth/refresh           # 刷新 Token
GET    /api/v1/auth/me                # 获取当前用户信息

# 用户管理相关
GET    /api/v1/user/profile           # 获取用户资料
PUT    /api/v1/user/profile           # 更新用户资料
POST   /api/v1/user/password/reset    # 重置密码
GET    /api/v1/user/plan              # 获取用户套餐信息

# 管理员相关（独立入口）
POST   /admin/api/login               # 管理员登录

# 仪表板相关
GET    /admin/api/dashboard/stats      # 关键指标统计
GET    /admin/api/dashboard/charts    # 趋势图表数据

# 用户管理相关
GET    /admin/api/users               # 获取用户列表
GET    /admin/api/users/:id           # 获取用户详情
PUT    /admin/api/users/:id/status    # 禁用/启用用户
POST   /admin/api/users/:id/tokens    # 给用户充值Token
PUT    /admin/api/users/:id/plan      # 修改用户套餐
GET    /admin/api/users/:id/subscriptions # 用户订阅历史

# 角色管理相关
GET    /admin/api/roles               # 角色列表
PUT    /admin/api/users/:id/role      # 修改用户角色

# 套餐管理相关
GET    /admin/api/plans               # 套餐列表
POST   /admin/api/plans               # 创建套餐
PUT    /admin/api/plans/:id           # 更新套餐
DELETE /admin/api/plans/:id           # 删除套餐

# Token管理相关
GET    /admin/api/token/rules         # Token消费规则
PUT    /admin/api/token/rules/:id     # 修改Token规则
GET    /admin/api/token/analysis      # Token使用分析
GET    /admin/api/token/transactions  # Token交易记录

# API限速相关
GET    /admin/api/rate-limits         # API限速配置
PUT    /admin/api/rate-limits/:id     # 修改限速配置
POST   /admin/api/rate-limits/reload  # 热更新限速配置

# 通知管理相关
GET    /admin/api/notification/templates # 通知模板
PUT    /admin/api/notification/templates/:id # 修改通知模板

# 支付相关
GET    /admin/api/payments/records    # 支付记录

# API监控相关
GET    /admin/api/api/stats            # API统计信息
GET    /admin/api/api/logs             # API访问日志

# 签到相关
GET    /admin/api/checkin/records      # 签到记录

# 邀请相关
GET    /admin/api/invitation/records  # 邀请记录

# 系统相关
GET    /admin/api/system/status       # 系统状态
GET    /admin/api/logs                # 系统日志

# BatchGo 相关
POST   /api/v1/batch/tasks            # 创建任务
GET    /api/v1/batch/tasks            # 获取任务列表
GET    /api/v1/batch/tasks/:id        # 获取任务详情
PUT    /api/v1/batch/tasks/:id        # 更新任务
DELETE /api/v1/batch/tasks/:id        # 删除任务
POST   /api/v1/batch/tasks/:id/start  # 启动任务
POST   /api/v1/batch/tasks/:id/stop   # 停止任务
GET    /api/v1/batch/tasks/:id/result # 获取任务结果

# SiteRankGo 相关
POST   /api/v1/siterank/queries       # 创建查询
GET    /api/v1/siterank/queries       # 查询历史
GET    /api/v1/siterank/domains/:id   # 获取域名排名
GET    /api/v1/siterank/report        # 生成报告

# ChangeLinkGo 相关
POST   /api/v1/changelink/tasks       # 创建任务
GET    /api/v1/changelink/accounts    # 账户列表
POST   /api/v1/changelink/execute     # 执行替换
GET    /api/v1/changelink/logs        # 执行日志

# 用户中心相关
GET    /api/v1/user/profile           # 获取用户资料
PUT    /api/v1/user/profile           # 更新用户资料
GET    /api/v1/user/subscription      # 获取订阅信息
GET    /api/v1/user/tokens            # 获取Token余额
GET    /api/v1/user/token/transactions # Token交易记录
POST   /api/v1/user/checkin           # 每日签到
GET    /api/v1/user/checkin/history   # 签到历史
GET    /api/v1/user/invitation        # 获取邀请信息
POST   /api/v1/user/invitation/generate # 生成邀请链接
GET    /api/v1/user/invitation/records # 邀请记录
GET    /api/v1/user/notifications     # 通知列表
PUT    /api/v1/user/notifications/:id/read # 标记通知已读
POST   /api/v1/user/feishu/config     # 配置飞书Webhook

# 套餐相关
GET    /api/v1/plans                  # 获取套餐列表
GET    /api/v1/plans/:id              # 获取套餐详情

# 定价页面
GET    /api/v1/pricing/info            # 获取定价信息
POST   /api/v1/pricing/inquiry        # 提交咨询
```

#### 3.4.2 WebSocket 实时通信
```javascript
// 任务进度推送
ws://localhost:8200/ws/batch/task/{taskId}

// 系统通知
ws://localhost:8200/ws/notifications
```

### 3.5 安全设计

#### 3.5.1 认证授权流程
```go
// 用户 JWT Token 结构
type UserClaims struct {
    UserID   int64  `json:"user_id"`
    Username string `json:"username"`
    PlanID   int    `json:"plan_id"`
    Exp      int64  `json:"exp"`
    jwt.StandardClaims
}

// 管理员 JWT Token 结构
type AdminClaims struct {
    AdminID  int64  `json:"admin_id"`
    Username string `json:"username"`
    RoleID   int64  `json:"role_id"`
    Exp      int64  `json:"exp"`
    jwt.StandardClaims
}

// 用户认证中间件
func UserAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"code": 401, "message": "未授权"})
            c.Abort()
            return
        }
        
        // 验证 Token 并提取用户信息
        claims, err := ValidateUserToken(token)
        if err != nil {
            c.JSON(401, gin.H{"code": 401, "message": "Token无效"})
            c.Abort()
            return
        }
        
        // 检查用户状态和套餐权限
        user, err := GetUserByID(claims.UserID)
        if err != nil || user.Status != 1 {
            c.JSON(403, gin.H{"code": 403, "message": "用户已被禁用"})
            c.Abort()
            return
        }
        
        // 设置上下文
        c.Set("user_id", claims.UserID)
        c.Set("plan_id", claims.PlanID)
        c.Next()
    }
}

// 管理员认证中间件
func AdminAuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"code": 401, "message": "未授权"})
            c.Abort()
            return
        }
        
        claims, err := ValidateAdminToken(token)
        if err != nil {
            c.JSON(401, gin.H{"code": 401, "message": "Token无效"})
            c.Abort()
            return
        }
        
        c.Set("admin_id", claims.AdminID)
        c.Set("role_id", claims.RoleID)
        c.Next()
    }
}

// 功能权限检查中间件（以 BatchGo 为例）
func BatchGoPermissionMiddleware(mode string) gin.HandlerFunc {
    return func(c *gin.Context) {
        planID := c.GetInt("plan_id")
        
        // 检查套餐权限
        switch mode {
        case "basic":
            // 所有套餐都支持
        case "silent":
            if planID < 2 { // Pro套餐
                c.JSON(403, gin.H{"code": 403, "message": "需要Pro套餐才能使用Silent模式"})
                c.Abort()
                return
            }
        case "automated":
            if planID < 3 { // Max套餐
                c.JSON(403, gin.H{"code": 403, "message": "需要Max套餐才能使用Automated模式"})
                c.Abort()
                return
            }
        }
        
        c.Next()
    }
}
```

#### 3.5.2 数据安全
- HTTPS 全链路加密
- 密码 BCrypt 加密存储
- JWT Token 黑名单机制
- API 请求频率限制
- SQL 注入防护
- XSS/CSRF 防护
- 敏感数据脱敏显示

### 3.6 性能优化策略

#### 3.6.1 缓存策略
- **Redis 缓存**: 热点数据、Session、Token
- **本地缓存**: 配置信息、字典数据
- **CDN 缓存**: 静态资源
- **查询缓存**: 数据库查询结果

#### 3.6.2 并发处理
- **连接池**: 数据库、Redis 连接池
- **协程池**: Go 协程池管理
- **限流算法**: 令牌桶、漏桶算法
- **熔断降级**: Hystrix 模式

### 3.7 监控与运维

#### 3.7.1 日志系统
```go
// 结构化日志
type LogEntry struct {
    Timestamp   time.Time              `json:"timestamp"`
    Level       string                 `json:"level"`
    Service     string                 `json:"service"`
    TenantID    string                 `json:"tenant_id,omitempty"`
    UserID      string                 `json:"user_id,omitempty"`
    Action      string                 `json:"action"`
    RequestID   string                 `json:"request_id"`
    Duration    int64                  `json:"duration,omitempty"`
    Error       string                 `json:"error,omitempty"`
    Metadata    map[string]interface{} `json:"metadata"`
}
```

#### 3.7.2 监控指标
- **系统指标**: CPU、内存、磁盘、网络
- **应用指标**: QPS、响应时间、错误率
- **业务指标**: 用户数、任务数、Token 消费
- **数据库指标**: 连接数、慢查询、锁等待

## 3. 用户界面增强目标

### 3.1 集成与现有 UI
- 保持现有页面结构和导航逻辑
- 优化设计风格，提升用户体验
- 新增多用户管理界面
- 集成 GoFly 后台管理界面

### 3.2 修改/新增的界面
- 用户注册和登录页面
- 用户中心和个人设置
- 订阅管理和充值页面
- GoFly 后台管理界面
- 租户管理控制台

## 4. 技术约束和集成需求

### 4.1 现有技术栈
**Languages**: TypeScript, JavaScript
**Frameworks**: Next.js 14, React 18
**Database**: MySQL 8.0 (Prisma ORM)
**Infrastructure**: Node.js, Redis 7.0
**External Dependencies**: SimilarWeb, Google Ads, AdsPower

### 4.2 集成方法

#### 数据库集成策略
- 使用环境变量 DATABASE_URL 访问 MySQL
- 遵循 GoFly 的表命名规范（business_*、admin_*）
- 实现多租户数据隔离

#### API 集成策略
- 保持 Next.js 前端 API 兼容
- 新增 Go 单体应用 API 网关
- 实现服务间通信（gRPC）

#### 前端集成策略
- 保持现有 Next.js 前端框架
- 优化组件架构和状态管理
- 集成 WebSocket 实时通信

### 4.3 现有业务逻辑保护

为确保重构过程中不破坏现有功能，必须保护以下核心业务逻辑：

#### 4.3.1 BatchGo (BatchOpen) 核心逻辑

**必须保留的功能特性**:
- **Basic 版本**: 浏览器标签页打开机制，50 URL限制，5并发
- **Silent 版本**: 后台执行，代理轮换，200 URL限制，20并发
- **Automated 版本**: 定时任务，双引擎，无URL限制，50并发

**关键业务规则**:
- Token消耗：Basic(1 token/URL)、Silent(1 token/URL)、Automated(按成功点击数)
- 代理管理：验证、轮换、故障转移机制
- 任务状态追踪：实时进度更新和错误处理

**技术实现要点**:
- 保持现有API端点兼容性
- 保留任务执行和进度追踪逻辑
- 维护代理池管理和健康检查

#### 4.3.2 SiteRankGo 核心逻辑

**必须保留的功能特性**:
- 域名排名查询流程
- SimilarWeb API集成
- 7天缓存机制
- 批量查询优化

**关键业务规则**:
- Token消耗：1 token/域名（缓存命中不消耗）
- 查询限制：Free(100)、Pro(500)、Max(1000)
- 速率限制：IP限制(30/分钟)、批量限制(5/分钟)

**数据格式要求**:
- 全球排名格式化（K/M表示法）
- 月访问量计算和优先级排序
- 错误处理和数据验证

#### 4.3.3 ChangeLinkGo 核心逻辑

**必须保留的功能特性**:
- Google Ads API集成
- 多账户管理
- 配置管理和自动化执行
- 实时监控

**关键业务规则**:
- 账户切换和会话管理
- 动态配置应用
- 执行状态追踪
- Token消耗基于复杂度

#### 4.3.4 用户管理系统

**必须保留的功能特性**:
- Google OAuth登录流程
- 三层订阅体系（Free/Pro/Max）
- Token余额管理和交易历史
- 14天试用期机制

**关键业务规则**:
- 订阅权限实时验证
- Token消费回滚机制（失败时）
- 特性访问控制矩阵
- 邀请奖励系统（30天Pro）

#### 4.3.5 数据一致性要求

**数据库事务**:
- 所有Token操作必须原子性
- 失败操作自动回滚
- 审计日志完整记录

**缓存一致性**:
- 数据变更时缓存失效
- SiteRank 7天缓存策略
- 用户权限缓存更新

**错误处理**:
- 优雅降级机制
- 用户友好的错误信息
- 自动重试和恢复

### 4.5 代码组织和标准

#### 文件结构方法
- 前端：保持现有 src 目录结构
- 后端：Go 服务按功能模块划分
- 共享：定义 API 接口和数据模型

#### 命名规范
- 数据库表：遵循 GoFly 规范
- API 路由：RESTful 设计
- 代码：Go 官方规范 + 项目约定

### 4.6 部署和运维

#### 构建过程集成
- 前端：Next.js 构建
- 后端：Go 单体应用构建
- Docker 容器化部署

#### 简化部署流程

**1. 镜像构建策略**
```yaml
# GitHub Actions 工作流示例
name: Build and Deploy Application
on:
  push:
    branches: [ main, production ]
  tags:
    - 'v*'

jobs:
  # 前端构建
  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Build Frontend
        run: |
          npm ci
          npm run build
          docker build -f Dockerfile.frontend -t ghcr.io/xxrenzhe/autoads-frontend:${{ github.sha }} .
      
  # GoFly 主应用构建
  build-gofly:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Go
        uses: actions/setup-go@v3
        with:
          go-version: '1.21'
      - name: Build GoFly Application
        run: |
          cd gofly_admin_v3
          go mod download
          # 集成业务模块
          cp -r ../business_modules/* ./
          CGO_ENABLED=0 GOOS=linux go build -o main .
          docker build -f Dockerfile.gofly -t ghcr.io/xxrenzhe/autoads-gofly:${{ github.sha }} .
```

**2. 部署流程**

**步骤 1：镜像推送规则**
- Preview 环境：`ghcr.io/xxrenzhe/autoads-*-service:preview-latest`
- Production 环境：`ghcr.io/xxrenzhe/autoads-*-service:prod-latest`
- 版本标签：`ghcr.io/xxrenzhe/autoads-*-service:prod-v1.0.0`

**步骤 2：ClawCloud 部署配置**
```yaml
# docker-compose.yml 示例
version: '3.8'
services:
  # GoFly 主应用
  gofly-app:
    image: ghcr.io/xxrenzhe/autoads-gofly:prod-latest
    ports:
      - "8200:8200"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - SIMILARWEB_API_KEY=${SIMILARWEB_API_KEY}
      - GOOGLE_ADS_CLIENT_ID=${GOOGLE_ADS_CLIENT_ID}
      - ADSPOWER_API_KEY=${ADSPOWER_API_KEY}
    depends_on:
      - mysql
      - redis
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
  
  # 前端
  frontend:
    image: ghcr.io/xxrenzhe/autoads-frontend:prod-latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.autoads.dev
      - NEXT_PUBLIC_WS_URL=wss://api.autoads.dev/ws
    depends_on:
      - gofly-app
```

**步骤 3：部署顺序**
1. 部署基础设施（MySQL、Redis）
2. 部署 GoFly 主应用
3. 部署前端应用
4. 配置域名和SSL证书
5. 验证服务健康状态

**步骤 4：健康检查和监控**
- GoFly 应用提供 `/health` 端点
- 自动故障检测和重启
- 实时性能监控
- 日志聚合和分析

#### 部署策略
- 使用 GitHub Actions 构建 Docker 镜像
- ClawCloud 容器平台部署
- 支持预发和生产环境
- 单体应用部署，更新简单
- 蓝绿部署支持，零停机更新

#### 监控和日志
- 集成 Prometheus + Grafana
- 结构化日志输出
- 告警和通知机制

### 4.5 风险评估和缓解

#### 技术风险
- **技术风险**: Go 开发经验不足可能影响开发进度
- **集成风险**: GoFly 框架集成可能存在兼容性问题
- **数据迁移风险**: 重构过程中数据可能丢失或损坏

#### 集成风险
- **API 兼容性**: 新旧系统 API 兼容性维护
- **性能风险**: 新架构可能引入新的性能瓶颈

#### 部署风险
- **部署复杂度**: 多服务部署增加复杂度
- **回滚难度**: 新架构回滚需要充分测试

#### 缓解策略
- 提前进行技术培训和原型验证
- 分阶段迁移，确保平滑过渡
- 完善的备份和回滚机制
- 充分的测试和性能优化

## 4. 实施计划

### 4.1 项目阶段划分

#### Phase 1: 基础设施搭建（2周）
**目标**: 搭建开发环境，完成基础架构设计

**主要任务**:
1. 搭建 GoFly 开发环境
2. 设计简化版多用户架构
3. 创建项目代码仓库
4. 建立 CI/CD 流程
5. 完成技术方案评审

**交付物**:
- 架构设计文档
- 开发环境配置
- 代码仓库结构
- CI/CD 配置文件

#### Phase 2: 用户和管理员系统（3周）
**目标**: 实现多用户认证和管理员后台

**主要任务**:
1. 集成 GoFly 管理员模块
2. 实现用户注册登录系统
3. 设计用户数据隔离方案
4. 实现 OAuth2 登录集成
5. 初始化管理员账号

**交付物**:
- 用户认证服务
- 管理员后台系统
- 权限管理模块
- 数据库迁移脚本

#### Phase 3: BatchGo 模块开发（4周）
**目标**: 完成 BatchGo 功能的 Go 语言重构

**主要任务**:
1. 分析现有 BatchOpen 功能
2. 设计 BatchGo 模块架构
3. 实现三种版本的任务管理系统
4. 集成代理池管理
5. 实现版本权限控制
6. 性能优化和测试

**交付物**:
- BatchGo 模块
- 任务调度系统
- 代理管理模块
- 版本权限控制
- API 接口文档

#### Phase 4: SiteRankGo 模块开发（3周）
**目标**: 完成 SiteRankGo 功能的 Go 语言重构

**主要任务**:
1. 集成 SimilarWeb API
2. 实现查询缓存机制
3. 开发批量查询功能
4. 实现历史数据分析
5. 报表生成功能

**交付物**:
- SiteRankGo 模块
- 缓存管理系统
- 数据分析模块
- 报表生成器

#### Phase 5: ChangeLinkGo 模块开发（4周）
**目标**: 完成 ChangeLinkGo 功能的 Go 语言重构

**主要任务**:
1. 集成 Google Ads API
2. 集成 AdsPower 自动化
3. 实现链接管理引擎
4. 开发监控系统
5. 实现回滚机制

**交付物**:
- ChangeLinkGo 模块
- 自动化执行引擎
- 监控告警系统
- API 文档

#### Phase 6: 前端适配和优化（2周）
**目标**: 适配前端界面，集成新的后端 API

**主要任务**:
1. API 接口适配
2. 多用户界面支持
3. 实时通信功能
4. UI 设计优化
5. 兼容性测试

**交付物**:
- 更新后的前端代码
- API 适配层
- 用户操作手册

#### Phase 7: 系统测试和部署（2周）
**目标**: 完成系统测试，部署到生产环境

**主要任务**:
1. 集成测试
2. 性能压力测试
3. 安全测试
4. 数据库初始化
5. 生产环境部署
6. 监控系统配置

**交付物**:
- 测试报告
- 部署文档
- 运维手册
- 监控大屏

### 4.2 资源需求

#### 4.2.1 人力资源
- **架构师**: 1人（全程参与）
- **后端开发**: 3人（Go 开发经验）
- **前端开发**: 2人（React/Next.js）
- **测试工程师**: 1人
- **DevOps 工程师**: 1人
- **产品经理**: 1人

#### 4.2.2 技术资源
- **开发环境**: 
  - Go 1.21+ 开发环境
  - Node.js 18+ 环境
  - MySQL 8.0 数据库
  - Redis 7.0 缓存
- **测试环境**:
  - 与生产环境配置一致
  - 性能测试工具
- **生产环境**:
  - 云服务器配置
  - CDN 服务
  - 监控系统

#### 4.2.3 预算估算
- **人力成本**: 根据团队规模和周期计算
- **基础设施**: 云服务器、数据库、CDN 等
- **第三方服务**: SimilarWeb API、Google Ads API 等
- **培训成本**: Go 语言培训、框架使用培训

### 4.3 风险管理

#### 4.3.1 技术风险
| 风险项 | 影响程度 | 发生概率 | 缓解措施 |
|--------|----------|----------|----------|
| Go 开发经验不足 | 高 | 中 | 提前培训，引入专家指导 |
| 模块化架构复杂度 | 中 | 中 | 充分设计，合理拆分 |
| 性能不达预期 | 高 | 中 | 性能测试，持续优化 |
| 数据隔离安全性 | 高 | 低 | 严格权限控制，数据验证 |

#### 4.3.2 项目风险
| 风险项 | 影响程度 | 发生概率 | 缓解措施 |
|--------|----------|----------|----------|
| 进度延期 | 中 | 高 | 合理排期，预留缓冲 |
| 需求变更 | 高 | 中 | 变更控制流程 |
| 质量问题 | 高 | 低 | 代码审查，自动化测试 |

#### 4.3.3 业务风险
| 风险项 | 影响程度 | 发生概率 | 缓解措施 |
|--------|----------|----------|----------|
| 用户体验下降 | 中 | 低 | 保持现有布局，优化交互 |
| 权限控制失效 | 极高 | 低 | 多层验证，日志审计 |
| 并发性能瓶颈 | 高 | 中 | 压力测试，优化算法 |
| HTTP/Puppeteer模式选择不当 | 中 | 中 | 提供模式选择指南，性能对比 |

### 4.4 成功指标

#### 4.4.1 技术指标
- 系统响应时间降低 50%（P95 < 200ms）
- 支持 5,000+ 并发用户
- BatchGo 并发能力提升 500%（Max套餐50并发）
- 系统可用性 99.9%
- 代码覆盖率 > 80%

#### 4.4.2 业务指标
- 用户注册转化率 > 30%
- 付费转化率 > 10%
- 用户留存率 > 80%
- 三大核心功能使用率 > 90%

#### 4.4.3 运维指标
- 部署自动化率 100%
- 监控覆盖率 100%
- 故障恢复时间 < 5 分钟
- 资源利用率 > 70%

## 5. 用户故事和验收标准

### 5.1 Epic: AutoAds 多用户系统重构

**Epic 目标**: 将 AutoAds 重构为支持多用户的简化 SaaS 平台，集成 GoFly 管理系统，使用 Go 语言提升性能。

**业务价值**: 
- 支持多用户独立使用，扩大用户规模
- 提升系统性能，改善用户体验
- 专业后台管理功能，提高运维效率
- 模块化架构，支持快速迭代

### 5.2 核心用户故事

#### Story 5.2.1: 用户注册和登录
**As a** 新用户,
**I want to** 通过邮箱注册或 Google OAuth 快速登录,
**so that** 我可以开始使用 AutoAds 的各项功能。

**验收标准**:
- [ ] 支持邮箱注册和邮箱验证
- [ ] 集成 Google OAuth2.0 一键登录
- [ ] 自动分配 Free 套餐权限
- [ ] 支持密码重置功能
- [ ] 登录状态持久化

**集成验证**:
- IV1: 注册流程完整且无错误
- IV2: OAuth 登录功能正常
- IV3: 用户数据正确隔离

#### Story 5.2.2: 管理员后台登录
**As a** 系统管理员,
**I want to** 通过预设的账号密码登录后台管理系统,
**so that** 我可以管理用户和系统配置。

**验收标准**:
- [ ] 初始化超级管理员账号（admin）
- [ ] 独立的后台登录入口
- [ ] 管理员密码可修改
- [ ] 登录失败次数限制
- [ ] 管理员操作日志记录

**集成验证**:
- IV1: 管理员登录功能正常
- IV2: 后台权限控制生效
- IV3: 操作日志完整记录

#### Story 5.2.3: BatchGo 版本权限和访问模式
**As a** 不同套餐的用户,
**I want to** 使用对应我套餐等级的 BatchGo 功能，并选择合适的访问模式,
**so that** 我可以高效完成适合我需求的批量任务。

**BatchGo 三种版本详细说明**:

1. **Basic 版本（基础版）**
   - **定位**: 入门级批量URL访问功能
   - **界面**: 使用浏览器标签页打开URL
   - **特点**: 
     - 无需浏览器插件
     - 手动代理管理
     - 简单直观的操作界面
   - **技术实现**: 使用 `window.open()` 在新标签页打开URL
   - **限制**: 
     - 最大50个URL/批次
     - 5个并发
     - 需要手动处理弹出窗口拦截
   - **适用场景**: 小规模、简单的批量访问需求

2. **Silent 版本（静默版）**
   - **定位**: 高效后台批量处理
   - **界面**: 无浏览器界面，后台静默执行
   - **特点**:
     - 后台Chromium处理
     - 自动代理轮换和验证
     - 支持自定义Referer（社交媒体、自定义）
     - 实时进度监控
   - **技术实现**:
     - 后端API: `/api/batchopen/silent-*`
     - 任务ID追踪系统
     - 代理池管理和健康监控
     - 阶段性进度报告（代理验证、获取、分发、执行）
   - **配置选项**:
     - 执行周期（1-1000次）
     - 访问模式（HTTP/Puppeteer）
     - 代理验证设置
   - **适用场景**: 中大规模、需要代理和高级功能的批量任务

3. **Automated 版本（自动化版）**
   - **定位**: 企业级自动化任务管理
   - **界面**: 任务调度和管理控制台
   - **特点**:
     - 定时任务执行
     - 智能点击量分配
     - 双引擎支持（SimpleHttp + Puppeteer）
     - 自动故障转移
     - 详细统计分析
   - **技术实现**:
     - 任务调度系统
     - 每日执行计划
     - 小时级执行详情
     - 时间窗口控制（如06:00-24:00）
   - **数据库模型**:
     - `AutoClickTask` - 主任务定义
     - `DailyExecutionPlan` - 每日计划
     - `HourlyExecutionDetail` - 小时级详情
   - **适用场景**: 长期、自动化、需要精确控制的企业级任务

**版本对比表**:

| 特性 | Basic 版本 | Silent 版本 | Automated 版本 |
|------|------------|-------------|----------------|
| **执行方式** | 浏览器标签页 | 后台静默 | 定时调度 |
| **代理管理** | 手动 | 自动轮换 | 智能分配 |
| **最大URL数** | 50 | 200 | 无限制 |
| **并发数** | 5 | 20 | 50 |
| **Token类型** | `basic_batch_open` | `silent_batch_open` | `autoclick` |
| **访问模式** | 仅基础 | HTTP + Puppeteer | HTTP + Puppeteer |
| **进度追踪** | 基础进度条 | 详细阶段报告 | 综合分析面板 |
| **适用套餐** | Free | Pro | Max |

**验收标准**:
- [ ] Free 用户可使用 Basic 模式（50 URL/任务，5并发）
- [ ] Pro 用户可使用 Silent 模式（200 URL/任务，20并发）
- [ ] Max 用户可使用 Automated 模式（无限制URL，50并发）
- [ ] 支持HTTP和Puppeteer两种访问模式选择（Silent/Automated版本）
- [ ] HTTP模式支持10倍于Puppeteer的并发量
- [ ] Basic版本保持现有浏览器标签页打开方式
- [ ] Silent版本支持代理自动轮换和验证
- [ ] Automated版本支持定时任务和智能调度
- [ ] 套餐升级后权限立即生效
- [ ] 超出限制时友好提示

**集成验证**:
- IV1: 权限控制准确无误
- IV2: 三个版本功能特性完整实现
- IV3: HTTP模式性能达到预期（10倍并发）
- IV4: Puppeteer模式功能完整
- IV5: 版本切换功能正常
- IV6: Token消费按版本类型准确计算

#### Story 5.2.3.1: HTTP访问模式高性能处理
**As a** BatchGo 用户,
**I want to** 使用HTTP模式进行大规模批量访问,
**so that** 我可以获得更高的并发性能和效率。

**验收标准**:
- [ ] HTTP模式支持轻量级请求
- [ ] 并发性能达到Puppeteer模式的10倍
- [ ] 支持自定义User-Agent和请求头
- [ ] 自动处理Cookies和Session保持
- [ ] 适合不需要JavaScript渲染的简单页面

**集成验证**:
- IV1: HTTP并发性能达标
- IV2: 请求功能完整
- IV3: 资源占用合理

#### Story 5.2.3.2: Puppeteer访问模式完整渲染
**As a** BatchGo 用户,
**I want to** 使用Puppeteer模式处理复杂页面,
**so that** 我可以正确访问需要JavaScript渲染的内容。

**验收标准**:
- [ ] Puppeteer模式支持完整浏览器环境
- [ ] 正确处理JavaScript动态内容
- [ ] 支持验证码和反爬虫机制
- [ ] 提供页面截图和调试功能
- [ ] 适合复杂网站和SPA应用

**集成验证**:
- IV1: 渲染功能正常
- IV2: 反爬机制有效
- IV3: 调试功能完整

#### Story 5.2.4: SiteRankGo 高效查询
**As a** 网站运营者,
**I want to** 快速查询和分析网站排名数据,
**so that** 我可以及时了解网站表现。

**验收标准**:
- [ ] 查询响应时间 < 500ms
- [ ] 支持批量域名查询
- [ ] 查询结果缓存机制
- [ ] 历史数据对比分析
- [ ] 导出报表功能

**集成验证**:
- IV1: 查询性能达标
- IV2: 数据准确可靠
- IV3: API 调用成本可控

#### Story 5.2.5: ChangeLinkGo 自动化管理
**As a** 广告优化师,
**I want to** 自动化管理 Google Ads 链接,
**so that** 我可以提高工作效率减少错误。

**验收标准**:
- [ ] 多 Google Ads 账户管理
- [ ] 复杂链接替换规则
- [ ] AdsPower 自动化执行
- [ ] 执行状态实时监控
- [ ] 失败自动回滚机制

**集成验证**:
- IV1: 自动化流程稳定
- IV2: Google Ads API 集成正常
- IV3: 错误处理机制有效

#### Story 5.2.6: 前端界面优化
**As a** 用户,
**I want to** 在保持熟悉布局的同时享受更好的视觉体验,
**so that** 我可以更高效地使用系统功能。

**验收标准**:
- [ ] 保持现有页面布局结构
- [ ] 优化视觉设计和交互
- [ ] 响应式设计支持移动端
- [ ] 实时数据展示优化
- [ ] 加载速度提升

**集成验证**:
- IV1: 用户操作习惯无需改变
- IV2: 视觉体验明显提升
- IV3: 页面性能优化

#### Story 5.2.7: 管理员仪表板
**As a** 系统管理员,
**I want to** 在GoFly后台查看系统的关键指标和趋势图,
**so that** 我可以了解系统运营状况。

**验收标准**:
- [ ] 查看天维度的注册用户数趋势
- [ ] 查看每日登录用户数统计
- [ ] 查看不同套餐的订阅数量
- [ ] 查看月度收入（基于年付折扣计算）
- [ ] 查看Token消耗量统计
- [ ] 查看API使用情况
- [ ] 支持日期时间段选择

**集成验证**:
- IV1: 数据统计准确无误
- IV2: 图表展示清晰
- IV3: 时间筛选功能正常

#### Story 5.2.8: 管理员用户管理
**As a** 系统管理员,
**I want to** 在GoFly后台管理所有用户信息,
**so that** 我可以控制用户访问和权限。

**验收标准**:
- [ ] 查看所有用户列表和档案信息
- [ ] 查看用户的订阅信息
- [ ] 禁用/启用用户账号
- [ ] 给用户充值Token
- [ ] 更改用户的订阅套餐
- [ ] 查看用户详细操作日志

**集成验证**:
- IV1: 用户管理功能完整
- IV2: 权限控制严格
- IV3: 操作日志完整

#### Story 5.2.9: 管理员角色管理
**As a** 系统管理员,
**I want to** 在GoFly后台管理用户角色,
**so that** 我可以控制系统的访问权限。

**验收标准**:
- [ ] 查看所有角色列表
- [ ] 区分普通用户和管理员角色
- [ ] 修改用户的角色分配
- [ ] 角色权限实时生效

**集成验证**:
- IV1: 角色管理功能正常
- IV2: 权限控制准确
- IV3: 角色切换即时生效

#### Story 5.2.10: 管理员套餐管理
**As a** 系统管理员,
**I want to** 在GoFly后台管理套餐配置,
**so that** 我可以灵活调整产品定价和功能。

**验收标准**:
- [ ] 查看所有套餐列表
- [ ] 修改套餐的功能权限
- [ ] 修改套餐的参数限制
- [ ] 调整套餐价格和包含Token数
- [ ] 套餐变更立即生效

**集成验证**:
- IV1: 套餐配置功能完整
- IV2: 前端定价页面同步更新
- IV3: 权限限制准确生效

#### Story 5.2.11: 用户注册和试用机制
**As a** 新用户,
**I want to** 注册后自动获得高级套餐试用,
**so that** 我可以体验完整功能。

**验收标准**:
- [ ] 邮箱注册成功后自动获得14天Pro套餐
- [ ] Google OAuth登录同样获得14天Pro套餐
- [ ] 通过邀请链接注册获得30天Pro套餐
- [ ] 邀请者成功邀请后获得30天Pro套餐
- [ ] 多次邀请奖励可累加
- [ ] 套餐到期自动降级到Free套餐
- [ ] 个人中心显示准确的套餐信息

**集成验证**:
- IV1: 注册流程正常
- IV2: 套餐分配准确
- IV3: 邀请机制有效

#### Story 5.2.12: Token管理系统
**As a** 系统管理员,
**I want to** 管理Token的消耗规则和使用分析,
**so that** 我可以控制资源使用和成本。

**验收标准**:
- [ ] 查看多维度的Token使用分析
- [ ] 修改不同功能的Token消耗规则
- [ ] 查看Token购买交易记录
- [ ] 查看API限速配置并支持热更新
- [ ] 初始规则：SiteRank查询1个域名消耗1 token
- [ ] 初始规则：BatchGo HTTP模式消耗1 token/URL
- [ ] 初始规则：BatchGo Puppeteer模式消耗2 token/URL

**集成验证**:
- IV1: Token统计准确
- IV2: 规则修改即时生效
- IV3: 热更新功能正常

#### Story 5.2.13: 通知管理系统
**As a** 系统管理员,
**I want to** 管理系统通知的发送,
**so that** 我可以及时告知用户重要信息。

**验收标准**:
- [ ] 配置通知模板
- [ ] 设置触发条件
- [ ] 配置发送方式（飞书webhook、应用内通知）
- [ ] 查看通知发送历史

**集成验证**:
- IV1: 通知模板配置灵活
- IV2: 发送机制可靠
- IV3: 飞书集成正常

#### Story 5.2.14: 用户个人中心
**As a** 普通用户,
**I want to** 在个人中心管理我的账户信息,
**so that** 我可以了解使用情况和获得奖励。

**验收标准**:
- [ ] 查看和编辑个人信息
- [ ] 查看订阅管理信息
- [ ] 查看Token消耗记录
- [ ] 每日签到功能（10/20/40/80 token递增）
- [ ] 查看邀请记录和奖励
- [ ] 配置飞书webhook地址
- [ ] 查看应用内消息通知
- [ ] 所有信息持久化存储并支持异步更新

**集成验证**:
- IV1: 个人中心功能完整
- IV2: 数据展示准确
- IV3: 签到奖励机制正常

#### Story 5.2.15: 定价页面
**As a** 潜在用户,
**I want to** 查看套餐信息、对比套餐以及购买Token,
**so that** 我可以选择适合的套餐或按需购买Token。

**验收标准**:
- [ ] 展示支持的套餐信息（Free/Pro/Max）
- [ ] 显示不同套餐的功能权限对比
- [ ] 显示参数限制对比
- [ ] 提供套餐FAQ信息
- [ ] 展示Token充值包选项和价格：
  - 小包: ¥99 = 10,000 tokens
  - 中包: ¥299 = 50,000 tokens (约 40% off)
  - 大包: ¥599 = 200,000 tokens (约 67% off)
  - 超大包: ¥999 = 500,000 tokens (约 80% off)
- [ ] 套餐"立即订阅"按钮弹出咨询窗口
- [ ] Token购买"立即订阅"按钮弹出咨询窗口
- [ ] 套餐和Token信息与后台配置保持一致

**集成验证**:
- IV1: 套餐信息同步准确
- IV2: Token价格显示正确
- IV3: 对比表格清晰
- IV4: 咨询功能正常（套餐和Token）

#### Story 5.2.16: 支付记录管理
**As a** 系统管理员,
**I want to** 查看所有支付记录,
**so that** 我可以跟踪收入情况。

**验收标准**:
- [ ] 查看订阅支付记录
- [ ] 查看Token购买记录
- [ ] 按时间筛选记录
- [ ] 导出支付报表

**集成验证**:
- IV1: 支付记录完整
- IV2: 金额计算准确
- IV3: 筛选功能正常

#### Story 5.2.17: API监控统计
**As a** 系统管理员,
**I want to** 监控API的使用情况,
**so that** 我可以了解系统负载。

**验收标准**:
- [ ] 查看所有API列表
- [ ] 显示AI功能说明
- [ ] 统计每日API访问次数
- [ ] 监控响应耗时
- [ ] 计算成功率
- [ ] 异常告警

**集成验证**:
- IV1: API统计准确
- IV2: 性能监控实时
- IV3: 告警机制有效

#### Story 5.2.18: 签到系统
**As a** 普通用户,
**I want to** 每日签到获得Token奖励,
**so that** 我可以获得更多使用额度。

**验收标准**:
- [ ] 个人中心显示签到模块
- [ ] 连续签到奖励递增（10/20/40/80）
- [ ] 中断后重新从10开始
- [ ] 管理员可查看所有签到记录
- [ ] 签到记录表格展现

**集成验证**:
- IV1: 签到功能正常
- IV2: 奖励计算准确
- IV3: 连续天数判断正确

#### Story 5.2.19: 邀请系统
**As a** 普通用户,
**I want to** 邀请好友获得奖励,
**so that** 我可以通过分享获得更多权益。

**验收标准**:
- [ ] 个人中心显示邀请好友模块
- [ ] 生成独一无二的邀请链接
- [ ] 查看历史邀请记录
- [ ] 查看获得的奖励
- [ ] 管理员可查看所有邀请记录
- [ ] 成功邀请双方各得30天Pro套餐

**集成验证**:
- IV1: 邀请链接生成正确
- IV2: 奖励发放准确
- IV3: 邀请记录完整

## 6. 系统架构优化

### 6.1 消息队列架构评估

#### 6.1.1 技术选型分析

**评估结论：使用Redis Pub/Sub，无需Kafka**

基于系统需求和复杂度分析，选择Redis Pub/Sub作为消息队列解决方案：

**系统特征分析**：
- **消息量级**: 峰值100-200条/秒，日均5-10万条
- **实时性要求**: 亚秒级延迟
- **持久化需求**: 低（关键状态存在数据库）
- **消费模式**: 单消费者模式，无需复杂的消费者组

**Redis Pub/Sub优势**：
1. **技术栈统一**: 已使用Redis做缓存和会话管理
2. **集成成本低**: GoFly框架原生支持Redis Pub/Sub
3. **运维简单**: 无需额外基础设施
4. **性能满足**: 轻松处理当前消息量级
5. **开发效率**: 2-3周即可完成集成

#### 6.1.2 消息主题设计

```yaml
# 任务管理主题
batch:task:created      # BatchGo任务创建
batch:task:updated      # BatchGo任务进度更新
batch:task:completed    # BatchGo任务完成

# SiteRankGo主题
siterank:query:started    # 查询开始
siterank:query:completed  # 查询完成
siterank:cache:invalidated # 缓存失效

# ChangeLinkGo主题
changelink:task:started   # 链接更新开始
changelink:task:updated   # 链接更新进度
changelink:task:completed # 链接更新完成

# 用户通知主题
user:notification         # 用户通知
token:balance:updated     # Token余额更新

# 系统事件主题
system:health            # 系统健康状态
system:metrics           # 系统指标
```

#### 6.1.3 实现架构

```go
// 消息结构
type Message struct {
    ID        string                 `json:"id"`
    Type      string                 `json:"type"`
    Timestamp int64                  `json:"timestamp"`
    UserID    int64                  `json:"user_id,omitempty"`
    Data      map[string]interface{} `json:"data"`
    Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// 消息代理接口
type MessageBroker interface {
    Publish(ctx context.Context, topic string, message interface{}) error
    Subscribe(ctx context.Context, topic string, handler func(message interface{})) error
}

// Redis实现（使用GoFly封装）
type RedisBroker struct {
    redis *gredis.Redis
}
```

#### 6.1.4 性能优化策略

1. **连接池管理**: 复用Redis连接，避免频繁创建
2. **消息批处理**: 小消息合并发送，减少网络开销
3. **降级机制**: Pub/Sub不可用时自动降级为HTTP轮询
4. **消息去重**: 处理网络重试导致的重复消息

### 6.2 角色权限系统简化

#### 6.2.1 角色体系重构

**简化为两级角色体系**：

```yaml
USER (普通用户):
  - 基础功能访问权限
  - 个人数据查看权限
  - 根据套餐获得不同功能权限
  
ADMIN (管理员):
  - 所有业务模块管理权限
  - 用户管理权限
  - 系统配置权限
  - 数据查看和分析权限
```

**移除的角色**：
- SUPER_ADMIN: 功能合并到ADMIN
- MANAGER: 功能下放到ADMIN或通过套餐权限控制

#### 6.2.2 权限控制机制

**基于套餐的功能权限**：
```yaml
Free套餐:
  - BatchGo Basic: 100个URL/任务，串行执行
  - SiteRankGo: 100个域名/次
  - ChangeLinkGo: 不支持
  
Pro套餐:
  - BatchGo Silent: 1,000个URL/任务，5并发
  - SiteRankGo: 500个域名/次
  - ChangeLinkGo: 10个Google Ads账户
  
Max套餐:
  - BatchGo Automated: 5,000个URL/任务，50并发
  - SiteRankGo: 5,000个域名/次
  - ChangeLinkGo: 100个Google Ads账户
```

**管理员权限细分**：
```yaml
管理员权限模块:
  - 用户管理: 查看、编辑、禁用用户
  - 订单管理: 查看支付记录，手动调整套餐
  - 系统监控: 查看系统状态、性能指标
  - 任务管理: 查看所有用户任务，可干预执行
  - 配置管理: 系统参数、API密钥配置
```

### 6.3 API限流与安全机制

#### 6.3.1 多层限流策略

**1. 网关层限流（GoFly）**
```go
// 令牌桶算法实现
type RateLimiter struct {
    tokens      int64
    capacity    int64
    refillRate  int64 // tokens/second
    lastRefill  int64
    mu          sync.Mutex
}

// 不同端点的限流配置
rateLimitRules = map[string]RateLimitConfig{
    "/api/v1/auth/login":     {capacity: 10, refillRate: 1},    // 10请求/分钟
    "/api/v1/batchgo/tasks":  {capacity: 100, refillRate: 10},   // 100请求/分钟
    "/api/v1/siterank/query": {capacity: 50, refillRate: 5},     // 50请求/分钟
    "/admin/*":               {capacity: 1000, refillRate: 100}, // 管理员更高限制
}
```

**2. 用户级限流**
```yaml
# 基于套餐的限流
Free:
  - API调用: 100次/小时
  - 并发任务: 1个
  
Pro:
  - API调用: 1000次/小时
  - 并发任务: 5个
  
Max:
  - API调用: 10000次/小时
  - 并发任务: 50个
```

**3. IP级限流**
```yaml
# 防止恶意请求
- 单IP: 1000请求/小时
- 异常IP自动封禁: 5分钟内失败100次
- CDN防护: 集成Cloudflare或类似服务
```

#### 6.3.2 安全机制设计

**1. 认证机制**
```go
// JWT Token结构
type Claims struct {
    UserID      string `json:"user_id"`
    Email       string `json:"email"`
    Role        string `json:"role"`
    Package     string `json:"package"`
    Permissions []string `json:"permissions"`
    Exp         int64  `json:"exp"`
    Iat         int64  `json:"iat"`
}

// Token刷新机制
func RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
    // 验证refresh token
    // 生成新的access token
    // 撤销旧token
}
```

**2. 权限验证中间件**
```go
func AuthMiddleware(permissions ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractToken(c)
        claims, err := validateToken(token)
        if err != nil {
            c.JSON(401, gin.H{"error": "无效的访问令牌"})
            c.Abort()
            return
        }
        
        // 检查权限
        for _, perm := range permissions {
            if !hasPermission(claims.Permissions, perm) {
                c.JSON(403, gin.H{"error": "权限不足"})
                c.Abort()
                return
            }
        }
        
        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        c.Set("user_package", claims.Package)
        c.Next()
    }
}
```

**3. 数据安全**
```yaml
# 数据传输安全
- HTTPS强制: 所有API必须使用HTTPS
- 敏感数据加密: 用户密码、API密钥等加密存储
- 请求签名: 重要操作需要签名验证

# 数据存储安全
- 数据库加密: 敏感字段加密存储
- 访问控制: 基于角色的数据访问
- 审计日志: 记录所有敏感操作
```

**4. 防攻击措施**
```yaml
# SQL注入防护
- 使用参数化查询
- ORM自动转义
- 输入验证和过滤

# XSS防护
- 输出转义
- CSP头部设置
- 输入内容过滤

# CSRF防护
- SameSite Cookie
- CSRF Token验证
- Origin头部验证

# 速率限制
- 登录失败限制: 5次/分钟
- 短信发送限制: 10次/小时
- 邮件发送限制: 50次/小时
```

#### 6.3.3 监控和告警

**1. 安全事件监控**
```yaml
监控指标:
  - 异常登录: 多地区、短时间多次登录
  - API异常: 大量403、404、500错误
  - 资源异常: 突然的Token消耗激增
  - 任务异常: 大量任务失败
  
告警规则:
  - 5分钟内登录失败超过100次
  - 单用户API调用超过套餐限制200%
  - 系统错误率超过5%
  - 单IP请求超过阈值
```

**2. 性能监控**
```yaml
# API性能指标
- 响应时间: P95 < 200ms
- 错误率: < 1%
- 吞吐量: 峰值1000 QPS
- 可用性: > 99.9%

# 系统资源监控
- CPU使用率: < 80%
- 内存使用率: < 85%
- 磁盘使用率: < 80%
- 数据库连接: < 最大连接数80%
```

### 6.4 GoFly集成架构

基于对现有PRD、GoFly框架和代码库的深入分析，发现以下关键集成缺失：

#### 6.4.1 GoFly框架能力映射
GoFly V3框架提供以下核心能力：
- **RBAC权限系统**：基于角色的访问控制
- **动态菜单管理**：可配置的菜单结构
- **数据字典**：统一的数据管理
- **操作日志**：完整的审计追踪
- **代码生成器**：快速CRUD生成
- **API管理**：RESTful API框架
- **文件管理**：统一的文件存储
- **系统配置**：全局配置管理

#### 6.4.2 当前集成缺失

1. **业务模块管理界面缺失**
   - 缺少BatchGo任务管理界面
   - 缺少SiteRankGo查询管理界面
   - 缺少ChangeLinkGo账户管理界面
   - 缺少模块配置和参数管理

2. **权限系统集成不完整**
   - 业务模块权限未与GoFly RBAC集成
   - 缺少细粒度的功能权限控制
   - 套餐权限与系统权限未统一

3. **数据同步机制缺失**
   - 前端与GoFly后端缺少实时数据同步
   - 任务状态更新机制不明确
   - 缺少WebSocket通信设计

### 6.5 详细集成方案

#### 6.5.1 业务模块管理

**BatchGo模块管理**
```yaml
管理功能:
  - 任务创建与配置
    * URL列表管理
    * 执行模式选择（HTTP/Puppeteer）
    * 代理配置
    * 并发设置
    * 定时任务设置
  
  - 任务监控
    * 实时执行状态
    * 成功率统计
    * 错误日志查看
    * 性能分析
  
  - 历史记录
    * 任务执行历史
    * 结果导出
    * 统计报表
  
  - 配置管理
    * 代理池管理
    * User-Agent配置
    * 请求头模板
    * 超时设置
```

**SiteRankGo模块管理**
```yaml
管理功能:
  - 查询任务管理
    * 批量域名查询
    * 查询调度
    * 结果缓存
  
  - 数据管理
    * 历史查询记录
    * 趋势分析
    * 数据导出
  
  - API配置
    * SimilarWeb API密钥管理
    * 请求频率限制
    * 错误重试策略
```

**ChangeLinkGo模块管理**
```yaml
管理功能:
  - 账户管理
    * Google Ads账户连接
    * 账户权限验证
    * 账户状态监控
  
  - 链接管理
    * 链接批量更新
    * 更新历史记录
    * 失败重试机制
  
  - 监控告警
    * 链接状态异常告警
    * API配额使用监控
```

#### 6.5.2 前端交互集成

**实时通信机制**
```typescript
// WebSocket连接配置
const wsConfig = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8200/ws',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
};

// 事件订阅
const eventSubscriptions = {
  // BatchGo事件
  'batchgo:task_created': handleTaskCreated,
  'batchgo:task_updated': handleTaskUpdated,
  'batchgo:task_completed': handleTaskCompleted,
  
  // SiteRankGo事件
  'siterank:query_started': handleQueryStarted,
  'siterank:query_completed': handleQueryCompleted,
  
  // ChangeLinkGo事件
  'changelink:account_connected': handleAccountConnected,
  'changelink:link_updated': handleLinkUpdated,
  
  // 系统事件
  'system:notification': handleSystemNotification,
  'user:token_updated': handleTokenUpdated,
};
```

**API集成层**
```typescript
// API客户端配置
const apiClient = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8200',
  
  // 业务模块API
  batchgo: {
    createTask: '/api/v1/batchgo/tasks',
    getTasks: '/api/v1/batchgo/tasks',
    getTaskStatus: '/api/v1/batchgo/tasks/:id/status',
    cancelTask: '/api/v1/batchgo/tasks/:id/cancel',
  },
  
  siterank: {
    createQuery: '/api/v1/siterank/queries',
    getResults: '/api/v1/siterank/results',
    exportData: '/api/v1/siterank/export',
  },
  
  changelink: {
    connectAccount: '/api/v1/changelink/accounts/connect',
    updateLinks: '/api/v1/changelink/links/update',
    getAccounts: '/api/v1/changelink/accounts',
  },
  
  // GoFly集成API
  admin: {
    getUsers: '/admin/v1/users',
    getRoles: '/admin/v1/roles',
    getPermissions: '/admin/v1/permissions',
    getSystemConfig: '/admin/v1/config',
  },
};
```

#### 6.5.3 权限系统集成

**简化后的权限映射**
```yaml
系统角色（仅两级）:
  USER (普通用户):
    - 基础功能访问权限
    - 个人数据查看权限
    - 根据套餐获得不同功能权限
  
  ADMIN (管理员):
    - 所有业务模块管理权限
    - 用户管理权限
    - 系统配置权限
    - 数据查看和分析权限

套餐功能权限:
  Free套餐:
    - BatchGo Basic: 100个URL/任务，前端标签页打开（无循环次数）
    - BatchGo Silent: 100个URL/任务，1并发（支持循环次数，HTTP+Puppeteer）
    - SiteRankGo: 100个域名/次
    - ChangeLinkGo: 不支持
  
  Pro套餐:
    - BatchGo Basic: 100个URL/任务，前端标签页打开（无循环次数）
    - BatchGo Silent: 1,000个URL/任务，5并发（支持循环次数，HTTP+Puppeteer）
    - BatchGo Automated: 1,000个URL/任务，5并发（基于自动化规则，HTTP+Puppeteer）
    - SiteRankGo: 500个域名/次
    - ChangeLinkGo: 10个Google Ads账户
  
  Max套餐:
    - BatchGo Basic: 100个URL/任务，前端标签页打开（无循环次数）
    - BatchGo Silent: 5,000个URL/任务，50并发（支持循环次数，HTTP+Puppeteer）
    - BatchGo Automated: 5,000个URL/任务，50并发（基于自动化规则，HTTP+Puppeteer）
    - SiteRankGo: 5,000个域名/次
    - ChangeLinkGo: 100个Google Ads账户
```

#### 6.5.4 数据流设计

**请求流程**
```
前端请求 → Next.js API路由 → GoFly后端 → 业务模块 → 数据库
     ↓                    ↓           ↓            ↓
  权限验证 → 路由分发 → 业务逻辑 → 数据处理 → 返回结果
```

**实时数据流**
```
GoFly后端 → WebSocket → 前端组件
     ↓            ↓          ↓
  事件发布 → 消息队列 → 状态更新
```

### 6.6 实施计划

#### 6.6.1 第一阶段：基础集成
1. **GoFly后端部署**
   - 配置数据库连接
   - 初始化系统数据
   - 创建基础权限结构

2. **API网关开发**
   - 实现统一入口
   - 配置路由转发
   - 实现认证中间件

3. **基础管理界面**
   - 用户管理界面
   - 角色权限管理
   - 系统配置界面

#### 6.6.2 第二阶段：业务集成
1. **BatchGo集成**
   - 开发任务管理API
   - 实现实时监控
   - 创建管理界面

2. **SiteRankGo集成**
   - 集成查询管理
   - 实现结果缓存
   - 开发数据导出

3. **ChangeLinkGo集成**
   - 账户管理集成
   - 链接更新功能
   - 监控告警系统

#### 6.6.3 第三阶段：优化完善
1. **性能优化**
   - 缓存策略优化
   - 数据库查询优化
   - 并发处理优化

2. **用户体验优化**
   - 界面交互优化
   - 响应速度优化
   - 错误处理优化

3. **监控运维**
   - 系统监控集成
   - 日志分析系统
   - 告警机制完善

## 7. 变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2025-01-09 | 初始 PRD 创建 | 产品团队 |
| v2.0 | 2025-01-09 | 集成 GoFly 框架，完善技术架构 | 产品团队 |
| v3.0 | 2025-01-09 | 优化为简化版多用户系统，移除租户管理，细化BatchGo权限 | 产品团队 |
| v4.0 | 2025-01-09 | 更新为使用新数据库无需迁移，添加HTTP/Puppeteer双模式支持 | 产品团队 |
| v5.0 | 2025-01-09 | 添加完整的用户运营功能：Token系统、签到、邀请、试用套餐、个人中心、管理员仪表板等 | 产品团队 |
| v6.0 | 2025-01-09 | 移除Stripe支付集成，更新Token充值价格为¥150/10,000起，确认套餐配置信息 | 产品团队 |
| v7.0 | 2025-01-10 | 优化前端访问策略：支持免登录浏览，功能按钮强制登录；细化BatchGo权限矩阵；更新微服务部署流程 | 产品团队 |
| v8.0 | 2025-01-10 | 完善需求描述，解决不一致问题：明确使用MySQL数据库；统一Token系统架构；细化BatchGo模式选择逻辑；明确手动充值模式；选择性集成GoFly框架 | 产品团队 |
| v9.0 | 2025-01-10 | 完善技术实现细节：添加外部API Key管理策略；完善监控和告警系统；明确所有 ambiguities；添加性能指标和部署流程 | 产品团队 |
| v10.0 | 2025-01-10 | 优化BatchGo版本描述：详细说明三种版本（Basic/Silent/Automated）的功能特性和技术实现；修正邀请奖励规则（通过邀请链接注册只获得30天Pro） | 产品团队 |
| v11.0 | 2025-01-10 | 进一步优化PRD：合并飞书Webhook到消息通知中心；定价页面增加Token购买选项；添加现有业务逻辑保护章节，确保重构不破坏核心功能 | 产品团队 |
| v12.0 | 2025-01-10 | 更新Token充值价格：小包¥99=10,000 tokens，提高大包折扣力度（中包40% off，大包67% off，超大包80% off） | 产品团队 |
| v13.0 | 2025-01-10 | 全面补充GoFly集成架构：添加业务模块管理界面、前端交互集成、权限系统集成、数据流设计和详细实施计划 | 产品团队 |
| v14.0 | 2025-01-10 | 优化系统架构：评估并选择Redis Pub/Sub替代Kafka；简化角色系统为USER和ADMIN两级；设计完整的API限流和安全机制 | 产品团队 |
| v15.0 | 2025-01-10 | 进一步简化架构：从微服务改为单体应用+模块化设计；修正Basic版本权限描述（仅支持Puppeteer模式）；优化部署流程 | 产品团队 |
| v24.0 | 2025-01-10 | 全面修正架构描述：将所有"微服务架构"更新为"单体应用+模块化设计"；确保文档一致性；修正技术风险和部署流程描述 | 产品团队 |

## 8. 附录

### 8.1 术语表
- **SaaS**: Software as a Service，软件即服务
- **RBAC**: Role-Based Access Control，基于角色的访问控制
- **OAuth2**: 开放授权标准
- **JWT**: JSON Web Token
- **CRUD**: Create, Read, Update, Delete
- **Token**: 系统内使用的虚拟货币，用于功能消费
- **Pro套餐**: 高级付费套餐，¥298/月（年付50%优惠）
- **Max套餐**: 白金付费套餐，¥998/月（年付50%优惠）
- **HTTP模式**: BatchGo的轻量级访问模式，高性能
- **Puppeteer模式**: BatchGo的完整浏览器模拟模式
- **签到**: 每日登录获得Token奖励的机制
- **邀请机制**: 用户邀请好友注册获得奖励的机制

### 8.2 参考资料
- GoFly Admin V3 文档
- AutoAds 现有系统架构文档
- 模块化架构设计模式
- 多用户 SaaS 架构最佳实践

