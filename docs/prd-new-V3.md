# AutoAds 多用户 SaaS 系统重构 PRD V3.0

## 文档信息
- **项目名称**: AutoAds 多用户 SaaS 系统
- **版本**: v35.0
- **创建日期**: 2025-01-09
- **最后更新**: 2025-09-13
- **负责人**: 产品团队
- **优化说明**: 
  - V33.0：系统性优化，修复编号混乱、术语不一致、数据库DDL错误等问题
  - V34.0：新增 GoFly Admin V3 框架集成方案，包含详细的架构集成、模块设计、配置适配和迁移步骤
  - V35.0：完整性审查，确保涵盖原PRD所有核心内容，包括完整的业务需求、技术架构、实施计划和验收标准

## 执行摘要

AutoAds 正在从 Next.js 单体应用重构为基于 GoFly 框架的多用户 SaaS 系统。当前系统已实现完整的用户认证、权限管理和三大核心功能，包括：✅ BatchOpen（批量访问，已实现三种模式）、✅ SiteRank（网站排名，已集成真实SimilarWeb API）、❌ ChangeLink（链接管理，仅有UI原型）。重构目标是将现有功能（BatchOpen→BatchGo、SiteRank→SiteRankGo、ChangeLink→AdsCenterGo）迁移至 Go 语言 + GoFly 架构，实现4900%性能提升和专业的后台管理系统。

## 1. 项目概述

### 1.1 现有项目分析

#### 分析来源
基于代码库深度分析（2025-09-10）

#### 当前项目状态
AutoAds 是一个基于 Next.js 的自动化营销平台，三大核心功能实现状态：
- **✅ BatchOpen（批量访问）**: 完整实现三种执行模式（Basic/Silent/Automated）
- **✅ SiteRank（网站排名）**: 完整实现，已集成真实SimilarWeb API，支持批量查询和缓存
- **❌ ChangeLink（链接管理）**: 仅有UI界面，无后端API实现

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
- [ ] ChangeLink功能（仅UI，无后端）

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
  - ChangeLink：链接管理功能

- **重构版本（Go实现）**:
  - BatchGo：BatchOpen的Go重构版本
  - SiteRankGo：SiteRank的Go重构版本
  - AdsCenterGo：ChangeLink的Go重构版本

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
  - 新用户通过邀请链接注册：获得30天Pro套餐（不与基础新用户14天奖励叠加）
  - 多次邀请奖励可累加，但最长不超过365天
  - 试用期从激活开始计算，不可暂停
- **FR3.10**: 套餐配置后台管理功能

#### FR4: BatchGo 模块（支持HTTP和Puppeteer访问模式）
- **FR4.1**: 完整迁移三种执行模式（Basic/Silent/Automated）到Go语言架构
- **FR4.2**: 基于 Go 实现高并发任务处理，支持万级任务规模
- **FR4.3**: **HTTP访问模式**（重构目标）：
  - 轻量级HTTP请求库实现
  - 高性能并发处理（支持10倍Puppeteer并发量）
  - 支持自定义User-Agent和请求头
  - 自动处理Cookies和Session
  - 适合大规模批量访问任务

- **FR4.4**: **Puppeteer访问模式**（重构目标）：
  - 完整的浏览器环境模拟
  - 支持JavaScript渲染和动态内容
  - 自动处理验证码和反爬机制
  - 支持截图和页面调试
  - 适合需要真实浏览器环境的任务

- **FR4.5**: **当前实现状态**：
  - Basic版本：前端window.open实现，直接在用户浏览器打开新标签页
  - Silent版本：后端Chromium实现，支持HTTP和Puppeteer两种方式
  - Automated版本：基于Silent的自动化点击，支持复杂交互
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
  - Basic版本：不提供模式选择（使用前端window.open打开新标签页）
  - Silent/Automated版本：创建任务时提供HTTP/Puppeteer模式选择选项
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

- **FR4.10.4**: **代理配置要求**：
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

- **FR4.10.5**: **URL访问轮转机制**：
  - **每个代理IP完成一轮URL访问**：系统必须确保每个代理IP按顺序完成所有URL的访问后，才切换到下一个代理IP
  - **轮转策略**：
    - 代理IP队列管理（FIFO先进先出）
    - 每个代理IP访问完所有URL后标记为已完成
    - 自动切换到下一个可用代理IP
    - 支持代理IP重用和循环使用
  - **容错机制**：
    - 代理IP失败时自动跳过并记录
    - 支持失败URL的重试机制
    - 实时监控代理IP成功率和响应时间

- **FR4.10.6**: **智能模式建议**：
  - 系统根据URL特征自动推荐合适的模式
  - 提供模式切换的性能预估（时间、资源消耗）
  - 支持任务执行过程中动态调整模式

#### FR5: SiteRankGo 模块
- **FR5.1**: SimilarWeb API 集成和优化
- **FR5.2**: 批量查询性能提升（支持万级域名）
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
- **FR7.2**: 支持免登录访问网站页面（无需模糊预览）
- **FR7.3**: 功能按钮点击时强制引导登录：
  - SiteRank的"开始分析"按钮
  - BatchOpen的"代理认证"、"批量打开"、"新增任务"按钮
  - AdsCenterGo的"立即使用"按钮
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
- **FR10.12.1**: **当前采用手动咨询模式**：
  - **套餐订阅**：用户点击"立即订阅"按钮弹出咨询窗口，添加微信好友，通过与管理员沟通后手动开通
  - **Token充值**：用户点击Token充值包的"立即订阅"按钮弹出咨询窗口，添加微信好友，管理员审核后手动充值
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
- **FR10.9**: API 监控统计
- **FR10.10**: 签到记录管理
- **FR10.11**: 邀请记录管理

#### FR11: GoFly 管理后台集成
- **FR11.1**: 选择性集成 GoFly Admin V3 核心模块：
  - **原因**: GoFly Admin V3 提供成熟的企业级管理后台框架，包含完整的用户管理、权限控制、系统配置等功能，可以大幅减少开发工作量
  - **集成模块**：
    - 用户管理模块（支持批量操作、状态管理）
    - RBAC权限系统（细粒度权限控制）
    - 系统配置管理（动态配置更新）
    - 操作日志审计（完整的操作追踪）
    - 数据可视化组件（图表展示）
- **FR11.2**: 自定义开发业务特定功能，避免GoFly过度耦合：
  - BatchGo任务管理界面
  - SiteRankGo查询历史管理
  - AdsCenterGo执行监控
  - Token消费统计分析
- **FR11.3**: 系统日志和操作审计
- **FR11.4**: 数据可视化和报表系统
- **FR11.5**: 系统配置和参数管理

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
- **NFR5.3**: 自动化测试和 CI/CD 流程
- **NFR5.4**: 完善的监控和告警系统

### 3.3 兼容性需求（Compatibility Requirements）

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

### 3.4 用户套餐权限矩阵

#### 套餐配置详情

**免费套餐（Free）**:
- "批量访问"功能，包括"初级版本"（Basic，前端标签页打开）和"静默版本"（Silent，支持HTTP和Puppeteer模式）
- "网站排名"功能，批量查询域名上限 100 个/次
- 包含 1,000 tokens

**高级套餐（Pro）**:
- ¥298/月（年付优惠 50%）
- 支持所有免费套餐的功能
- "批量访问"功能，新增"自动化版本"（Automated，支持HTTP和Puppeteer模式）
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
| **HTTP模式并发倍数** | - | 10x | 10x |
| **SiteRankGo 查询限制** | 100/次 | 500/次 | 5,000/次 |
| **SiteRankGo 查询频率** | 无限制 | 无限制 | 无限制 |
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

#### 4.1.1 架构模式
采用**Go单体应用+模块化设计**，全新架构实现：
- **前端层**: Next.js 14 + TypeScript（保持现有前端）
- **后端层**: GoFly Admin V3 框架作为唯一后端服务
- **数据层**: 全新 MySQL 数据库（使用 MustKnow.md 配置）
- **缓存层**: Redis（缓存和会话存储）
- **ORM层**: 统一使用 GoFly gform

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

#### 4.1.5 GoFly 框架集成方案

基于对 GoFly Admin V3 框架的深入分析，设计以下集成方案：

**1. 框架架构理解**

GoFly Admin V3 是一个基于 Gin 框架的企业级后台管理系统，核心特性：
- **自动路由系统**：基于命名约定自动生成路由
- **RBAC权限系统**：三级权限控制（模块→角色→操作）
- **自研ORM (gform)**：Active Record模式，支持软删除、缓存等
- **中间件栈**：JWT认证、限流、CORS等
- **模块化设计**：admin（管理端）和business（业务端）分离

**2. 集成策略**

**为什么应该深度集成 GoFly Admin？**

基于对 GoFly Admin V3 的深入分析，我们发现它远不止是一个简单的管理后台，而是一个完整的企业级应用框架：

1. **企业级核心能力**
   - **多租户架构**：原生支持数据隔离和权限控制
   - **动态配置系统**：运行时修改配置，无需重启
   - **代码生成器**：一键生成前后端 CRUD 代码
   - **任务调度系统**：高性能定时任务和异步处理
   - **插件化架构**：支持功能模块的热插拔

2. **完整的业务支撑**
   - **数据中心**：统一的数据管理和导出
   - **字典管理**：系统枚举值统一管理
   - **附件管理**：文件上传和存储
   - **操作日志**：完整的审计追踪
   - **API 限流**：精细化的访问控制

3. **技术架构优势**
   - **自研 ORM (gform)**：支持软删除、缓存、事务
   - **多层缓存**：内存 + Redis 双级缓存
   - **连接池管理**：数据库和 Redis 连接池优化
   - **RBAC 权限**：菜单权限 + 数据权限 + 按钮权限

**2.1 深度集成架构设计**

```go
// 完整的 GoFly + AutoAds 架构
app/
├── admin/                    // GoFly 管理后台（完整使用）
│   ├── system/              // 系统管理模块
│   │   ├── account.go       // 用户管理（扩展支持 OAuth）
│   │   ├── role.go          // 角色权限（扩展套餐权限）
│   │   ├── rule.go          // 菜单管理（集成 AutoAds 菜单）
│   │   ├── log.go           // 操作日志（扩展业务日志）
│   │   └── config.go        // 系统配置（集成业务配置）
│   ├── datacenter/          // 数据中心模块
│   │   ├── configuration.go // 配置管理（集成业务配置）
│   │   ├── dictionary.go    // 字典管理（集成业务字典）
│   │   └── tabledata.go     // 数据导出（集成业务数据）
│   ├── matter/              // 资源管理
│   │   └── attachment.go    // 附件管理（支持任务截图等）
│   └── createcode/          // 代码生成器
│       └── product.go       // 扩展业务代码生成
│
├── business/                // GoFly 业务后台（改造为 AutoAds API）
│   ├── user/               // 用户业务模块
│   │   ├── account.go      // 扩展 OAuth 认证
│   │   └── setting.go      // 用户设置
│   └── dashboard/          // 仪表板（改造为业务统计）
│
└── autoads/                 // AutoAds 核心业务模块（新增）
    ├── common/             // 通用功能
    │   ├── middleware.go   // 业务中间件
    │   └── scheduler.go    // 任务调度器
    ├── batchgo/           // BatchGo 功能
    ├── siterankgo/        // SiteRankGo 功能
    ├── adscentergo/       // AdsCenterGo 功能
    └── integration/       // 集成模块
        ├── similarweb.go  // SimilarWeb 集成
        ├── googleads.go   // Google Ads 集成
        └── adspower.go    // AdsPower 集成
```

**2.2 模块职责重新定义**

- **GoFly Admin**: 企业级管理平台（不只是后台）
  - 用户管理：支持普通用户 + 管理员
  - 权限管理：RBAC + 套餐权限 + 数据权限
  - 系统配置：业务配置 + 系统配置
  - 数据中心：业务数据统一管理

- **GoFly Business**: 改造为业务 API 层
  - 提供标准的 RESTful API
  - 继承 GoFly 的认证和权限
  - 支持多租户数据隔离

- **AutoAds**: 核心业务逻辑层
  - 三大核心功能的具体实现
  - 第三方服务集成
  - 异步任务处理

**3. 深度集成实现方案**

**3.1 扩展 GoFly 用户系统**

```go
// 扩展 admin_account 表，支持 OAuth
type User struct {
    gform.Model `table:"admin_account"`
    ID          int64  `json:"id"`
    Username    string `json:"username"`
    Email       string `json:"email"`
    OAuthType   string `json:"oauth_type"`   // google, email
    OAuthID     string `json:"oauth_id"`     // OAuth 用户唯一标识
    Role        string `json:"role"`         // USER, ADMIN
    PlanID      string `json:"plan_id"`      // 套餐ID
    // ... 其他字段
}

// 扩展登录功能，支持 Google OAuth
func (api *Account) GoogleLogin(c *gf.GinCtx) {
    code := c.Post("code")
    
    // 1. 通过 code 获取 Google 用户信息
    userInfo, err := google.GetUserInfo(code)
    if err != nil {
        gf.Failed().SetMsg("OAuth 认证失败").Regin(c)
        return
    }
    
    // 2. 查找或创建用户
    user, err := findOrCreateOAuthUser(userInfo)
    if err != nil {
        gf.Failed().SetMsg("用户创建失败").Regin(c)
        return
    }
    
    // 3. 生成 JWT Token
    token, _ := routeuse.GenerateToken(&routeuse.UserClaims{
        ID:        user.ID,
        AccountID: user.ID,
        BusinessID: 0,
        StandardClaims: jwt.StandardClaims{
            ExpiresAt: time.Now().Add(120 * time.Minute).Unix(),
        },
    })
    
    // 4. 返回用户信息和 Token
    gf.Success().SetData(gf.Map{
        "token": token,
        "user":  user,
    }).Regin(c)
}
```

**3.2 利用 GoFly 代码生成器**

```go
// 为 AutoAds 业务表生成管理界面
func GenerateAutoAdsCRUD() {
    // 1. 定义业务表结构
    tables := []string{
        "batchgo_tasks",
        "siterankgo_queries", 
        "adscentergo_accounts",
        "token_transactions",
    }
    
    // 2. 使用 GoFly 代码生成器
    for _, table := range tables {
        // 生成后端代码
        generateController(table)
        generateModel(table)
        
        // 生成前端 Vue 组件
        generateVueComponent(table)
        
        // 生成 API 接口
        generateAPI(table)
    }
}
```

**3.3 集成动态配置系统**

```yaml
# 扩展 config.yaml，添加 AutoAds 业务配置
autoads:
  # BatchGo 配置
  batchgo:
    max_concurrent: 50        # 最大并发数
    proxy_timeout: 30         # 代理超时时间
    retry_count: 3            # 重试次数
    
  # SiteRankGo 配置
  siterankgo:
    cache_expire: 86400       # 缓存过期时间（秒）
    
  # Token 配置
  token:
    consume_rules:
      batchgo_basic: 1        # Basic 模式消耗
      batchgo_silent: 2       # Silent 模式消耗
      batchgo_auto: 5         # Auto 模式消耗
      siterankgo_query: 1     # 查询消耗
```

**3.4 利用任务调度系统**

```go
// 使用 GoFly 定时任务处理异步任务
package scheduler

import "gofly/utils/tools/gtimer"

// 初始化定时任务
func InitScheduler() {
    // 每小时清理过期 Token
    gtimer.AddSingleton(context.Background(), time.Hour, cleanExpiredTokens)
    
    // 每天统计用户活跃度
    gtimer.AddSingleton(context.Background(), 24*time.Hour, generateDailyStats)
    
    // 每 5 分钟检查任务执行状态
    gtimer.AddSingleton(context.Background(), 5*time.Minute, checkTaskStatus)
}

// 清理过期 Token
func cleanExpiredTokens(ctx context.Context) {
    gf.Model("token_transactions").
        Where("expires_at < ?", time.Now()).
        Where("source", "ACTIVITY").
        Update(gf.Map{"status": "EXPIRED"})
}
```

**3.5 集成数据权限系统**

```go
// 扩展数据权限，支持套餐限制
func CheckPlanPermission(c *gf.GinCtx, feature string) bool {
    userID := c.GetInt64("userID")
    
    // 1. 获取用户套餐信息
    user, _ := gf.Model("admin_account").
        Where("id", userID).
        Fields("plan_id").
        Find()
    
    // 2. 检查套餐权限
    plan, _ := gf.Model("plans").
        Where("id", user["plan_id"]).
        Value("features")
    
    features := gconv.Map(plan)
    return features[feature] != nil
}
```

**3.6 利用 GoFly 缓存系统**

```go
// 多级缓存策略
func GetSiteRankData(domain string) (map[string]interface{}, error) {
    // 1. 先查内存缓存
    cacheKey := fmt.Sprintf("siterank:%s", domain)
    if data, err := gf.Cache().Get(ctx, cacheKey); err == nil {
        return data.Map(), nil
    }
    
    // 2. 再查 Redis 缓存
    if data, err := gf.Redis().Get(ctx, cacheKey); err == nil {
        // 回填内存缓存
        gf.Cache().Set(ctx, cacheKey, data, 10*time.Minute)
        return data.Map(), nil
    }
    
    // 3. 查询 SimilarWeb API
    data, err := querySimilarWebAPI(domain)
    if err != nil {
        return nil, err
    }
    
    // 4. 设置缓存
    gf.Cache().Set(ctx, cacheKey, data, 10*time.Minute)
    gf.Redis().Set(ctx, cacheKey, data, 24*time.Hour)
    
    return data, nil
}
```

**3.7 集成操作日志系统**

```go
// 扩展操作日志，记录业务操作
func LogBusinessAction(c *gf.GinCtx, action, module string) {
    userID := c.GetInt64("userID")
    params, _ := gf.RequestParam(c)
    
    gf.Model("admin_log").Data(gf.Map{
        "user_id":    userID,
        "type":       "business",
        "action":     action,
        "module":     module,
        "params":     gf.JsonEncode(params),
        "ip":         c.ClientIP(),
        "user_agent": c.Request.UserAgent(),
        "createtime": time.Now(),
    }).Insert()
}
```

**3.8 利用插件系统**

```go
// 开发 SimilarWeb 插件
package plugins

import "gofly/utils/tools/gplugin"

type SimilarWebPlugin struct{}

func (p *SimilarWebPlugin) Name() string {
    return "similarweb"
}

func (p *SimilarWebPlugin) Init() error {
    // 初始化 SimilarWeb 客户端
    return nil
}

func (p *SimilarWebPlugin) Query(domain string) (map[string]interface{}, error) {
    // 实现 SimilarWeb 查询逻辑
    return nil, nil
}

// 注册插件
func init() {
    gplugin.Register(&SimilarWebPlugin{})
}
```
├── admin/               // GoFly 管理后台（使用并扩展）
│   ├── system/         // 系统管理（用户、角色、权限等）
│   ├── datacenter/     // 数据中心（配置管理）
│   └── ...             // 其他管理模块
├── autoads/            // AutoAds 业务模块（新增）
│   ├── common/         // 通用功能
│   ├── user/           // 用户业务模块
│   ├── batchgo/        // BatchGo 功能
│   ├── siterankgo/     // SiteRankGo 功能
│   ├── adscentergo/    // AdsCenterGo 功能
│   └── token/          // Token 系统
└── business/           // GoFly 业务后台（可选使用）
```

**2.2 模块职责划分**

- **GoFly Admin**: 负责系统管理、用户管理、权限控制等通用功能
- **AutoAds**: 负责具体的业务逻辑（三大核心功能）
- **数据共享**: 通过统一的数据库模型实现数据互通

**3. 具体集成实现**

**3.1 路由系统集成**
```go
// 修改 app/controller.go，同时引入 admin 和 autoads 模块
import (
    "gofly/app/admin"        // GoFly 管理后台
    _ "gofly/app/autoads"    // 引入 AutoAds 模块
    "gofly/app/autoads/common"  // AutoAds 路由中间件
)

// 路由处理器 - 支持多模块
func RouterHandler(c *gf.GinCtx) {
    // 根据 path 前缀分发到不同模块
    path := c.FullPath()
    
    if strings.HasPrefix(path, "/admin/") {
        // GoFly 管理后台路由
        admin.RouterHandler(c, "admin")
    } else if strings.HasPrefix(path, "/api/v1/") {
        // AutoAds API 路由
        autoads.RouterHandler(c, "autoads")
    }
}
```

**3.2 认证系统集成**
```go
// 扩展 JWT Claims，支持 AutoAds 用户信息
type AutoAdsUserClaims struct {
    UserID       string `json:"user_id"`        // 用户ID
    Email        string `json:"email"`         // 邮箱
    Role         string `json:"role"`          // USER/ADMIN
    PlanID       string `json:"plan_id"`       // 套餐ID
    TokenBalance int    `json:"token_balance"` // Token余额
    jwt.StandardClaims
}

// 认证中间件
func AuthMiddleware(c *gf.GinCtx) {
    // 验证 JWT Token
    // 获取用户信息
    // 检查套餐权限
    // 注入上下文
}
```

**3.3 数据库集成**
```go
// 使用 GoFly gform ORM
// 在 models 包中定义数据模型
type User struct {
    gform.Model `table:"users"`
    ID         string `json:"id"`
    Email      string `json:"email"`
    // ... 其他字段
}

// 查询示例
func GetUsersByPlan(planID string) ([]User, error) {
    return gf.Model("users").
        Where("plan_id", planID).
        Where("deleted_at IS NULL").
        Order("created_at DESC").
        Select()
}
```

**3.4 RBAC 权限集成**
```go
// 扩展权限规则，支持套餐权限
type Permission struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Module      string `json:"module"`      // batchgo/siterankgo/adscentergo
    Action      string `json:"action"`      // create/read/update/delete
    PlanLevel   string `json:"plan_level"`  // free/pro/max
}

// 权限检查中间件
func CheckPermission(c *gf.GinCtx, module, action string) bool {
    user := c.MustGet("user").(*AutoAdsUser)
    plan := user.Plan
    
    // 检查套餐权限
    permission := GetPermission(module, action)
    return plan.Level >= permission.PlanLevel
}
```

**4. 配置适配**

**4.1 数据库配置**
```yaml
# 修改 resource/config.yaml
database:
  default:
    hostname: 127.0.0.1
    hostport: 3306
    username: root
    password: root
    dbname: autoads_v3  # 使用 AutoAds 数据库
    prefix: 
    type: "mysql"
    # ... 其他配置
```

**4.2 Redis 配置**
```yaml
redis:
  default:
    address: 127.0.0.1:6379
    db: 0        # AutoAds 使用 DB 0
  cache:
    address: 127.0.0.1:6379
    db: 1        # 缓存使用 DB 1
    pass: "123456"
```

**4.3 应用配置**
```yaml
app:
  port: 8200                    # 服务端口
  apisecret: autoads@2025       # API 密钥
  tokensecret: autoads-jwt-2025 # JWT 密钥
  allowurl: http://localhost:3000  # 前端域名
  tokenouttime: 120            # Token 过期时间（分钟）
  limiterMax: 1000             # 限流阈值
```

**5. 中间件定制**

**5.1 API 合法性验证**
```go
// 跳过验证的路径
noVerifyAPI: /api/v1/user/register,/api/v1/user/login,/api/v1/user/oauth/google
```

**5.2 限流中间件定制**
```go
// 基于套餐的分级限流
func RateLimitByPlan(c *gf.GinCtx) {
    user := c.GetUser()
    plan := user.GetPlan()
    
    // 不同套餐不同限流阈值
    limits := map[string]int{
        "free": 100,
        "pro": 1000,
        "max": 10000,
    }
    
    limit := limits[plan.Level]
    // 实现限流逻辑
}
```

**6. 代码生成工具利用**

GoFly 提供了代码生成工具，可以：
- 自动生成 CRUD 接口
- 生成前端 Vue 组件
- 生成数据库表结构

**使用方式**：
1. 在管理后台访问代码生成器
2. 设计表结构
3. 一键生成前后端代码
4. 手动调整业务逻辑

**7. 利用 GoFly 管理后台管理 AutoAds 业务**

**7.1 在 GoFly 管理后台集成 AutoAds 功能**

通过扩展 GoFly 的菜单和权限系统，将 AutoAds 的业务管理集成到管理后台：

```go
// 在 app/admin/system/ 下创建 autoads_menu.go
package system

type AutoAdsMenu struct{}

// 初始化 AutoAds 菜单
func (m *AutoAdsMenu) InitMenus() {
    menus := []map[string]interface{}{
        {
            "title":      "AutoAds 管理",
            "icon":       "dashboard",
            "path":       "/autoads",
            "component":  "Layout",
            "redirect":   "/autoads/dashboard",
            "sort":       100,
            "status":     0,
            "type":       0, // 菜单类型：0目录，1菜单，2按钮
            "children": []map[string]interface{}{
                {
                    "title":     "仪表板",
                    "icon":      "monitor",
                    "path":      "/autoads/dashboard",
                    "component": "autoads/dashboard/index",
                    "sort":      101,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "用户管理",
                    "icon":      "user",
                    "path":      "/autoads/users",
                    "component": "autoads/users/index",
                    "sort":      102,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "套餐管理",
                    "icon":      "credit-card",
                    "path":      "/autoads/plans",
                    "component": "autoads/plans/index",
                    "sort":      103,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "BatchGo 任务",
                    "icon":      "rocket",
                    "path":      "/autoads/batchgo",
                    "component": "autoads/batchgo/index",
                    "sort":      104,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "SiteRankGo 查询",
                    "icon":      "bar-chart",
                    "path":      "/autoads/siterankgo",
                    "component": "autoads/siterankgo/index",
                    "sort":      105,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "AdsCenterGo 账户",
                    "icon":      "link",
                    "path":      "/autoads/adscentergo",
                    "component": "autoads/adscentergo/index",
                    "sort":      106,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "Token 管理",
                    "icon":      "dollar",
                    "path":      "/autoads/tokens",
                    "component": "autoads/tokens/index",
                    "sort":      107,
                    "status":    0,
                    "type":      1,
                },
                {
                    "title":     "系统监控",
                    "icon":      "alert",
                    "path":      "/autoads/monitoring",
                    "component": "autoads/monitoring/index",
                    "sort":      108,
                    "status":    0,
                    "type":      1,
                },
            },
        },
    }
    
    // 批量插入菜单
    for _, menu := range menus {
        // 检查是否已存在
        exists, _ := gf.Model("admin_auth_rule").Where("path", menu["path"]).Exists()
        if !exists {
            gf.Model("admin_auth_rule").Data(menu).Insert()
        }
    }
}
```

**7.2 权限规则集成**

```go
// 创建 AutoAds 权限规则
func (m *AutoAdsMenu) InitPermissions() {
    permissions := []map[string]interface{}{
        // BatchGo 权限
        {"name": "batchgo.task.create", "title": "创建任务", "module": "batchgo"},
        {"name": "batchgo.task.read", "title": "查看任务", "module": "batchgo"},
        {"name": "batchgo.task.update", "title": "更新任务", "module": "batchgo"},
        {"name": "batchgo.task.delete", "title": "删除任务", "module": "batchgo"},
        
        // SiteRankGo 权限
        {"name": "siterankgo.query.create", "title": "创建查询", "module": "siterankgo"},
        {"name": "siterankgo.query.read", "title": "查看查询", "module": "siterankgo"},
        
        // AdsCenterGo 权限
        {"name": "adscentergo.account.create", "title": "创建账户", "module": "adscentergo"},
        {"name": "adscentergo.account.read", "title": "查看账户", "module": "adscentergo"},
        
        // Token 权限
        {"name": "token.balance.read", "title": "查看余额", "module": "token"},
        {"name": "token.transaction.read", "title": "查看交易", "module": "token"},
    }
    
    // 批量插入权限
    for _, perm := range permissions {
        exists, _ := gf.Model("admin_auth_rule").Where("name", perm["name"]).Exists()
        if !exists {
            perm["type"] = 2 // 按钮类型
            perm["status"] = 0
            gf.Model("admin_auth_rule").Data(perm).Insert()
        }
    }
}
```

**7.3 Vue 组件开发**

GoFly 管理后台使用 Vue.js，需要为 AutoAds 开发对应的管理组件：

```bash
# 在 resource/webadmin/src/views/ 下创建 AutoAds 组件
views/
└── autoads/
    ├── dashboard/
    │   └── index.vue          # AutoAds 仪表板
    ├── users/
    │   ├── index.vue          # 用户管理
    │   └── edit.vue           # 用户编辑
    ├── plans/
    │   ├── index.vue          # 套餐管理
    │   └── edit.vue           # 套餐编辑
    ├── batchgo/
    │   ├── index.vue          # 任务列表
    │   ├── create.vue         # 创建任务
    │   └── detail.vue         # 任务详情
    ├── siterankgo/
    │   └── index.vue          # 查询管理
    ├── adscentergo/
    │   └── index.vue          # 账户管理
    ├── tokens/
    │   ├── index.vue          # Token 余额
    │   └── transactions.vue   # 交易记录
    └── monitoring/
        └── index.vue          # 系统监控
```

**7.4 API 对接**

```javascript
// 在 resource/webadmin/src/api/ 下创建 AutoAds API
// autoads.js
import request from '@/utils/request'

// BatchGo 相关 API
export function getBatchgoTasks(params) {
  return request({
    url: '/api/v1/batchgo/tasks',
    method: 'get',
    params
  })
}

export function createBatchgoTask(data) {
  return request({
    url: '/api/v1/batchgo/tasks',
    method: 'post',
    data
  })
}

// 其他 API...
```

**7.5 部署优化**

**7.5.1 静态资源处理**
```bash
# 前端构建后部署到 GoFly 静态资源目录
resource/
├── webadmin/          # 管理后台前端
└── webbusiness/       # 业务前端（AutoAds 前端）
```

**7.2 进程管理**
```bash
# 使用 systemd 管理 GoFly 服务
# 配置文件：/etc/systemd/system/autoads.service
```

**8. 开发工作流**

**8.1 本地开发**
```bash
# 启动 GoFly 服务
go run main.go

# 访问地址：
# 管理后台：http://localhost:8200/admin/
# 业务后台：http://localhost:8200/
# API 文档：http://localhost:8200/swagger/
```

**8.2 调试工具**
- pprof 性能分析：http://localhost:8081/debug/pprof/
- SQL 日志：runtime/log/sql/
- 应用日志：runtime/log/app/

**9. 迁移步骤**

1. **环境准备**
   - 安装 Go 1.21+
   - 安装 MySQL 8.0+
   - 安装 Redis 7.0+

2. **数据库初始化**
   - 创建 autoads_v3 数据库
   - 执行 DDL 创建表结构

3. **代码迁移**
   - 创建 AutoAds 业务模块
   - 迁移业务逻辑到 Go

4. **前端适配**
   - 修改 API 基础路径
   - 适配新的认证方式

5. **测试验证**
   - 功能测试
   - 性能测试
   - 安全测试

**10. 注意事项**

1. **充分利用 GoFly 管理后台**：不要重复造轮子，GoFly 已经提供了完整的企业级管理功能
2. **扩展而非替换**：通过扩展菜单、权限和组件来集成 AutoAds 功能
3. **保持数据一致性**：AutoAds 业务数据与 GoFly 系统数据通过外键关联
4. **权限统一管理**：使用 GoFly 的 RBAC 系统管理所有权限
5. **前端组件复用**：复用 GoFly 的 UI 组件库，保持界面风格统一
6. **开发效率优先**：优先使用 GoFly 的代码生成工具，快速生成 CRUD 功能
7. **版本兼容性**：关注 GoFly 框架版本更新，及时适配变化

**4. 实现"Go单体应用+模块化设计"架构**

**4.1 单体应用的优势**

通过深度集成 GoFly，我们实现了真正的单体应用架构：

```go
// 单体应用结构
main.go
├── app/                    // 应用层
│   ├── admin/            // 管理端模块
│   ├── business/         // 业务端模块
│   ├── autoads/          // AutoAds 业务模块
│   └── common/           // 公共模块
├── utils/                 // 工具层
│   ├── gf/              // 框架核心
│   ├── gform/           // ORM
│   ├── router/         // 路由
│   └── tools/          // 通用工具
└── resource/             // 资源层
    ├── config.yaml      // 配置文件
    ├── static/          // 静态资源
    └── locale/          // 国际化
```

**4.2 模块化设计实现**

```go
// 模块化设计 - 每个模块都是独立的包
package autoads

import (
    "gofly/app/common"       // 公共模块
    "gofly/utils/gf"        // 框架工具
    "gofly/utils/gform"     // ORM
)

// 模块初始化
func Init() {
    // 注册路由
    registerRoutes()
    
    // 初始化配置
    initConfig()
    
    // 启动定时任务
    startScheduler()
    
    // 注册插件
    registerPlugins()
}

// 模块间通信 - 通过接口解耦
type BatchGoService interface {
    CreateTask(task *Task) error
    ExecuteTask(taskID string) error
    GetTaskStatus(taskID string) (*TaskStatus, error)
}

// 依赖注入 - 通过工厂模式
type ServiceFactory struct {
    batchGoService BatchGoService
    siteRankService SiteRankGoService
    adsCenterService AdsCenterGoService
}

func NewServiceFactory() *ServiceFactory {
    return &ServiceFactory{
        batchGoService:    &BatchGoServiceImpl{},
        siteRankService:   &SiteRankGoServiceImpl{},
        adsCenterService: &AdsCenterGoServiceImpl{},
    }
}
```

**4.3 统一的配置管理**

```go
// 配置管理 - 使用 GoFly 的配置系统
type Config struct {
    Database DatabaseConfig `yaml:"database"`
    Redis    RedisConfig    `yaml:"redis"`
    App      AppConfig      `yaml:"app"`
    AutoAds  AutoAdsConfig  `yaml:"autoads"`  // AutoAds 专用配置
}

// 热更新配置
func WatchConfig() {
    gf.WatchConfig("resource/config.yaml", func(config *Config) {
        // 配置变更时的处理逻辑
        updateBatchGoConfig(config.AutoAds.BatchGo)
        updateSiteRankGoConfig(config.AutoAds.SiteRankGo)
        updateAdsCenterGoConfig(config.AutoAds.AdsCenterGo)
    })
}
```

**4.4 统一的数据访问层**

```go
// 使用 GoFly ORM 统一数据访问
type UserRepository struct {
    db *gform.Model
}

func NewUserRepository() *UserRepository {
    return &UserRepository{
        db: gf.Model("admin_account"),
    }
}

func (r *UserRepository) FindByID(id int64) (*User, error) {
    var user User
    err := r.db.Where("id", id).Find(&user)
    return &user, err
}

func (r *UserRepository) FindByEmail(email string) (*User, error) {
    var user User
    err := r.db.Where("email", email).Find(&user)
    return &user, err
}

// 事务管理
func (r *UserRepository) UpdateWithTransaction(user *User, tx *gform.Tx) error {
    return tx.Model("admin_account").Data(user).Where("id", user.ID).Update()
}
```

**4.5 统一的中间件**

```go
// 认证中间件 - 基于 GoFly JWT
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            gf.Failed().SetMsg("未授权访问").SetCode(401).Regin(c)
            c.Abort()
            return
        }
        
        // 验证 Token
        claims, err := routeuse.ParseToken(token)
        if err != nil {
            gf.Failed().SetMsg("Token 无效").SetCode(401).Regin(c)
            c.Abort()
            return
        }
        
        // 设置用户上下文
        c.Set("userID", claims.ID)
        c.Set("user", claims)
        
        c.Next()
    }
}

// 权限中间件 - 基于 GoFly RBAC
func PermissionMiddleware(feature string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetInt64("userID")
        
        // 检查用户权限
        hasPermission := CheckPlanPermission(c, feature)
        if !hasPermission {
            gf.Failed().SetMsg("权限不足").SetCode(403).Regin(c)
            c.Abort()
            return
        }
        
        c.Next()
    }
}

// 限流中间件 - 基于 GoFly 限流
func RateLimitMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetInt64("userID")
        
        // 获取用户套餐
        user, _ := gf.Model("admin_account").
            Where("id", userID).
            Fields("plan_id").
            Find()
        
        // 根据套餐设置不同的限流阈值
        limits := map[string]int{
            "free": 100,
            "pro": 1000,
            "max": 10000,
        }
        
        limit := limits[user["plan_id"].String()]
        
        // 使用 GoFly 限流器
        if !gf.CheckRateLimit(c, limit) {
            gf.Failed().SetMsg("请求过于频繁").SetCode(429).Regin(c)
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

**4.6 统一的错误处理**

```go
// 错误码定义
const (
    ErrorCodeSuccess        = 0
    ErrorCodeParamError     = 1000
    ErrorCodeAuthError      = 1001
    ErrorCodePermissionError = 1002
    ErrorCodeBalanceError   = 1004
)

// 统一响应格式
type Response struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data"`
}

// 全局错误处理
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        // 捕获 panic
        if len(c.Errors) > 0 {
            err := c.Errors.Last()
            gf.Log().Error(ctx, err.Error())
            
            gf.Failed().
                SetMsg("系统错误").
                SetCode(500).
                Regin(c)
        }
    }
}
```

**4.7 统一的日志系统**

```go
// 使用 GoFly 日志系统
func LogOperation(c *gin.Context, operation, module string) {
    userID := c.GetInt64("userID")
    
    gf.Log().Info(ctx, map[string]interface{}{
        "type":       "operation",
        "user_id":    userID,
        "operation":  operation,
        "module":     module,
        "path":       c.FullPath(),
        "method":     c.Request.Method,
        "ip":         c.ClientIP(),
        "user_agent": c.Request.UserAgent(),
    })
}
```

通过以上设计，我们真正实现了：

1. **单体应用**：所有功能在一个进程中，部署简单
2. **模块化设计**：各模块职责清晰，低耦合高内聚
3. **统一架构**：使用统一的技术栈和设计模式
4. **易于维护**：代码结构清晰，便于理解和修改
5. **高性能**：进程内调用，无网络开销
6. **易扩展**：模块化设计便于添加新功能

这种架构既保持了单体应用的简单性，又具备了微服务的模块化优势。

#### 4.1.7 模块化设计

**核心模块划分**:
1. **用户模块 (User Module)**
   - 用户注册/登录
   - 用户信息管理
   - 权限控制

2. **BatchGo 模块**
   - 任务创建和管理
   - HTTP和Puppeteer模式
   - 代理池管理
   - 结果统计

3. **SiteRankGo 模块**
   - SimilarWeb API集成
   - 批量查询处理
   - 缓存管理
   - 数据分析

4. **AdsCenterGo 模块**
   - Google Ads API集成
   - 账户管理
   - 链接替换规则
   - 执行监控

5. **Token 模块**
   - Token余额管理
   - 交易记录
   - 充值和消费
   - 优先级控制

6. **管理后台模块**
   - 用户管理
   - 套餐管理
   - 系统监控
   - 数据分析

#### 4.1.5 数据流架构

**请求流程**:
1. 前端发起请求到GoFly后端
2. 中间件链处理（认证、限流、日志等）
3. 路由分发到对应模块
4. 业务逻辑处理
5. 数据库/缓存操作
6. 响应返回前端

**并发处理**:
- 使用Go的goroutine实现高并发
- 任务队列管理（Redis）
- 结果异步回调
- 实时状态推送

### 4.2 数据库设计

#### 4.2.1 核心业务表

```sql
-- 用户表
CREATE TABLE users (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    email VARCHAR(191) NOT NULL UNIQUE,
    username VARCHAR(191),
    password_hash VARCHAR(255), -- 移除UNIQUE约束，使用安全哈希
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

-- 套餐表（修复DDL语法错误）
CREATE TABLE plans (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    name VARCHAR(191) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'CNY', -- 统一使用人民币
    interval ENUM('DAY', 'WEEK', 'MONTH', 'YEAR') DEFAULT 'MONTH',
    features JSON,
    metadata JSON,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    external_reference_id VARCHAR(191), -- 用于关联外部支付系统记录
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

-- 订阅表（统一命名，移除user_subscription）
CREATE TABLE subscriptions (
    id VARCHAR(191) PRIMARY KEY, -- CUID
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

-- Token交易表（增加过期时间和优先级字段）
CREATE TABLE token_transactions (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    type ENUM('CONSUME', 'RECHARGE', 'BONUS', 'REFUND') NOT NULL,
    amount INT NOT NULL,
    balance_before INT NOT NULL,
    balance_after INT NOT NULL,
    source ENUM('SUBSCRIPTION', 'PURCHASE', 'ACTIVITY', 'REFERRAL', 'CHECKIN', 'OTHER'),
    description TEXT,
    feature ENUM('BATCHGO', 'SITERANKGO', 'ADSCENTERGO', 'OTHER') DEFAULT 'OTHER',
    expires_at DATETIME, -- Token过期时间
    priority INT DEFAULT 0, -- 优先级：订阅=10，活动=5，购买=0
    related_id VARCHAR(191), -- 关联业务ID
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
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

-- 邀请码表
CREATE TABLE invitations (
    id VARCHAR(191) PRIMARY KEY, -- CUID
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
    INDEX idx_status (status),
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 签到记录表
CREATE TABLE check_ins (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    check_in_date DATE NOT NULL,
    reward_tokens INT DEFAULT 10,
    consecutive_days INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, check_in_date),
    INDEX idx_user_id (user_id),
    INDEX idx_check_in_date (check_in_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 通知模板表
CREATE TABLE notification_template (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    name VARCHAR(191) NOT NULL,
    type ENUM('EMAIL', 'SMS', 'WEBHOOK', 'FEISHU') NOT NULL,
    template_content TEXT NOT NULL,
    variables JSON,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_type (type),
    INDEX idx_is_active (is_active)
);

-- 用户通知表
CREATE TABLE user_notification (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    template_id VARCHAR(191),
    type ENUM('EMAIL', 'SMS', 'WEBHOOK', 'FEISHU', 'SYSTEM') NOT NULL,
    title VARCHAR(500),
    content TEXT,
    status ENUM('PENDING', 'SENT', 'FAILED', 'READ') DEFAULT 'PENDING',
    send_at DATETIME,
    read_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES notification_template(id) ON DELETE SET NULL
);

-- 用户飞书配置表
CREATE TABLE user_feishu_config (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL UNIQUE,
    webhook_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API限流配置表
CREATE TABLE api_rate_limit (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191),
    path VARCHAR(191) NOT NULL,
    method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH') NOT NULL,
    limit_count INT NOT NULL,
    window_duration INT NOT NULL, -- 窗口时长（秒）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_path_method (user_id, path, method),
    INDEX idx_user_id (user_id),
    INDEX idx_path (path),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 4.2.2 业务功能表

```sql
-- BatchGo任务表
CREATE TABLE batchgo_tasks (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    name VARCHAR(500) NOT NULL,
    mode ENUM('BASIC', 'SILENT', 'AUTOMATED') NOT NULL,
    execution_mode ENUM('HTTP', 'PUPPETEER'),
    urls JSON NOT NULL, -- URL列表
    proxy_config JSON, -- 代理配置
    status ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    progress INT DEFAULT 0, -- 0-100
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    cycle_count INT DEFAULT 1, -- 循环次数
    current_cycle INT DEFAULT 1, -- 当前循环
    interval_ms INT DEFAULT 200, -- 执行间隔（毫秒）
    max_concurrent INT DEFAULT 1, -- 最大并发数
    result_summary JSON, -- 结果汇总
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
    task_id VARCHAR(191) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    proxy_ip VARCHAR(50),
    status ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT') DEFAULT 'PENDING',
    response_time INT, -- 响应时间（毫秒）
    status_code INT,
    error_message TEXT,
    screenshot_url VARCHAR(500), -- 截图URL（Puppeteer模式）
    executed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_executed_at (executed_at),
    FOREIGN KEY (task_id) REFERENCES batchgo_tasks(id) ON DELETE CASCADE
);

-- SiteRankGo查询表
CREATE TABLE siterankgo_queries (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    domains JSON NOT NULL, -- 域名列表
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL') DEFAULT 'PENDING',
    progress INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    result_summary JSON, -- 查询结果汇总
    error_message TEXT,
    cached_count INT DEFAULT 0, -- 缓存命中数
    api_calls INT DEFAULT 0, -- API调用次数
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
    query_id VARCHAR(191) NOT NULL,
    domain VARCHAR(500) NOT NULL,
    data JSON, -- SimilarWeb返回的完整数据
    from_cache BOOLEAN DEFAULT false, -- 是否来自缓存
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    platform ENUM('GOOGLE_ADS', 'ADSPOWER') NOT NULL,
    account_name VARCHAR(500) NOT NULL,
    account_id VARCHAR(191), -- 平台账户ID
    credentials JSON, -- 加密存储的凭据
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    account_id VARCHAR(191) NOT NULL,
    name VARCHAR(500) NOT NULL,
    type ENUM('LINK_REPLACE', 'CAMPAIGN_SYNC', 'BID_UPDATE') NOT NULL,
    config JSON NOT NULL, -- 任务配置
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

-- 咨询记录表（新增）
CREATE TABLE consultation_requests (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191),
    type ENUM('PLAN_SUBSCRIPTION', 'TOKEN_RECHARGE') NOT NULL,
    request_data JSON NOT NULL, -- 请求数据（套餐ID、数量等）
    contact_info JSON NOT NULL, -- 联系方式
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    admin_notes TEXT,
    processed_by VARCHAR(191), -- 处理人ID
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

#### 4.2.3 管理后台表

```sql
-- 管理员账户表
CREATE TABLE admin_accounts (
    id VARCHAR(191) PRIMARY KEY, -- CUID
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
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
    id VARCHAR(191) PRIMARY KEY, -- CUID
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

#### 4.3.2 统一响应格式

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

#### 4.3.3 错误码规范

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

#### 4.3.4 分页参数规范

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

#### 4.3.5 长任务处理规范

对于耗时较长的任务（如BatchGo、SiteRankGo批量查询），采用以下模式：

1. **创建任务**：返回任务ID
2. **查询进度**：通过任务ID查询执行状态
3. **结果获取**：任务完成后获取结果

**可选的通知方式**:
- WebSocket实时推送
- SSE（Server-Sent Events）
- 轮询查询

#### 4.3.6 幂等性支持

所有写操作API支持Idempotency-Key头：
```http
POST /api/v1/batchgo/tasks
Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000
```

### 4.4 安全架构设计

#### 4.4.1 认证授权

**JWT策略**:
- Access Token TTL: 2小时
- Refresh Token TTL: 30天
- 支持Token吊销（Redis黑名单）
- 支持并发会话控制（最多5个活跃设备）

**多因素认证**:
- 管理员强制开启2FA
- 支持TOTP和短信验证
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

### 4.5 性能优化策略

#### 4.5.1 缓存策略

**多级缓存**:
1. 应用内存缓存（LRU）
2. Redis分布式缓存
3. 数据库查询缓存

**缓存规则**:
- SimilarWeb数据：缓存24小时
- 用户权限信息：缓存5分钟
- 静态配置：缓存1小时

#### 4.5.2 数据库优化

**索引策略**:
- 所有外键字段建立索引
- 高频查询字段建立复合索引
- 定期分析慢查询日志

**连接池配置**:
- 最大连接数：100
- 最小空闲连接：10
- 连接超时：30秒

#### 4.5.3 并发处理

**Go并发模型**:
- Goroutine池管理
- Channel任务分发
- 优雅关闭机制

**资源限制**:
- 最大并发数：基于用户套餐
- 内存使用监控
- CPU使用率限制

### 4.6 监控与运维

#### 4.6.1 指标监控

**系统指标**:
- CPU/内存使用率
- 磁盘空间使用
- 网络IO统计

**业务指标**:
- QPS/响应时间
- 错误率统计
- 用户活跃度

#### 4.6.2 日志管理

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

#### 4.6.3 告警机制

**告警规则**:
- 错误率 > 5%
- 响应时间 > 1s
- 磁盘使用 > 80%
- Redis连接失败

**告警通道**:
- 邮件通知
- 飞书Webhook
- 短信告警

## 5. 实施计划

### 5.1 开发阶段规划

#### 阶段一：基础架构搭建（2周）
- [ ] GoFly框架集成和配置
- [ ] 数据库表结构创建
- [ ] 基础中间件开发
- [ ] 用户认证系统实现
- [ ] 基础API框架搭建

#### 阶段二：核心功能迁移（4周）
- [ ] BatchGo模块开发
  - [ ] 任务管理API
  - [ ] HTTP模式实现
  - [ ] Puppeteer模式集成
  - [ ] 代理池管理
  - [ ] 结果统计功能
- [ ] SiteRankGo模块开发
  - [ ] SimilarWeb API集成
  - [ ] 批量查询优化
  - [ ] 缓存策略实现
  - [ ] 数据分析功能

#### 阶段三：AdsCenterGo开发（3周）
- [ ] Google Ads API集成
- [ ] AdsPower API对接
- [ ] 链接替换规则引擎
- [ ] 执行监控功能

#### 阶段四：管理后台开发（3周）
- [ ] GoFly Admin集成
- [ ] 用户管理界面
- [ ] 套餐管理功能
- [ ] 系统监控面板
- [ ] 数据统计报表

#### 阶段五：测试与优化（2周）
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

## 6. 验收标准

### 6.1 功能验收

#### 用户系统
- [ ] 支持邮箱注册和验证
- [ ] 支持Google OAuth登录
- [ ] 支持密码找回功能
- [ ] 用户资料管理完整

#### BatchGo功能
- [ ] 三种模式完全兼容
- [ ] HTTP和Puppeteer模式可选
- [ ] 任务执行状态实时更新
- [ ] 支持代理配置和轮转
- [ ] 结果统计准确

#### SiteRankGo功能
- [ ] SimilarWeb API集成正常
- [ ] 批量查询性能达标
- [ ] 缓存策略有效
- [ ] 数据展示完整

#### AdsCenterGo功能
- [ ] Google Ads账户管理
- [ ] 链接替换功能正常
- [ ] 执行日志记录完整

### 6.2 性能验收

#### 响应时间
- [ ] API P95响应时间 < 200ms
- [ ] 页面加载时间 < 2s
- [ ] BatchGo任务启动时间 < 1s

#### 并发能力
- [ ] 支持5000用户同时在线
- [ ] BatchGo支持50并发任务
- [ ] SiteRankGo支持100并发查询

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
   - `users`：前端用户（支持OAuth）
   - `admin_users`：后台管理员（仅账号密码）

2. **认证中间件**：
   - 前端API：使用JWT + 用户表验证
   - 后台API：使用GoFly的RBAC系统 + admin_users表

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

### 7.2 Token消费规则

**扣费触发点**:
- Basic模式：点击打开时扣除
- Silent/Automated模式：任务创建时预扣，失败时返还
- SiteRankGo：查询成功后扣除
- 缓存命中：不扣除Token

**扣费失败处理**:
- 余额不足时拒绝创建任务
- 任务执行失败自动返还Token
- 系统异常导致的双重扣费自动修复

### 7.3 试用期规则

**叠加规则**:
- 新用户注册：14天Pro
- 邀请注册：30天Pro（不与新用户奖励叠加）
- 多次邀请：可累加，最长365天
- 试用期间不能再次获得试用

**降级机制**:
- 试用到期自动降为Free
- 付费套餐到期降为Free
- 降级后保留历史数据

### 7.4 代理配置要求

**代理类型支持**:
- HTTP/HTTPS代理
- SOCKS5代理
- 代理认证支持

**代理管理**:
- 自动检测代理可用性
- 失败代理自动剔除
- 支持代理权重配置

### 7.5 SimilarWeb配额管理

**配额使用策略**:
- 全局配额监控
- 达到限额自动降级
- 支持配额预约和排队
- 优先付费用户查询

## 8. 术语表

### 8.1 模块术语
- **BatchGo**: 批量访问功能的Go语言实现
- **SiteRankGo**: 网站排名功能的Go语言实现
- **AdsCenterGo**: 链接管理功能的Go语言实现

### 8.2 技术术语
- **CUID**: 自定义唯一标识符，用于数据库主键
- **JWT**: JSON Web Token，用于认证
- **RBAC**: 基于角色的访问控制
- **Puppeteer**: 无头浏览器自动化工具
- **SimilarWeb**: 第三方网站数据分析API

### 8.3 业务术语
- **Token**: 系统内的虚拟货币，用于功能消费
- **套餐**: 用户订阅的服务等级（Free/Pro/Max）
- **并发**: 同时执行的任务数量
- **代理**: 用于网络请求的中转服务器

## 9. 附录

### 9.1 环境配置

#### 开发环境
```bash
# Go版本要求
go version go1.21.0 darwin/arm64

# 依赖工具
- MySQL 8.0+
- Redis 7.0+
- Node.js 22+
```

#### 生产环境
```bash
# 服务器配置
- CPU: 4核+
- 内存: 8GB+
- 磁盘: 100GB SSD
- 网络: 100Mbps+
```

### 9.2 相关文档

- [MustKnow.md](./MustKnow.md) - 系统配置信息
- [GoFly Admin V3 文档](https://doc.goflys.cn/docview?id=26)
- [SimilarWeb API 文档](https://developer.similarweb.com/)
- [Google Ads API 文档](https://developers.google.com/google-ads/api/docs)

### 9.3 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v34.0 | 2025-09-13 | 新增 GoFly Admin V3 框架集成方案，包含详细的架构集成、模块设计、配置适配和迁移步骤 | 产品团队 |
| v33.0 | 2025-09-13 | 系统性优化V3版本，修复编号、术语、DDL等问题 | 产品团队 |
| v32.0 | 2025-09-12 | 增加支付系统说明和咨询功能 | 产品团队 |
| v31.0 | 2025-09-10 | 增加GoFly集成和模块化设计 | 产品团队 |
| v30.0 | 2025-09-08 | 初始版本创建 | 产品团队 |
