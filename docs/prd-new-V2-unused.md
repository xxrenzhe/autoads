# AutoAds 多用户 SaaS 系统重构 PRD

## 文档信息
- **项目名称**: AutoAds 多用户 SaaS 系统
- **版本**: v32.0
- **创建日期**: 2025-01-09
- **最后更新**: 2025-09-12
- **负责人**: 产品团队

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
- **FR4.2**: 基于 Go 实现高并发任务处理，支持万级并发
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

### 2.2 非功能需求（Non-Functional Requirements）

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

### 2.5 Token 充值价格

**Token 充值包**（充值越多，折扣越大）:
- 小包: ¥99 = 10,000 tokens
- 中包: ¥299 = 50,000 tokens (约 40% off)
- 大包: ¥599 = 200,000 tokens (约 67% off)
- 超大包: ¥999 = 500,000 tokens (约 80% off)

## 3. 技术架构设计

### 3.1 整体架构

#### 3.1.1 架构模式
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

#### 3.1.3 GoFly 框架核心特性

**1. 自动路由系统**
- 基于命名约定的路由生成：`/app/business/user/Account/GetList` → `GET /business/user/account/getlist`
- HTTP方法自动识别：`Get*`→GET, `Post*`→POST, `Del*`→DELETE, `Put*`→PUT
- 支持自定义路由覆盖
- 自动参数提取和绑定

**2. RBAC权限系统**
- 三级权限控制：模块级 → 角色级 → 操作级
- 动态菜单生成
- 数据范围自动过滤
- 支持管理员角色

**3. 自研ORM (gform)**
- Active Record模式
- 链式查询构建器
- 自动软删除
- 查询结果缓存
- 事务管理

**4. 中间件栈**
- CORS跨域处理
- JWT令牌认证
- 请求限流 (tollbooth)
- 错误恢复机制
- API验证中间件

**5. 配置系统**
- YAML配置文件
- 环境变量支持
- 热重载开发模式
- 多环境配置

#### 3.1.2 目标部署架构
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
    │   BatchGo    │         │  SiteRankGo   │        │  AdsCenterGo │
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
    │     MySQL     │         │     Redis      │        │  File Storage │
    │(Multi-tenant)│        │   (Cache/Queue) │      │   (Uploads)   │
    └───────────────┘         └───────────────┘        └───────────────┘
```

### 3.2 架构评估：Go单体应用+模块化设计

#### 3.2.1 评估结果

经过深入分析GoFly框架和当前架构设计，**当前架构完全符合"Go单体应用+模块化设计"的要求**。

#### 3.2.2 单体应用特征 ✅

1. **单一部署单元**
   - 整个应用编译为单个Go二进制文件
   - 统一的启动入口和配置管理
   - 共享的进程空间和内存管理

2. **统一基础设施**
   - 共享的数据库连接池（MySQL）
   - 统一的缓存服务（Redis）
   - 集中的日志和监控系统
   - 统一的中间件（认证、授权、限流等）

#### 3.2.3 模块化设计特征 ✅

1. **清晰的模块划分**
   ```go
   app/
   ├── admin/          # 管理后台模块
   ├── business/       # 业务模块
   │   ├── batchgo/    # 批量访问模块
   │   ├── siterankgo/ # 网站排名模块
   │   ├── adscentergo/ # 链接管理模块
   │   ├── user/       # 用户管理
   │   └── system/     # 系统管理
   └── common/         # 公共功能模块
   ```

2. **模块独立性**
   - 每个模块有独立的包空间和路由前缀
   - 模块间通过接口定义契约
   - 可独立开发、测试和部署

3. **自动路由系统**
   - 基于命名约定的自动路由注册
   - 支持模块级中间件
   - 统一的API版本管理

#### 3.2.4 架构优势

1. **性能优势**
   - 模块间通过函数调用，无网络开销
   - 共享内存，数据传递高效
   - 统一的连接池和资源管理

2. **运维优势**
   - 单一进程，监控简单
   - 部署便捷，无需服务编排
   - 故障定位快速

3. **开发优势**
   - 统一的代码库和工具链
   - 代码复用率高
   - 学习成本低

#### 3.2.5 模块间通信设计

```go
// 接口定义模块契约
type BatchGoService interface {
    CreateTask(ctx context.Context, req *TaskRequest) (*TaskResponse, error)
    GetTaskStatus(ctx context.Context, taskID string) (*TaskStatus, error)
}

// 依赖注入
type SiteRankGoHandler struct {
    batchGoService BatchGoService
    cacheService  CacheService
}
```

#### 3.2.6 配置管理

模块化配置支持：
```yaml
# resource/config.yaml
modules:
  batchgo:
    enabled: true
    max_concurrent_tasks: 100
    worker_pool_size: 10
  siterankgo:
    enabled: true
    cache_ttl: 3600
    api_timeout: 30
  adscentergo:
    enabled: true
    scheduler_workers: 5
    max_accounts: 50
```

### 3.3 数据库设计

#### 3.3.1 数据库配置
- **MySQL 8.0**: 使用环境变量DATABASE_URL连接（全新部署，无需数据迁移）
- **Redis 7.0**: 用于缓存和会话存储
- **ORM**: GoFly gform（GoFly自研ORM，类型安全的数据库访问）
- **配置详情**: 详见 [docs/MustKnow.md](../MustKnow.md) 中的环境变量配置

#### 3.3.2 实际数据隔离方案
采用**用户ID字段**方案，所有业务表包含 user_id 字段：
```sql
-- 用户表
CREATE TABLE users (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    email VARCHAR(191) UNIQUE NOT NULL,
    name VARCHAR(191),
    avatar VARCHAR(191),
    email_verified BOOLEAN DEFAULT false,
    role ENUM('USER', 'ADMIN') DEFAULT 'USER',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED') DEFAULT 'ACTIVE',
    password VARCHAR(191) UNIQUE,
    -- Token余额相关字段
    token_balance INT DEFAULT 0,
    token_used_this_month INT DEFAULT 0,
    subscription_token_balance INT DEFAULT 0,
    purchased_token_balance INT DEFAULT 0,
    activity_token_balance INT DEFAULT 0,
    -- 用户行为字段
    trial_used BOOLEAN DEFAULT false,
    login_count INT DEFAULT 0,
    last_login_at TIMESTAMP,
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订阅表
CREATE TABLE subscriptions (
    id VARCHAR(191) PRIMARY KEY,
    user_id VARCHAR(191) NOT NULL,
    plan_id VARCHAR(191) NOT NULL,
    status ENUM('ACTIVE', 'CANCELED', 'EXPIRED', 'PENDING', 'PAST_DUE') DEFAULT 'ACTIVE',
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    provider VARCHAR(191) DEFAULT 'manual',
    provider_subscription_id VARCHAR(191),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 套餐表
CREATE TABLE plans (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    name VARCHAR(191) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    interval ENUM('DAY', 'WEEK', 'MONTH', 'YEAR') DEFAULT 'MONTH',
    features JSON,
    metadata JSON,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    external_reference_id VARCHAR(191), -- 用于关联外部支付系统记录
    token_quota INT DEFAULT 0,
    token_reset VARCHAR(191) DEFAULT 'MONTHLY',
    billing_period VARCHAR(191) DEFAULT 'MONTHLY',
    rate_limit INT DEFAULT 100
);
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

-- Token交易表
CREATE TABLE token_transactions (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    type VARCHAR(191) NOT NULL,
    amount INT NOT NULL,
    balance_before INT NOT NULL,
    balance_after INT NOT NULL,
    source VARCHAR(191),
    description TEXT,
    feature tokenusagefeature DEFAULT 'OTHER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Token使用记录表
CREATE TABLE token_usage (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    tokens_consumed INT NOT NULL,
    tokens_remaining INT NOT NULL,
    plan_id VARCHAR(191) NOT NULL,
    batch_id VARCHAR(191),
    is_batch BOOLEAN DEFAULT false,
    item_count INT,
    metadata JSON,
    operation VARCHAR(191),
    feature tokenusagefeature NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 邀请表
CREATE TABLE invitations (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    inviter_id VARCHAR(191) NOT NULL,
    invited_id VARCHAR(191) UNIQUE,
    code VARCHAR(191) UNIQUE NOT NULL,
    status VARCHAR(191) DEFAULT 'PENDING',
    email VARCHAR(191),
    tokens_reward INT DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 签到表
CREATE TABLE check_ins (
    id VARCHAR(191) PRIMARY KEY, -- CUID
    user_id VARCHAR(191) NOT NULL,
    date DATE NOT NULL,
    tokens INT NOT NULL,
    streak INT DEFAULT 1,
    reward_level INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, date)
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
│   ├── AdsCenterGo模块
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
- **目标性能提升**: 4900% (从1并发提升到50并发)
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

# 代理管理相关
POST   /api/v1/proxy/pools             # 创建代理池
GET    /api/v1/proxy/pools             # 获取代理池列表
PUT    /api/v1/proxy/pools/:id         # 更新代理池
DELETE /api/v1/proxy/pools/:id         # 删除代理池
POST   /api/v1/proxy/validate          # 验证代理IP
GET    /api/v1/proxy/stats             # 获取代理统计信息

# SiteRankGo 相关
POST   /api/v1/siterank/queries       # 创建查询
GET    /api/v1/siterank/queries       # 查询历史
GET    /api/v1/siterank/domains/:id   # 获取域名排名
GET    /api/v1/siterank/report        # 生成报告

# AdsCenterGo 相关
POST   /api/v1/changelink_tasks       # 创建任务
GET    /api/v1/changelink_accounts    # 账户列表
POST   /api/v1/changelink_execute     # 执行替换
GET    /api/v1/changelink_logs        # 执行日志

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
// 统一 JWT Token 结构
type Claims struct {
    ID       int64  `json:"id"`          // 用户ID或管理员ID
    Username string `json:"username"`    // 用户名
    Role     string `json:"role"`        // USER或ADMIN
    Type     string `json:"type"`        // account类型：business或admin
    Plan     string `json:"plan"`        // 用户套餐（仅用户需要）
    Exp      int64  `json:"exp"`         // 过期时间
    jwt.StandardClaims
}

// 统一认证中间件
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"code": 401, "message": "未授权"})
            c.Abort()
            return
        }
        
        // 验证 Token 并提取信息
        claims, err := ValidateToken(token)
        if err != nil {
            c.JSON(401, gin.H{"code": 401, "message": "Token无效"})
            c.Abort()
            return
        }
        
        // 根据账号类型验证
        if claims.Type == "business" {
            // 验证用户状态
            user, err := GetUserByID(claims.ID)
            if err != nil || user.Status != "ACTIVE" {
                c.JSON(403, gin.H{"code": 403, "message": "用户已被禁用"})
                c.Abort()
                return
            }
            c.Set("user_id", claims.ID)
            c.Set("plan", claims.Plan)
        } else if claims.Type == "admin" {
            // 验证管理员状态
            admin, err := GetAdminByID(claims.ID)
            if err != nil || admin.Status != 1 {
                c.JSON(403, gin.H{"code": 403, "message": "管理员已被禁用"})
                c.Abort()
                return
            }
            c.Set("admin_id", claims.ID)
        }
        
        // 设置通用上下文
        c.Set("role", claims.Role)
        c.Set("username", claims.Username)
        c.Next()
    }
}

// 角色权限中间件
func RoleMiddleware(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        role := c.GetString("role")
        for _, r := range roles {
            if role == r {
                c.Next()
                return
            }
        }
        c.JSON(403, gin.H{"code": 403, "message": "权限不足"})
        c.Abort()
    }
}

// 功能权限检查中间件（以 BatchGo 为例）
func BatchGoPermissionMiddleware(mode string) gin.HandlerFunc {
    return func(c *gin.Context) {
        plan := c.GetString("plan")
        
        // 检查套餐权限
        switch mode {
        case "basic":
            // 所有套餐都支持
        case "silent":
            if plan != "PRO" && plan != "MAX" { // Pro套餐
                c.JSON(403, gin.H{"code": 403, "message": "需要Pro套餐才能使用Silent模式"})
                c.Abort()
                return
            }
        case "automated":
            if plan != "MAX" { // Max套餐
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
**Database**: MySQL (Prisma ORM)
**Infrastructure**: Node.js, Next.js, Redis
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
- **Basic 版本**: 浏览器标签页打开机制，100 URL限制，1并发
- **Silent 版本**: 后台执行，代理轮换，1,000 URL限制，5并发
- **Automated 版本**: 定时任务，双引擎，5,000 URL限制，50并发

**关键业务规则**:
- Token消耗：Basic(1 token/URL)、Silent(1 token/URL)、Automated(按成功点击数)
- 代理管理：验证、轮换、故障转移机制
- 任务状态追踪：实时进度更新和错误处理
- **代理配置要求**（HTTP和Puppeteer模式）：
  - 支持HTTP/HTTPS/SOCKS5代理协议
  - 自定义Referer配置（社交媒体、搜索引擎、自定义）
  - 自动代理IP健康检测和失效剔除
- **URL访问轮转机制**：
  - 每个代理IP必须完成所有URL的访问后才切换到下一个IP
  - 代理IP队列FIFO管理，支持循环使用
  - 失败代理自动跳过，支持URL重试

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

#### 4.3.3 AdsCenterGo 核心逻辑

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
- **第三方API风险**: SimilarWeb、Google Ads等外部API稳定性

#### 性能风险
- **并发处理**: 高并发场景下的资源管理
- **内存优化**: 大批量任务处理的内存控制
- **数据库性能**: 查询优化和索引设计

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

#### Phase 5: AdsCenterGo 模块开发（4周）
**目标**: 完成 AdsCenterGo 功能的 Go 语言重构

**主要任务**:
1. 集成 Google Ads API
2. 集成 AdsPower 自动化
3. 实现链接管理引擎
4. 开发监控系统
5. 实现回滚机制

**交付物**:
- AdsCenterGo 模块
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
  - Node.js 22+ 环境
  - MySQL 数据库
  - Redis 缓存
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
- BatchGo 并发能力提升 4900%（Max套餐50并发）
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
- [ ] 初始化管理员账号（admin）
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
| **最大URL数** | 100 | 1,000 | 5,000 |
| **并发数** | 1 | 5 | 50 |
| **Token类型** | `basic_batch_open` | `silent_batch_open` | `autoclick` |
| **访问模式** | 仅基础 | HTTP + Puppeteer | HTTP + Puppeteer |
| **进度追踪** | 基础进度条 | 详细阶段报告 | 综合分析面板 |
| **适用套餐** | Free | Pro | Max |

**验收标准**:
- [ ] Free 用户可使用 Basic 模式（100 URL/任务，1并发）
- [ ] Pro 用户可使用 Silent 模式（1,000 URL/任务，5并发）
- [ ] Max 用户可使用 Automated 模式（5,000 URL/任务，50并发）
- [ ] 支持HTTP和Puppeteer两种访问模式选择（Silent/Automated版本）
- [ ] HTTP模式支持10倍于Puppeteer的并发量
- [ ] Basic版本保持现有浏览器标签页打开方式
- [ ] Silent版本支持代理自动轮换和验证
- [ ] Automated版本支持定时任务和智能调度
- [ ] HTTP和Puppeteer模式都支持代理IP配置（HTTP/HTTPS/SOCKS5）
- [ ] 支持自定义Referer配置（社交媒体、搜索引擎、自定义来源）
- [ ] 每个代理IP完成一轮所有URL访问后才切换到下一个IP
- [ ] 代理IP失败时自动跳过并支持重试机制
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

#### Story 5.2.5: AdsCenterGo 自动化管理
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
**I want to** 查看所有Token充值记录,
**so that** 我可以跟踪充值情况。

**验收标准**:
- [ ] 查看所有Token充值申请记录
- [ ] 查看充值状态（待审核/已充值/已取消）
- [ ] 按时间筛选记录
- [ ] 导出充值报表
- [ ] 手动标记充值状态

**集成验证**:
- IV1: 充值记录完整
- IV2: Token数量准确
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
2. **集成成本低**: Node.js生态有成熟的Redis支持库
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

# AdsCenterGo主题
changelink:started   # 链接更新开始
changelink:updated   # 链接更新进度
changelink:completed # 链接更新完成

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
- 简化角色系统：只保留USER和ADMIN两个角色
- MANAGER: 功能下放到ADMIN或通过套餐权限控制

#### 6.2.2 权限控制机制

**基于套餐的功能权限**：
```yaml
Free套餐:
  - BatchGo Basic: 100个URL/任务，串行执行
  - SiteRankGo: 100个域名/次
  - AdsCenterGo: 不支持
  
Pro套餐:
  - BatchGo Silent: 1,000个URL/任务，5并发
  - SiteRankGo: 500个域名/次
  - AdsCenterGo: 10个Google Ads账户
  
Max套餐:
  - BatchGo Automated: 5,000个URL/任务，50并发
  - SiteRankGo: 5,000个域名/次
  - AdsCenterGo: 100个Google Ads账户
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

### 6.4 GoFly框架深度分析与集成架构

基于对GoFly Admin V3源码的深入分析，GoFly是一个成熟的Go全栈开发框架，提供以下核心能力：

#### 6.4.1 GoFly框架核心能力

**1. 架构特性**
- **MVC分层架构**: 清晰的Model-View-Controller分离
- **模块化设计**: Admin（管理后台）和Business（业务后台）双模块
- **自动路由系统**: 基于命名约定的路由自动生成
- **中间件栈**: CORS、错误恢复、限流、认证、授权等

**2. 路由系统**
```go
// 自动路由规则：
// /app/business/user/Account/GetList → GET /business/user/account/getlist
// /app/admin/system/Role/Save → POST /admin/system/role/save
// 支持GET、POST、PUT、DELETE自动映射
```

**3. RBAC权限系统**
- **三级权限控制**: 模块级 → 角色级 → 操作级
- **动态权限管理**: 基于数据库的实时权限更新
- **数据权限过滤**: 自动根据用户权限过滤数据
- **菜单权限控制**: 基于权限动态生成菜单

**4. 自研ORM (gform)**
- **Active Record模式**: 链式调用，语法简洁
- **多数据库支持**: MySQL、PostgreSQL、SQLite
- **连接池管理**: 可配置的连接池参数
- **事务支持**: 内置事务管理
- **软删除**: 自动软删除功能
- **查询缓存**: 提升查询性能

**5. 多租户支持**
- **Schema隔离**: 支持多Schema数据隔离
- **Business ID过滤**: 自动基于business_id过滤数据
- **租户配置管理**: 每个租户独立配置

#### 6.4.2 GoFly集成价值

**1. 立即可用的后台管理系统**
- 完整的用户管理（注册、登录、权限）
- 专业级管理后台界面
- 细粒度的权限控制
- 操作日志和审计功能

**2. 开发效率提升**
- 自动CRUD生成
- 代码生成器加速开发
- 约定优于配置的架构
- 丰富的中间件和工具库

**3. 性能优势**
- Go语言原生并发支持
- 高性能HTTP路由（Gin框架）
- 数据库连接池优化
- 内存效率高

#### 6.4.3 集成策略

**Phase 1: 基础架构搭建（2-3个月）**
```
目标：建立基于GoFly的完整技术架构
1. 部署GoFly框架作为主后端服务
2. 配置新MySQL数据库（使用MustKnow.md中的配置）
3. 实现用户认证和权限管理系统
4. 开发核心业务模块（BatchGo/SiteRankGo/AdsCenterGo）
5. 集成前端Next.js应用
6. 实现基础的RBAC权限体系
```

**Phase 2: 功能完善与优化（3-4个月）**
```
目标：完善所有功能并优化性能
1. 代理管理系统实现
   - 代理IP池管理
   - 代理验证和轮换
   - 代理性能监控
2. SimilarWeb API集成优化
   - 查询缓存策略
   - 批量处理优化
   - 错误重试机制
3. Google Ads集成实现
   - 账户连接管理
   - 链接批量更新
   - 执行状态监控
```

**Phase 3: 高级特性开发（2-3个月）**
```
目标：添加高级功能和企业级特性
1. 高级分析和报表
   - 用户行为分析
   - 任务执行统计
   - 性能监控面板
2. 系统优化增强
   - 缓存策略优化
   - 数据库查询优化
   - 并发性能调优
3. 运维和监控
   - 日志聚合分析
   - 告警系统
   - 自动化部署
```

#### 6.4.4 技术架构设计

**Go单体应用 + 模块化架构**

**核心架构原则**
- **单一职责**: GoFly作为唯一后端服务，统一处理所有业务逻辑
- **模块化设计**: 清晰的模块边界，支持独立开发和维护
- **前后端分离**: Next.js专注用户界面，GoFly提供API服务
- **简化部署**: 单一Go二进制文件，简化部署和运维

**详细架构图**
```
┌─────────────────────────────────────────────────────────────┐
│                    用户访问层                                │
├─────────────────────────────────────────────────────────────┤
│  Next.js前端 (用户界面)                                      │
│  ├── 用户注册/登录                                           │
│  ├── 业务功能操作 (BatchGo/SiteRankGo/AdsCenterGo)          │
│  └── 个人中心/数据看板                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ HTTPS API调用
┌─────────────────────────────────────────────────────────────┐
│                 GoFly单体应用 (统一后端)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                API网关层                                │ │
│  │  ├── 路由分发 (/api/v1/*)                               │ │
│  │  ├── 认证中间件 (JWT + Redis Session)                   │ │
│  │  ├── 限流控制 (基于套餐和IP)                             │ │
│  │  └── 统一错误处理                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                业务模块层                                │ │
│  │  ├── business/user/        (用户管理)                   │ │
│  │  ├── business/batchgo/     (批量访问)                   │ │
│  │  ├── business/siterankgo/  (网站排名)                   │ │
│  │  ├── business/adscentergo/ (链接管理)                   │ │
│  │  ├── business/payment/     (支付订阅)                   │ │
│  │  └── admin/               (管理后台)                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                              │                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                公共服务层                                │ │
│  │  ├── 缓存服务 (Redis)                                   │ │
│  │  ├── 队列服务 (内置任务队列)                             │ │
│  │  ├── 日志服务                                           │ │
│  │  ├── 监控服务                                           │ │
│  │  └── 通知服务 (邮件/站内信)                              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓ 数据访问
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层                                │
├─────────────────────────────────────────────────────────────┤
│  MySQL 8.0 (全新数据库) ──────┐  ┌───── Redis 7.0           │
│  ├── business_account         │  ├── 会话存储               │
│  ├── admin_account            │  ├── 缓存数据               │
│  ├── batchgo_tasks            │  ├── 限流计数               │
│  ├── siterank_queries         │  └── 队列数据               │
│  ├── adscentergo_configs      │                             │
│  └── ... (其他业务表)         │                             │
└─────────────────────────────────────────────────────────────┘
```

**技术栈明确化**
- **后端框架**: GoFly V3 (唯一后端服务)
- **ORM**: 统一使用GoFly gform (移除Prisma混合使用)
- **前端**: Next.js 14 + TypeScript (仅用户界面)
- **数据库**: MySQL 8.0 (全新实例，无需迁移)
- **缓存**: Redis 7.0 (会话、缓存、队列)
- **认证**: JWT + Redis Session
- **部署**: Docker + 单一Go二进制文件

### 6.5 GoFly管理系统与业务逻辑集成方案

#### 6.5.1 集成架构总结

基于前期分析和设计，现已完成GoFly管理系统与业务逻辑的集成方案设计：

**已完成的设计方案**
1. **统一后端架构**: 采用GoFly作为唯一后端服务，Next.js仅作为用户界面
2. **认证系统**: 
   - 普通用户：支持邮箱注册登录和Google OAuth登录（网站前端）
   - 管理员：仅支持账号密码登录（GoFly Admin后台），不提供注册功能
3. **API网关设计**: 统一的路由分发和认证中间件
4. **管理界面集成**: 所有管理功能在GoFly Admin中实现

**核心集成要点**
- Next.js前端通过API调用GoFly后端服务
- GoFly Admin提供内置的管理界面
- 统一的数据库访问层
- 共享的缓存和会话管理

#### 6.5.2 GoFly Admin管理后台架构设计

**架构方案**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                              用户访问层                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────┐  │
│  │     Next.js 前端             │    │      GoFly Admin 管理后台        │  │
│  │     (用户界面)               │    │     (独立管理入口)              │  │
│  │                             │    │                                 │  │
│  │  • 用户注册/登录             │    │  • 管理员登录 (无注册)          │  │
│  │  • 业务功能操作              │    │  • 用户管理                    │  │
│  │  • 个人中心/数据看板          │    │  • 任务管理                    │  │
│  │  • Google OAuth集成          │    │  • 系统配置                    │  │
│  │  • 支付订阅                  │    │  • 监控面板                    │  │
│  │                             │    │  • 权限控制                    │  │
│  │  访问: https://autoads.dev   │    │  访问: https://autoads.dev/admin│  │
│  └─────────────────────────────┘    └─────────────────────────────────┘  │
│           │                                    │                        │
│           └────────────────────────────────────┼────────────────────────┘
│                                                │
└────────────────────────────────────────────────┼────────────────────────┘
                                                 │
                                       ┌────────▼────────┐
                                       │   GoFly API     │
                                       │   Gateway       │
                                       └────────┬────────┘
                                                │
           ┌─────────────────────────────────────┼─────────────────────────────┐
           │                                     │                             │
      ┌────▼────┐                         ┌──────▼──────┐                ┌─────▼─────┐
      │ BatchGo │                         │  SiteRankGo │                │AdsCenterGo │
      └────┬────┘                         └──────┬──────┘                └─────┬─────┘
           │                                     │                             │
           └─────────────────────────────────────┼─────────────────────────────┘
                                                 │
                                       ┌────────▼────────┐
                                       │    数据存储层     │
                                       │ (MySQL + Redis) │
                                       └─────────────────┘
```

**设计原则**
- **单一后端服务**: GoFly作为唯一后端，统一处理所有API请求
- **统一认证系统**: JWT + Redis Session，支持用户和管理员不同角色
- **角色权限控制**: 基于RBAC的细粒度权限管理
- **简化部署架构**: 单一Go应用，避免多服务部署复杂性
- **完全独立的前端访问**: 用户界面和管理后台使用不同的访问入口，完全隔离

#### 6.5.3 双认证系统设计

**普通用户认证（网站前端）**
```
1. 访问网站首页 (Next.js)
2. 选择登录方式：
   - 邮箱注册
     • 输入邮箱和密码
     • 新用户自动发送验证邮件
     • 验证后获得JWT Token
   - 邮箱登录
     • 输入已注册的邮箱和密码
     • 登录成功获得JWT Token
   - Google OAuth登录
     • 点击"使用Google登录"
     • 跳转到Google授权页面
     • 授权后返回网站
     • 自动创建账号（如果首次登录）
     • 登录成功获得JWT Token
3. Token存储在浏览器localStorage和Redis中
4. 根据用户套餐显示相应功能模块
```

**管理员认证（GoFly Admin后台）**
```
1. 访问GoFly Admin管理后台登录页面
2. 输入管理员账号和密码
   - 管理员账号由系统预设（admin）或现有管理员创建
   - 不提供任何注册功能，只能由其他管理员创建新账号
   - 账号信息存储在admin_account表
3. GoFly Admin内置认证系统验证
4. 登录成功后进入管理后台界面
5. 基于RBAC权限控制访问各个管理模块
```

**关键设计要点**
- **统一的JWT认证机制**：
  • 用户和管理员都使用JWT Token进行身份验证
  • Token中包含role字段区分用户类型（USER/ADMIN）
  • 统一的Redis Session管理
- **独立的数据存储**：
  • 普通用户：users表
  • 管理员：admin_account表
- **不同的认证流程**：
  • 普通用户：支持邮箱注册和Google OAuth登录（网站页面）
  • 管理员：仅支持账号密码登录（GoFly Admin后台），无注册功能
- **完全独立的访问入口**：
  • 普通用户：https://autoads.dev（网站页面）
  • 管理员：https://autoads.dev/admin（GoFly Admin后台登录页面）
- **安全隔离**：管理功能与用户功能完全独立

**认证集成实现**

**统一JWT认证系统实现**

**用户认证实现（网站前端API）**
```go
// 用户认证控制器
package api

type UserAuthController struct{}

// 用户邮箱注册
func (c *UserAuthController) Register(ctx *gf.GinCtx) {
    var req struct {
        Email    string `json:"email" validate:"required,email"`
        Password string `json:"password" validate:"required,min=6"`
        Name     string `json:"name"`
    }
    
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.Error(400, err.Error())
        return
    }
    
    // 检查邮箱是否已存在
    exists, _ := service.User().EmailExists(ctx, req.Email)
    if exists {
        ctx.Error(409, "邮箱已被注册")
        return
    }
    
    // 创建用户（business_account表）
    user, err := service.User().Create(ctx, req.Email, req.Password, req.Name)
    if err != nil {
        ctx.Error(500, "注册失败")
        return
    }
    
    // 发送验证邮件
    go service.Email().SendVerification(user.Email, user.EmailVerifyToken)
    
    // 自动分配14天Pro套餐
    service.Subscription().GrantTrial(user.ID, 14)
    
    ctx.Success(gf.H{
        "userId": user.ID,
        "email":  user.Email,
        "msg":    "注册成功，请查收验证邮件",
    })
}

// 用户邮箱登录
func (c *UserAuthController) EmailLogin(ctx *gf.GinCtx) {
    var req struct {
        Email    string `json:"email" validate:"required,email"`
        Password string `json:"password" validate:"required"`
    }
    
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.Error(400, err.Error())
        return
    }
    
    // 验证用户账号（business_account表）
    user, err := service.User().EmailLogin(ctx, req.Email, req.Password)
    if err != nil {
        ctx.Error(401, "邮箱或密码错误")
        return
    }
    
    // 检查用户状态
    if user.Status != "ACTIVE" {
        ctx.Error(403, "账号已被禁用")
        return
    }
    
    // 生成用户JWT Token
    token, err := service.Auth().GenerateUserToken(user.ID)
    if err != nil {
        ctx.Error(500, "生成Token失败")
        return
    }
    
    // 更新登录信息
    service.User().UpdateLoginInfo(ctx, user.ID, ctx.ClientIP())
    
    ctx.Success(gf.H{
        "token": token,
        "user": gf.H{
            "id":           user.ID,
            "email":        user.Email,
            "name":         user.Name,
            "avatar":       user.Avatar,
            "plan":         user.Plan,
            "tokens":       user.Tokens,
            "verified":     user.EmailVerified,
        },
    })
}

// Google OAuth登录回调
func (c *UserAuthController) GoogleCallback(ctx *gf.GinCtx) {
    code := ctx.Query("code")
    if code == "" {
        ctx.Error(400, "缺少授权码")
        return
    }
    
    // 获取Google用户信息
    googleUser, err := service.OAuth().GetGoogleUser(code)
    if err != nil {
        ctx.Error(500, "Google授权失败")
        return
    }
    
    // 查找或创建用户（business_account表）
    user, err := service.User().FindOrCreateByGoogle(ctx, googleUser)
    if err != nil {
        ctx.Error(500, "登录失败")
        return
    }
    
    // 生成用户Token
    token, err := service.Auth().GenerateUserToken(user.ID)
    if err != nil {
        ctx.Error(500, "生成Token失败")
        return
    }
    
    // 重定向到前端，携带Token
    redirectURL := fmt.Sprintf("%s/auth/callback?token=%s", config.FrontendURL, token)
    ctx.Redirect(redirectURL)
}
```

**管理员认证实现（GoFly Admin内置）**
```go
// 管理员认证控制器
package admin

type AdminAuthController struct{}

// 管理员登录
func (c *AdminAuthController) Login(ctx *gf.GinCtx) {
    var req struct {
        Username string `json:"username" validate:"required"`
        Password string `json:"password" validate:"required"`
    }
    
    if err := ctx.ShouldBindJSON(&req); err != nil {
        ctx.Error(400, err.Error())
        return
    }
    
    // 验证管理员账号（admin_account表）
    admin, err := service.Admin().ValidateLogin(ctx, req.Username, req.Password)
    if err != nil {
        ctx.Error(401, "用户名或密码错误")
        return
    }
    
    // 检查管理员状态
    if admin.Status != 1 {
        ctx.Error(403, "账号已被禁用")
        return
    }
    
    // 生成管理员Session Token
    sessionToken := service.Admin().GenerateSessionToken(admin.ID)
    
    // 记录登录日志
    service.Admin().LogLogin(ctx, admin.ID, ctx.ClientIP(), "success")
    
    ctx.Success(gf.H{
        "token": sessionToken,
        "admin": gf.H{
            "id":       admin.ID,
            "username": admin.Username,
            "name":     admin.Name,
            "role":     admin.Role,
            "avatar":   admin.Avatar,
        },
    })
}

// 管理员退出
func (c *AdminAuthController) Logout(ctx *gf.GinCtx) {
    adminId := ctx.Session.Get("admin_id")
    if adminId != nil {
        // 清除Session
        service.Admin().ClearSession(adminId.Uint64())
        // 记录退出日志
        service.Admin().LogLogout(ctx, adminId.Uint64())
    }
    
    ctx.Success(gf.H{"msg": "退出成功"})
}
```

**权限中间件实现**
```go
// 基于角色的权限中间件
func RoleMiddleware(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetUint("user_id")
        if userID == 0 {
            c.AbortWithStatusJSON(401, gin.H{"error": "未授权"})
            return
        }
        
        // 获取用户角色
        userRole := service.User().GetRole(userID)
        
        // 检查角色权限
        hasPermission := false
        for _, role := range roles {
            if userRole == role {
                hasPermission = true
                break
            }
        }
        
        if !hasPermission {
            c.AbortWithStatusJSON(403, gin.H{"error": "权限不足"})
            return
        }
        
        c.Next()
    }
}

// 管理后台访问控制
func AdminAccessMiddleware() gin.HandlerFunc {
    return RoleMiddleware("ADMIN")
}
```


#### 6.5.4 业务模块管理界面设计

**GoFly Admin统一管理界面**

所有管理功能统一在GoFly Admin中实现，通过RBAC权限控制动态显示相应模块：

**管理界面架构**
```
GoFly Admin 管理后台
├── 仪表盘 (Dashboard)
│   ├── 系统概览 (用户数、任务数、收入统计)
│   ├── 实时监控 (API调用、任务执行、系统资源)
│   └── 快捷操作 (常用功能入口)
├── 用户管理
│   ├── 用户列表 (查看、编辑、禁用用户)
│   ├── 套餐管理 (升级、降级、Token充值)
│   ├── 订单管理 (支付记录、手动调整)
│   └── 邀请码管理 (生成、统计、失效)
├── 业务管理
│   ├── BatchGo管理 (任务监控、日志查看、配置管理)
│   ├── SiteRankGo管理 (查询统计、缓存配置、代理管理)
│   └── AdsCenterGo管理 (账户管理、执行历史、规则配置)
├── 系统管理
│   ├── 系统配置 (参数设置、API密钥、SMTP配置)
│   ├── 权限管理 (角色定义、权限分配、菜单管理)
│   ├── 操作日志 (用户行为、系统事件、异常记录)
│   └── 系统监控 (性能指标、告警配置、备份管理)
└── 数据分析
    ├── 用户分析 (注册转化、活跃度、留存率)
    ├── 业务分析 (功能使用、收入趋势、资源消耗)
    └── 系统分析 (性能趋势、错误统计、容量规划)
```

**GoFly Admin控制器实现示例**
```go
// BatchGo管理控制器
package admin

import (
    "github.com/gogf/gf/v2/frame/g"
    "github.com/gogf/gf/v2/net/ghttp"
)

type BatchGoController struct{}

// 任务管理页面
func (c *BatchGoController) Tasks(r *ghttp.Request) {
    // 权限检查
    if !c.checkPermission(r, "batchgo:task:read") {
        r.Response.WriteJsonExit(g.Map{
            "code": 403,
            "msg":  "权限不足",
        })
        return
    }
    
    // 渲染管理页面
    r.Response.WriteTpl("admin/batchgo/tasks.html", g.Map{
        "title": "BatchGo任务管理",
        "data":  c.getTaskOverview(r),
    })
}

// 任务统计数据API
func (c *BatchGoController) TaskStats(r *ghttp.Request) {
    stats, err := service.BatchGo().GetTaskStats(r.Context())
    if err != nil {
        r.Response.WriteJsonExit(g.Map{
            "code": 500,
            "msg":  "获取统计数据失败",
        })
        return
    }
    
    r.Response.WriteJsonExit(g.Map{
        "code": 0,
        "data": stats,
    })
}

// 权限检查中间件
func (c *BatchGoController) checkPermission(r *ghttp.Request, permission string) bool {
    userId := r.Session.Get("user_id")
    if userId == nil {
        return false
    }
    
    // 调用权限服务检查权限
    hasPermission, _ := service.RBAC().CheckPermission(r.Context(), userId.Uint64(), permission)
    return hasPermission
}
```

**前端管理页面模板（GoFly Template）**
```html
<!-- admin/batchgo/tasks.html -->
{{extend "admin/layout.html"}}

{{block "content"}}
<div class="container-fluid">
    <div class="row">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">BatchGo任务管理</h3>
                    <div class="card-tools">
                        <button class="btn btn-primary" onclick="showCreateModal()">
                            <i class="fas fa-plus"></i> 新建任务
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row mb-3">
                        <div class="col-md-3">
                            <div class="small-box bg-info">
                                <div class="inner">
                                    <h3 id="totalTasks">{{.data.totalTasks}}</h3>
                                    <p>总任务数</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="small-box bg-success">
                                <div class="inner">
                                    <h3 id="successRate">{{.data.successRate}}%</h3>
                                    <p>成功率</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="small-box bg-warning">
                                <div class="inner">
                                    <h3 id="runningTasks">{{.data.runningTasks}}</h3>
                                    <p>运行中</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="small-box bg-danger">
                                <div class="inner">
                                    <h3 id="failedTasks">{{.data.failedTasks}}</h3>
                                    <p>失败任务</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 任务列表表格 -->
                    <div class="table-responsive">
                        <table class="table table-bordered table-striped">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>任务名称</th>
                                    <th>用户</th>
                                    <th>模式</th>
                                    <th>状态</th>
                                    <th>进度</th>
                                    <th>创建时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="taskTableBody">
                                <!-- 通过AJAX加载数据 -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- 任务详情模态框 -->
<div class="modal fade" id="taskDetailModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">任务详情</h5>
                <button type="button" class="close" data-dismiss="modal">
                    <span>&times;</span>
                </button>
            </div>
            <div class="modal-body" id="taskDetailContent">
                <!-- 动态加载任务详情 -->
            </div>
        </div>
    </div>
</div>

<!-- JavaScript代码 -->
<script>
// 页面加载完成后初始化
$(document).ready(function() {
    loadTaskList();
    
    // 每30秒刷新一次数据
    setInterval(loadTaskList, 30000);
});

// 加载任务列表
function loadTaskList() {
    $.ajax({
        url: '/admin/api/batchgo/tasks',
        method: 'GET',
        success: function(response) {
            if (response.code === 0) {
                renderTaskTable(response.data);
            }
        }
    });
}

// 渲染任务表格
function renderTaskTable(tasks) {
    let html = '';
    tasks.forEach(task => {
        html += `
            <tr>
                <td>${task.id}</td>
                <td>${task.name}</td>
                <td>${task.username}</td>
                <td><span class="badge badge-info">${task.mode}</span></td>
                <td>${getStatusBadge(task.status)}</td>
                <td>${getProgressBar(task.progress)}</td>
                <td>${task.created_at}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewTaskDetail(${task.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="stopTask(${task.id})" ${task.status !== 'running' ? 'disabled' : ''}>
                        <i class="fas fa-stop"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    $('#taskTableBody').html(html);
}

// 查看任务详情
function viewTaskDetail(taskId) {
    $.ajax({
        url: `/admin/api/batchgo/tasks/${taskId}`,
        method: 'GET',
        success: function(response) {
            if (response.code === 0) {
                $('#taskDetailContent').html(renderTaskDetail(response.data));
                $('#taskDetailModal').modal('show');
            }
        }
    });
}
</script>
{{end}}
```

**BatchGo管理界面**
```
┌─────────────────────────────────────────────────────────────┐
│                    BatchGo 任务监控中心                        │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │  任务概览    │ │  实时监控    │ │  代理管理    │ │ 日志查看 │ │
│ │             │ │             │ │             │ │         │ │
│ │ • 总任务数   │ │ • 运行中任务 │ │ • 代理IP池   │ │ • 执行   │ │
│ │ • 成功率     │ │ • 队列长度   │ │ • 可用率     │ │   日志   │ │
│ │ • 平均耗时   │ │ • 并发数     │ │ • 响应时间   │ │ • 错误   │ │
│ │ • 今日Token  │ │ • 成功率     │ │ • 失败统计   │ │   日志   │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    任务执行详情                              │ │
│ │  ID    │ 状态   │ 进度  │ URL数 │ 成功 │ 失败 │ 耗时  │ 操作 │ │
│ │  T001  │ 运行中 │ 45%   │ 1000  │ 450  │ 2    │ 2:30  │ 查看 │ │
│ │  T002  │ 完成   │ 100%  │ 500   │ 500  │ 0    │ 1:15  │ 查看 │ │
│ │  T003  │ 失败   │ 10%   │ 2000  │ 100  │ 50   │ 0:45  │ 重试 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**SiteRankGo管理界面**
```
┌─────────────────────────────────────────────────────────────┐
│                   SiteRankGo 查询管理中心                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │  查询统计    │ │  缓存状态    │ │  API使用     │ │ 数据导出 │ │
│ │             │ │             │ │             │ │         │ │
│ │ • 今日查询   │ │ 缓存命中率   │ │ • API调用量  │ │ • CSV   │ │
│ │ • 成功率     │ │ 缓存大小     │ │ • 成功率     │ │ • Excel  │ │
│ │ • 平均响应   │ │ 过期时间     │ │ • 错误率     │ │ • JSON  │ │
│ │ • Token消耗  │ │ 内存使用     │ │ • 剩余额度   │ │ • PDF   │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    查询队列管理                              │ │
│ │  ID    │ 域名    │ 状态   │ 进度  │ 预估  │ 实际  │ 操作 │ │
│ │  Q001  │ a.com   │ 查询中 │ 60%   │ 10s   │ 8s    │ 取消 │ │
│ │  Q002  │ b.com   │ 排队中 │ 0%    │ -     │ -     │ 删除 │ │
│ │  Q003  │ c.com   │ 完成   │ 100%  │ 5s    │ 6s    │ 查看 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**AdsCenterGo管理界面**
```
┌─────────────────────────────────────────────────────────────┐
│                  AdsCenterGo 账户管理中心                      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │  账户概览    │ │  自动化规则  │ │  执行历史    │ │ 告警中心 │ │
│ │             │ │             │ │             │ │         │ │
│ │ • 已连接账户 │ │ • 活跃规则   │ │ • 今日执行   │ │ • 活动告警│ │
│ │ • 失效账户   │ │ • 规则状态   │ │ • 成功率     │ │ • 告警历史│ │
│ │ • 待授权账户 │ │ • 执行频率   │ │ • 失败原因   │ │ • 通知设置│ │
│ │ • 总链接数   │ │ • 下次执行   │ │ • 平均耗时   │ │ • 告警级别│ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    Google Ads账户                             │ │
│ │  账户名    │ 状态   │ 链接数 │ 最后更新  │ 成功率 │ 操作   │ │
│ │  账户A     │ 正常   │ 150   │ 2小时前   │ 98%   │ 管理  │ │
│ │  账户B     │ 异常   │ 80    │ 1天前     │ -     │ 重连  │ │
│ │  账户C     │ 正常   │ 200   │ 30分钟前  │ 95%   │ 管理  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 6.5.5 实时数据推送增强设计

**GoFly WebSocket实现**
```go
// WebSocket管理器 - GoFly实现
package websocket

import (
    "github.com/gogf/gf/v2/frame/g"
    "github.com/gogf/gf/v2/net/gws"
    "github.com/gogf/gf/v2/container/gmap"
    "github.com/gogf/gf/v2/os/gtimer"
    "time"
)

// WebSocket管理器
type Manager struct {
    connections *gmap.StrAnyMap // 用户连接映射
    subscriptions *gmap.StrAnyMap // 订阅关系映射
    authHandler AuthHandler // 认证处理器
}

// 认证处理器接口
type AuthHandler interface {
    Validate(token string) (uint64, error)
    CheckPermission(userId uint64, event string) bool
}

// 消息结构
type Message struct {
    Type    string      `json:"type"`
    Event   string      `json:"event,omitempty"`
    Payload interface{} `json:"payload"`
    Timestamp time.Time  `json:"timestamp"`
}

// 新建WebSocket管理器
func NewManager(authHandler AuthHandler) *Manager {
    return &Manager{
        connections:    gmap.NewStrAnyMap(true),
        subscriptions:  gmap.NewStrAnyMap(true),
        authHandler:    authHandler,
    }
}

// WebSocket连接处理
func (m *Manager) HandleConnection(r *gws.Request) {
    // 1. 认证验证
    token := r.Get("token", "")
    userId, err := m.authHandler.Validate(token)
    if err != nil {
        r.Exit()
        return
    }
    
    // 2. 建立连接
    conn := r.WebSocket
    userIdStr := gconv.String(userId)
    
    // 保存连接
    m.connections.Set(userIdStr, conn)
    
    // 发送连接成功消息
    m.SendMessage(conn, Message{
        Type:    "connected",
        Payload: g.Map{"userId": userId},
        Timestamp: time.Now(),
    })
    
    // 3. 消息处理循环
    for {
        msg, err := conn.ReadMessage()
        if err != nil {
            m.handleDisconnection(userIdStr)
            break
        }
        
        // 处理客户端消息
        m.handleClientMessage(userIdStr, msg)
    }
}

// 处理客户端消息
func (m *Manager) handleClientMessage(userId string, msg []byte) {
    var data struct {
        Type   string      `json:"type"`
        Event  string      `json:"event,omitempty"`
        Data   interface{} `json:"data"`
    }
    
    if err := json.Unmarshal(msg, &data); err != nil {
        return
    }
    
    switch data.Type {
    case "subscribe":
        m.handleSubscribe(userId, data.Event)
    case "unsubscribe":
        m.handleUnsubscribe(userId, data.Event)
    case "ping":
        m.sendPong(userId)
    }
}

// 处理订阅请求
func (m *Manager) handleSubscribe(userId string, event string) {
    // 检查权限
    userIdNum := gconv.Uint64(userId)
    if !m.authHandler.CheckPermission(userIdNum, event) {
        m.sendError(userId, "permission_denied")
        return
    }
    
    // 记录订阅
    subs := m.subscriptions.GetOrSet(userId, gset.NewStrSet())
    if subs.(*gset.StrSet).Add(event) {
        // 订阅成功，发送确认
        m.sendMessageToUser(userId, Message{
            Type:    "subscribed",
            Event:   event,
            Payload: g.Map{"status": "success"},
            Timestamp: time.Now(),
        })
    }
}

// 广播消息到所有订阅者
func (m *Manager) Broadcast(event string, payload interface{}) {
    message := Message{
        Type:    "broadcast",
        Event:   event,
        Payload: payload,
        Timestamp: time.Now(),
    }
    
    // 遍历所有连接
    m.connections.Iterator(func(userId string, conn *gws.Conn) bool {
        // 检查用户是否订阅了该事件
        if subs := m.subscriptions.Get(userId); subs != nil {
            if subs.(*gset.StrSet).Contains(event) {
                m.SendMessage(conn, message)
            }
        }
        return true
    })
}

// 发送消息给特定用户
func (m *Manager) SendToUser(userId uint64, event string, payload interface{}) {
    userIdStr := gconv.String(userId)
    message := Message{
        Type:    "event",
        Event:   event,
        Payload: payload,
        Timestamp: time.Now(),
    }
    
    m.sendMessageToUser(userIdStr, message)
}

// 内部方法
func (m *Manager) sendMessageToUser(userId string, message Message) {
    if conn := m.connections.Get(userId); conn != nil {
        m.SendMessage(conn.(*gws.Conn), message)
    }
}

func (m *Manager) SendMessage(conn *gws.Conn, message Message) {
    data, _ := json.Marshal(message)
    conn.WriteMessage(data)
}

func (m *Manager) sendError(userId string, code string) {
    m.sendMessageToUser(userId, Message{
        Type:    "error",
        Payload: g.Map{"code": code},
        Timestamp: time.Now(),
    })
}

func (m *Manager) sendPong(userId string) {
    m.sendMessageToUser(userId, Message{
        Type:    "pong",
        Timestamp: time.Now(),
    })
}

func (m *Manager) handleDisconnection(userId string) {
    // 清理连接
    m.connections.Remove(userId)
    // 保留订阅记录，用于重连后恢复
}

// 心跳检测
func (m *Manager) StartHeartbeat() {
    gtimer.AddSingleton(time.Second*30, func() {
        m.connections.Iterator(func(userId string, conn *gws.Conn) bool {
            // 发送ping
            m.SendMessage(conn, Message{
                Type:    "ping",
                Timestamp: time.Now(),
            })
            return true
        })
    })
}
```

**认证和权限集成**
```go
// WebSocket认证处理器
type WebSocketAuthHandler struct {
    userService *service.User
    rbacService *service.RBAC
}

func (h *WebSocketAuthHandler) Validate(token string) (uint64, error) {
    // 验证JWT Token
    claims, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
        return []byte(config.Secret), nil
    })
    
    if err != nil {
        return 0, err
    }
    
    return claims.Subject, nil
}

func (h *WebSocketAuthHandler) CheckPermission(userId uint64, event string) bool {
    // 检查用户权限
    hasPermission, _ := h.rbacService.CheckPermission(context.Background(), userId, event)
    return hasPermission
}
```

**事件定义和权限映射**
```go
// WebSocket事件权限定义
const (
    // BatchGo事件
    EventBatchGoTaskUpdate = "batchgo:task_update"
    EventBatchGoTaskLog    = "batchgo:task_log"
    EventBatchGoProxyStatus = "batchgo:proxy_status"
    
    // SiteRankGo事件
    EventSiteRankQueryComplete = "siterank:query_complete"
    EventSiteRankCacheUpdate   = "siterank:cache_update"
    
    // AdsCenterGo事件
    EventAdsCenterExecutionLog = "adscenter:execution_log"
    EventAdsCenterAccountStatus = "adscenter:account_status"
    
    // 系统事件
    EventSystemNotification = "system:notification"
    EventUserTokenUpdate    = "user:token_update"
)

// 事件权限映射
var EventPermissions = map[string]string{
    EventBatchGoTaskUpdate:     "batchgo:task:read",
    EventBatchGoTaskLog:       "batchgo:task:read",
    EventBatchGoProxyStatus:   "batchgo:proxy:read",
    EventSiteRankQueryComplete: "siterank:query:read",
    EventSiteRankCacheUpdate:   "siterank:query:read",
    EventAdsCenterExecutionLog: "adscenter:task:read",
    EventAdsCenterAccountStatus: "adscenter:account:read",
    EventSystemNotification:    "system:notification:read",
    EventUserTokenUpdate:       "user:token:read",
}
```

**限流机制**
```go
// WebSocket限流中间件
func WebSocketRateLimit() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(100), 200) // 100 msg/s, burst 200
    
    return func(c *gin.Context) {
        userId := c.GetUint("user_id")
        
        // 按用户限流
        key := fmt.Sprintf("ws_rate_limit:%d", userId)
        count, _ := redis.Incr(key)
        if count == 1 {
            redis.Expire(key, time.Second)
        }
        
        if int(count) > 100 {
            c.AbortWithStatusJSON(429, gin.H{
                "error": "Rate limit exceeded"
            })
            return
        }
        
        c.Next()
    }
}
```

#### 6.5.6 API网关详细设计

**统一路由配置**
```go
// API Gateway路由配置
func SetupRouter() *gin.Engine {
    r := gin.Default()
    
    // 全局中间件
    r.Use(middleware.CORS())
    r.Use(middleware.RateLimit(1000)) // IP限流
    r.Use(middleware.Logger())
    r.Use(middleware.Recovery())
    
    // API版本管理
    v1 := r.Group("/api/v1")
    {
        // 业务API
        business := v1.Group("/business")
        {
            // BatchGo API
            batchgo := business.Group("/batchgo")
            {
                batchgo.POST("/tasks", middleware.Auth(), BatchGoController.CreateTask)
                batchgo.GET("/tasks", middleware.Auth(), BatchGoController.GetTasks)
                batchgo.GET("/tasks/:id", middleware.Auth(), BatchGoController.GetTask)
                batchgo.PUT("/tasks/:id", middleware.Auth(), BatchGoController.UpdateTask)
                batchgo.DELETE("/tasks/:id", middleware.Auth(), BatchGoController.DeleteTask)
                
                // 代理管理
                batchgo.GET("/proxies", middleware.Auth(), BatchGoController.GetProxies)
                batchgo.POST("/proxies", middleware.Auth("admin"), BatchGoController.AddProxy)
            }
            
            // SiteRankGo API
            siterank := business.Group("/siterank")
            {
                siterank.POST("/queries", middleware.Auth(), SiteRankController.CreateQuery)
                siterank.GET("/queries", middleware.Auth(), SiteRankController.GetQueries)
                siterank.GET("/results", middleware.Auth(), SiteRankController.GetResults)
                siterank.POST("/export", middleware.Auth(), SiteRankController.ExportData)
            }
            
            // AdsCenterGo API
            adscenter := business.Group("/adscenter")
            {
                adscenter.GET("/accounts", middleware.Auth(), AdsCenterController.GetAccounts)
                adscenter.POST("/accounts", middleware.Auth(), AdsCenterController.AddAccount)
                adscenter.PUT("/accounts/:id", middleware.Auth(), AdsCenterController.UpdateAccount)
                adscenter.POST("/tasks", middleware.Auth(), AdsCenterController.CreateTask)
            }
        }
        
        // 管理API
        admin := v1.Group("/admin")
        admin.Use(middleware.Auth("admin"))
        {
            // 用户管理
            admin.GET("/users", AdminController.GetUsers)
            admin.POST("/users", AdminController.CreateUser)
            admin.PUT("/users/:id", AdminController.UpdateUser)
            
            // 系统配置
            admin.GET("/config", AdminController.GetConfig)
            admin.PUT("/config", AdminController.UpdateConfig)
            
            // 系统监控
            admin.GET("/metrics", AdminController.GetMetrics)
            admin.GET("/logs", AdminController.GetLogs)
        }
    }
    
    // WebSocket端点
    r.GET("/ws", middleware.Auth(), WebSocketHandler.HandleConnection)
    
    // 健康检查
    r.GET("/health", HealthController.Check)
    
    return r
}
```

**负载均衡与健康检查**
```go
// 服务发现与健康检查
type ServiceRegistry struct {
    services map[string][]ServiceInstance
    mutex    sync.RWMutex
}

type ServiceInstance struct {
    ID       string
    Address  string
    Port     int
    Healthy  bool
    LastCheck time.Time
}

func (sr *ServiceRegistry) HealthCheck() {
    for {
        sr.mutex.Lock()
        for serviceName, instances := range sr.services {
            for i, instance := range instances {
                healthy := sr.checkInstanceHealth(instance)
                sr.services[serviceName][i].Healthy = healthy
                sr.services[serviceName][i].LastCheck = time.Now()
            }
        }
        sr.mutex.Unlock()
        
        time.Sleep(10 * time.Second)
    }
}

func (sr *ServiceRegistry) GetHealthyService(serviceName string) *ServiceInstance {
    sr.mutex.RLock()
    defer sr.mutex.RUnlock()
    
    instances := sr.services[serviceName]
    if len(instances) == 0 {
        return nil
    }
    
    // 轮询选择健康实例
    var healthyInstances []ServiceInstance
    for _, instance := range instances {
        if instance.Healthy {
            healthyInstances = append(healthyInstances, instance)
        }
    }
    
    if len(healthyInstances) == 0 {
        return nil
    }
    
    index := int(time.Now().Unix()) % len(healthyInstances)
    return &healthyInstances[index]
}
```

#### 6.5.7 数据一致性与事务管理

**分布式事务管理**
```go
// 分布式事务管理器
type DistributedTransactionManager struct {
    db     *gorm.DB
    redis  *redis.Client
    logger *zap.Logger
}

func (dtm *DistributedTransactionManager) ExecuteTransaction(ctx context.Context, operations []func(tx *gorm.DB) error) error {
    // 开始数据库事务
    tx := dtm.db.Begin()
    
    // 执行操作
    for _, op := range operations {
        if err := op(tx); err != nil {
            // 回滚事务
            tx.Rollback()
            dtm.logger.Error("Transaction operation failed", zap.Error(err))
            return err
        }
    }
    
    // 提交事务
    if err := tx.Commit().Error; err != nil {
        dtm.logger.Error("Transaction commit failed", zap.Error(err))
        return err
    }
    
    // 异步更新缓存
    go dtm.updateCache(ctx)
    
    return nil
}
```

**缓存一致性策略**
```go
// 缓存管理器
type CacheManager struct {
    redis *redis.Client
    db    *gorm.DB
}

func (cm *CacheManager) GetWithCache(ctx context.Context, key string, query func() (interface{}, error)) (interface{}, error) {
    // 尝试从缓存获取
    cached, err := cm.redis.Get(ctx, key).Result()
    if err == nil {
        var result interface{}
        if err := json.Unmarshal([]byte(cached), &result); err == nil {
            return result, nil
        }
    }
    
    // 缓存未命中，从数据库查询
    result, err := query()
    if err != nil {
        return nil, err
    }
    
    // 更新缓存
    data, _ := json.Marshal(result)
    cm.redis.Set(ctx, key, data, 5*time.Minute)
    
    return result, nil
}
```

#### 6.5.8 监控与告警系统集成

**统一监控面板**
```typescript
// 监控数据聚合
interface MonitoringMetrics {
    // 系统指标
    system: {
        cpu: number;
        memory: number;
        disk: number;
        network: {
            in: number;
            out: number;
        };
    };
    
    // 业务指标
    business: {
        batchgo: {
            activeTasks: number;
            successRate: number;
            avgResponseTime: number;
        };
        siterank: {
            activeQueries: number;
            cacheHitRate: number;
            apiSuccessRate: number;
        };
        adscenter: {
            activeAccounts: number;
            executionSuccessRate: number;
        };
    };
    
    // 用户指标
    users: {
        online: number;
        total: number;
        activeToday: number;
    };
}

// 实时监控组件
const SystemMonitor: React.FC = () => {
    const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
    
    useEffect(() => {
        const ws = new WebSocket('/ws/monitoring');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setMetrics(data);
        };
        
        return () => ws.close();
    }, []);
    
    if (!metrics) return <div>Loading...</div>;
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 系统指标卡片 */}
            <MetricCard title="CPU使用率" value={`${metrics.system.cpu}%`} />
            <MetricCard title="内存使用率" value={`${metrics.system.memory}%`} />
            <MetricCard title="在线用户" value={metrics.users.online} />
            
            {/* 业务指标图表 */}
            <BusinessChart data={metrics.business} />
            
            {/* 告警列表 */}
            <AlertList />
        </div>
    );
};
```

**智能告警系统**
```go
// 告警规则引擎
type AlertRuleEngine struct {
    rules    []AlertRule
    notifier AlertNotifier
}

type AlertRule struct {
    ID          string
    Name        string
    Condition   string // "cpu > 80", "error_rate > 5%"
    Threshold   float64
    Duration    time.Duration
    Severity    string // "info", "warning", "critical"
    Actions     []AlertAction
}

func (are *AlertRuleEngine) Evaluate(metrics MonitoringMetrics) {
    for _, rule := range are.rules {
        triggered := are.evaluateCondition(rule, metrics)
        
        if triggered {
            // 检查持续时间
            if rule.Duration > 0 {
                if !are.checkDuration(rule) {
                    continue
                }
            }
            
            // 触发告警
            are.notifier.Send(Alert{
                RuleID:    rule.ID,
                Title:     rule.Name,
                Message:   fmt.Sprintf("%s: %.2f", rule.Condition, rule.Threshold),
                Severity:  rule.Severity,
                Timestamp: time.Now(),
            })
        }
    }
}
```

#### 6.5.9 部署与运维增强

**容器化部署配置**
```yaml
# docker-compose.yml
version: '3.8'
services:
  # GoFly API Gateway
  gofly-api:
    build: .
    ports:
      - "8200:8200"
    environment:
      - DB_HOST=mysql
      - REDIS_HOST=redis
      - ENVIRONMENT=production
    depends_on:
      - mysql
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8200/health"]
      interval: 30s
      timeout: 10s
      retries: 3
  
  # Next.js Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://gofly-api:8200
    depends_on:
      - gofly-api
  
  # MySQL
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: autoads
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
  
  # Redis
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

volumes:
  mysql_data:
  redis_data:
```

**CI/CD流水线增强**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Go
        uses: actions/setup-go@v3
        with:
          go-version: 1.21
      
      - name: Run tests
        run: |
          go test ./...
          go vet ./...
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build GoFly API
        run: |
          CGO_ENABLED=0 GOOS=linux go build -o gofly-api .
          
      - name: Build Docker image
        run: |
          docker build -t ghcr.io/xxrenzhe/autoads-gofly:${{ github.sha }} .
          
      - name: Push Docker image
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/xxrenzhe/autoads-gofly:${{ github.sha }}
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # 使用ansible或kubectl部署
          ansible-playbook deploy.yml -e version=${{ github.sha }}
```

#### 6.5.10 实施时间表更新

基于简化后的单一管理后台设计，更新实施时间表：

| 阶段 | 任务 | 时间 | 负责人 | 输出物 |
|------|------|------|--------|--------|
| 1 | 架构设计与准备 | 2周 | 架构师 | 详细设计文档、技术方案 |
| 2 | GoFly基础框架搭建 | 3周 | 后端团队 | GoFly后端服务、基础API |
| 3 | 统一认证系统 | 1周 | 后端团队 | JWT认证、Redis Session集成 |
| 4 | API网关实现 | 2周 | 后端团队 | 路由管理、权限验证、限流 |
| 5 | BatchGo服务实现 | 4周 | 后端团队 | 批量访问服务、API接口 |
| 6 | SiteRankGo服务实现 | 3周 | 后端团队 | 排名查询服务、缓存系统 |
| 7 | AdsCenterGo服务实现 | 4周 | 后端团队 | 账户管理、自动化执行 |
| 8 | 管理界面开发 | 3周 | 前端团队 | 用户管理、任务管理、系统配置界面 |
| 9 | 实时功能集成 | 2周 | 全栈团队 | WebSocket、实时监控、状态更新 |
| 10 | 监控告警系统 | 2周 | 运维团队 | 监控面板、告警规则 |
| 11 | 测试与优化 | 3周 | QA团队 | 集成测试、性能优化 |
| 12 | 部署上线 | 1周 | 运维团队 | 生产环境部署、系统配置 |

**总计：30周**

#### 6.5.11 成功标准更新

1. **技术指标**
   - API响应时间 < 100ms (95分位)
   - 系统可用性 > 99.9%
   - 并发用户支持 > 1000
   - WebSocket消息延迟 < 100ms

2. **功能完整性**
   - 所有现有功能在Go版本中正常工作
   - 单一管理后台功能完整且易用
   - 实时监控和告警系统有效运行
   - 权限控制系统精确可靠

3. **用户体验**
   - 页面加载时间 < 2秒
   - 实时数据更新无延迟感
   - 错误处理友好，恢复机制完善
   - 管理操作直观高效

4. **运维指标**
   - 部署时间 < 30分钟
   - 回滚时间 < 5分钟
   - 监控覆盖率达到100%
   - 告警准确率 > 95%

#### 6.5.6 核心功能Go重构详细计划

**重构原则**
1. **API兼容性优先**：保持所有现有API接口不变
2. **业务逻辑 preserved**：确保所有功能完整性
3. **直接替换策略**：完整实现后一次性切换
4. **最小化停机时间**：每个模块切换控制在30分钟内

**实施策略**

**阶段1：基础架构搭建（2周）**
```
目标：搭建GoFly应用基础架构
1. 部署GoFly V3框架
2. 配置开发环境
3. 设计数据库表结构（全新数据库）
4. 实现基础中间件（认证、日志、限流）
5. 搭建CI/CD流水线
```

**阶段2：用户系统实现（3周）**
```
目标：实现完整的用户管理和认证系统
1. 用户注册登录模块
2. JWT + Redis Session认证
3. RBAC权限系统
4. 套餐和Token系统
5. 支付集成（如需要）
```

**阶段3：BatchGo模块实现（4周）**
```
目标：实现批量访问功能
1. 任务管理器（goroutine池）
2. 并发控制器（信号量机制）
3. 代理轮转服务
4. HTTP/Puppeteer双模式支持
5. 完整的单元测试和集成测试
```

**阶段4：SiteRankGo模块实现（3周）**
```
目标：实现网站排名查询功能
1. SimilarWeb API集成
2. 智能缓存策略
3. 批量查询优化
4. 数据导出功能
5. 完整测试套件
```

**阶段5：AdsCenterGo模块实现（4周）**
```
目标：实现广告链接管理功能
1. Google Ads API集成
2. 账户管理
3. 自动化规则引擎
4. 执行日志系统
5. 完整测试套件
```

**阶段6：GoFly Admin管理界面实现（3周）**
```
目标：实现完整的管理后台
1. 用户管理界面
2. 业务模块管理界面
3. 系统配置界面
4. 监控和统计面板
5. 数据可视化
```

**阶段7：系统集成测试（2周）**
```
目标：全系统集成测试
1. 端到端功能测试
2. 性能测试和优化
3. 安全测试
4. 压力测试
5. 用户体验测试
```

**阶段8：部署上线（1周）**
```
目标：系统正式上线
1. 生产环境部署
2. 数据初始化（全新数据库）
3. 域名和DNS配置
4. 监控系统部署
5. 上线验证
```

**技术实现要点**

**1. API兼容层设计**
```go
// 自动路由映射
/app/business/batchgo/Task/SilentStart → POST /api/batchopen/silent-start
/app/business/siterank/Query/Batch → POST /api/siterank/batch

// 请求/响应结构完全兼容
type SilentStartRequest struct {
    TaskId       string   `json:"taskId"`
    Urls         []string `json:"urls"`
    CycleCount   int      `json:"cycleCount"`
    // ... 保持与现有API一致
}
```

**2. 数据库设计**
```go
// 无需数据迁移，直接使用新表结构
type DatabaseSchema struct {
    // BatchGo表
    BatchGoTasks struct {
        ID        string    `json:"id"`
        UserID    string    `json:"user_id"`
        TaskID    string    `json:"task_id"`
        URLs      []string  `json:"urls"`
        Status    string    `json:"status"`
        CreatedAt time.Time `json:"created_at"`
    }
    
    // SiteRankGo表
    SiteRankQueries struct {
        ID           string    `json:"id"`
        UserID       string    `json:"user_id"`
        Domain       string    `json:"domain"`
        GlobalRank   int64     `json:"global_rank"`
        CachedAt     time.Time `json:"cached_at"`
    }
    
    // AdsCenterGo表
    AdsCenterAccounts struct {
        ID        string    `json:"id"`
        UserID    string    `json:"user_id"`
        Platform  string    `json:"platform"`
        Status    string    `json:"status"`
    }
}
```

**3. 回滚保护机制**
```go
// 快速回滚（无需数据恢复）
type RollbackController struct {
    versionManager *VersionManager
    serviceManager *ServiceManager
}

// 执行回滚（5分钟内完成）
func (r *RollbackController) Rollback(version string) error {
    log.Info("开始回滚到版本: " + version)
    
    // 1. 停止Go服务
    if err := r.serviceManager.StopGoServices(); err != nil {
        return err
    }
    
    // 2. 切换到Next.js版本
    if err := r.versionManager.SwitchTo(version); err != nil {
        return err
    }
    
    // 3. 启动Next.js服务
    if err := r.serviceManager.StartNextJSServices(); err != nil {
        return err
    }
    
    log.Info("回滚完成")
    return nil
}
```

**4. 部署自动化**
```go
// 部署脚本
type DeploymentScript struct {
    serviceName string
    version     string
    backup      bool
    validate    bool
}

func (d *DeploymentScript) Execute() error {
    // 1. 健康检查
    if err := d.healthCheck(); err != nil {
        return err
    }
    
    // 2. 数据备份（如果需要）
    if d.backup {
        if err := d.backupData(); err != nil {
            return err
        }
    }
    
    // 3. 部署新版本
    if err := d.deployService(); err != nil {
        // 自动回滚
        d.rollback()
        return err
    }
    
    // 4. 验证部署
    if d.validate {
        if err := d.validateDeployment(); err != nil {
            d.rollback()
            return err
        }
    }
    
    return nil
}
```

**风险控制措施**

1. **开发质量保障**
   - 代码审查制度
   - 单元测试覆盖率要求（80%+）
   - 集成测试自动化
   - 持续集成/持续部署

2. **性能保障**
   - 性能基准测试
   - 压力测试（模拟高并发）
   - 内存泄漏检测
   - API响应时间监控

3. **上线保障**
   - 灰度发布策略
   - 实时监控告警
   - 快速回滚机制
   - 应急响应预案

**预期收益**

1. **性能提升**
   - 响应时间减少70%+
   - 并发处理能力提升50倍（从1并发到50并发）
   - 内存使用优化60%
   - 4900%整体性能提升

2. **架构优势**
   - 单体应用简化部署和运维
   - 模块化设计便于扩展
   - 统一的Go技术栈
   - 内置的管理后台系统

3. **开发效率**
   - 强类型语言减少运行时错误
   - 编译时错误检查
   - 丰富的标准库
   - 高效的并发编程模型

4. **运维便利**
   - 单一二进制文件部署
   - 内置监控和日志系统
   - 自动化部署支持
   - 完善的错误处理机制

**实施时间表**

| 阶段 | 任务 | 开始时间 | 结束时间 | 负责团队 | 停机时间 |
|------|------|----------|----------|----------|----------|
| 1 | 基础架构搭建 | 第1周 | 第2周 | 架构/运维 | 无 |
| 2 | 用户系统实现 | 第3周 | 第5周 | 后端团队 | 无 |
| 3 | BatchGo模块实现 | 第6周 | 第9周 | 后端团队 | 无 |
| 4 | SiteRankGo模块实现 | 第10周 | 第12周 | 后端团队 | 无 |
| 5 | AdsCenterGo模块实现 | 第13周 | 第16周 | 后端团队 | 无 |
| 6 | GoFly Admin管理界面 | 第17周 | 第19周 | 全栈团队 | 无 |
| 7 | 系统集成测试 | 第20周 | 第21周 | QA团队 | 无 |
| 8 | 部署上线 | 第22周 | 第22周 | 运维团队 | 无 |

**总工期：22周**
**停机时间：无需停机（全新部署）**

**数据库设计**
```sql
-- 使用GoFly标准表结构，直接创建新数据库

-- Admin模块表（管理员相关）
admin_account           -- 管理员账号表
admin_auth_role         -- 角色管理表
admin_auth_rule         -- 权限规则表
admin_login_log         -- 管理员登录日志表

-- Business模块表（业务用户相关）
business_account        -- 业务用户表（替代原users表）
business_auth_role      -- 业务角色表
business_subscription   -- 订阅管理表（替代原subscriptions表）
business_token_transaction -- Token交易表
business_token_usage   -- Token使用记录表
user_email_verification -- 用户邮箱验证表
user_invite_code        -- 用户邀请码表

-- 业务功能表
batchgo_tasks          -- BatchGo任务表
siterank_queries       -- SiteRank查询表
changelink_accounts    -- AdsCenterGo账户表
```

**详细表结构**

**管理员账号表**
```sql
CREATE TABLE admin_account (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '管理员用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码(加密存储)',
    role ENUM('ADMIN') DEFAULT 'ADMIN' COMMENT '角色',
    name VARCHAR(100) COMMENT '显示名称',
    email VARCHAR(100) COMMENT '邮箱',
    status TINYINT DEFAULT 1 COMMENT '状态:1启用,0禁用',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) COMMENT '最后登录IP',
    created_by BIGINT COMMENT '创建者ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_status (status)
);
```

**业务用户表**
```sql
CREATE TABLE business_account (
    id VARCHAR(191) PRIMARY KEY COMMENT '用户ID(CUID)',
    email VARCHAR(191) NOT NULL UNIQUE COMMENT '邮箱',
    password VARCHAR(255) COMMENT '密码(加密存储，OAuth用户为空)',
    name VARCHAR(191) COMMENT '显示名称',
    avatar VARCHAR(500) COMMENT '头像URL',
    google_id VARCHAR(100) COMMENT 'Google用户ID',
    email_verified BOOLEAN DEFAULT false COMMENT '邮箱是否验证',
    role ENUM('USER', 'ADMIN') DEFAULT 'USER' COMMENT '角色',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED') DEFAULT 'ACTIVE' COMMENT '状态',
    plan ENUM('FREE', 'PRO', 'MAX') DEFAULT 'FREE' COMMENT '当前套餐',
    tokens INT DEFAULT 0 COMMENT 'Token余额',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    last_login_ip VARCHAR(45),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_plan (plan)
);
```

**管理员登录日志表**
```sql
CREATE TABLE admin_login_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    admin_id BIGINT NOT NULL COMMENT '管理员ID',
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    login_ip VARCHAR(45) COMMENT '登录IP',
    user_agent TEXT COMMENT '用户代理',
    status TINYINT DEFAULT 1 COMMENT '状态:1成功,0失败',
    fail_reason VARCHAR(255) COMMENT '失败原因',
    INDEX idx_admin_id (admin_id),
    INDEX idx_login_time (login_time),
    INDEX idx_status (status)
);
```

**用户邮箱验证表**
```sql
CREATE TABLE user_email_verification (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(191) NOT NULL COMMENT '用户ID',
    token VARCHAR(191) NOT NULL UNIQUE COMMENT '验证令牌',
    email VARCHAR(191) NOT NULL COMMENT '待验证邮箱',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    verified_at TIMESTAMP NULL COMMENT '验证时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES business_account(id) ON DELETE CASCADE
);
```

**用户邀请码表**
```sql
CREATE TABLE user_invite_code (
    id VARCHAR(191) PRIMARY KEY COMMENT '邀请码ID(CUID)',
    code VARCHAR(20) NOT NULL UNIQUE COMMENT '邀请码',
    creator_id VARCHAR(191) NOT NULL COMMENT '创建者用户ID',
    plan_type ENUM('FREE', 'PRO', 'MAX') NOT NULL COMMENT '套餐类型',
    token_bonus INT DEFAULT 0 COMMENT '额外Token奖励',
    max_uses INT DEFAULT 1 COMMENT '最大使用次数',
    used_count INT DEFAULT 0 COMMENT '已使用次数',
    expires_at TIMESTAMP NULL COMMENT '过期时间',
    status ENUM('ACTIVE', 'EXPIRED', 'DEPLETED') DEFAULT 'ACTIVE' COMMENT '状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_creator_id (creator_id),
    INDEX idx_status (status),
    FOREIGN KEY (creator_id) REFERENCES business_account(id) ON DELETE CASCADE
);
```

**管理员角色表**
```sql
CREATE TABLE admin_auth_role (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT '角色名称',
    description VARCHAR(255) COMMENT '角色描述',
    permissions TEXT COMMENT '权限列表(JSON格式)',
    status TINYINT DEFAULT 1 COMMENT '状态:1启用,0禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_status (status)
);
```

**管理员权限规则表**
```sql
CREATE TABLE admin_auth_rule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pid BIGINT DEFAULT 0 COMMENT '父级ID',
    name VARCHAR(50) NOT NULL COMMENT '规则名称',
    title VARCHAR(50) NOT NULL COMMENT '规则标题',
    type TINYINT DEFAULT 1 COMMENT '类型:1菜单,2权限',
    status TINYINT DEFAULT 1 COMMENT '状态:1启用,0禁用',
    condition VARCHAR(255) COMMENT '规则条件',
    path VARCHAR(255) COMMENT '路由路径',
    icon VARCHAR(50) COMMENT '图标',
    component VARCHAR(255) COMMENT '组件路径',
    weight INT DEFAULT 0 COMMENT '权重',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pid (pid),
    INDEX idx_name (name),
    INDEX idx_status (status),
    INDEX idx_type (status, type)
);
```

#### 6.4.5 现有PRD和代码库的集成缺失

基于深入分析，发现以下需要完善的方面：

#### 6.4.1 系统架构现状
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
   - 缺少AdsCenterGo账户管理界面
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

**AdsCenterGo模块管理**
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
  
  // AdsCenterGo事件
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
    connectAccount: '/api/v1/changelink_accounts/connect',
    updateLinks: '/api/v1/changelinklinks/update',
    getAccounts: '/api/v1/changelink_accounts',
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
    - AdsCenterGo: 不支持
  
  Pro套餐:
    - BatchGo Basic: 100个URL/任务，前端标签页打开（无循环次数）
    - BatchGo Silent: 1,000个URL/任务，5并发（支持循环次数，HTTP+Puppeteer）
    - BatchGo Automated: 1,000个URL/任务，5并发（基于自动化规则，HTTP+Puppeteer）
    - SiteRankGo: 500个域名/次
    - AdsCenterGo: 10个Google Ads账户
  
  Max套餐:
    - BatchGo Basic: 100个URL/任务，前端标签页打开（无循环次数）
    - BatchGo Silent: 5,000个URL/任务，50并发（支持循环次数，HTTP+Puppeteer）
    - BatchGo Automated: 5,000个URL/任务，50并发（基于自动化规则，HTTP+Puppeteer）
    - SiteRankGo: 5,000个域名/次
    - AdsCenterGo: 100个Google Ads账户
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

3. **AdsCenterGo集成**
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
| v8.0 | 2025-01-10 | 完善需求描述，解决不一致问题：明确使用MySQL数据库；统一Token系统架构；细化BatchGo模式选择逻辑；明确手动充值模式 | 产品团队 |
| v9.0 | 2025-01-10 | 完善技术实现细节：添加外部API Key管理策略；完善监控和告警系统；明确所有 ambiguities；添加性能指标和部署流程 | 产品团队 |
| v10.0 | 2025-01-10 | 优化BatchGo版本描述：详细说明三种版本（Basic/Silent/Automated）的功能特性和技术实现；修正邀请奖励规则（通过邀请链接注册只获得30天Pro） | 产品团队 |
| v11.0 | 2025-01-10 | 进一步优化PRD：合并飞书Webhook到消息通知中心；定价页面增加Token购买选项；添加现有业务逻辑保护章节，确保重构不破坏核心功能 | 产品团队 |
| v12.0 | 2025-01-10 | 更新Token充值价格：小包¥99=10,000 tokens，提高大包折扣力度（中包40% off，大包67% off，超大包80% off） | 产品团队 |
| v13.0 | 2025-01-10 | 全面补充GoFly集成架构：添加业务模块管理界面、前端交互集成、权限系统集成、数据流设计和详细实施计划 | 产品团队 |
| v14.0 | 2025-01-10 | 优化系统架构：评估并选择Redis Pub/Sub替代Kafka；简化角色系统为USER和ADMIN两级；设计完整的API限流和安全机制 | 产品团队 |
| v15.0 | 2025-01-10 | 进一步简化架构：从微服务改为单体应用+模块化设计；修正Basic版本权限描述（仅支持前端标签页模式）；优化部署流程 | 产品团队 |
| v26.0 | 2025-01-10 | 修正功能名称：恢复AdsCenterGo中文名称为"自动化广告"；统一使用"批量访问"作为BatchOpen的中文名称；保持并发性能提升描述为4900% | 产品团队 |
| v27.0 | 2025-01-10 | 基于代码库深度分析，优化PRD内容：准确反映当前实现状态（Next.js+MySQL），明确功能完成度（BatchOpen✅/SiteRank✅/AdsCenterGo），保持GoFly重构目标 | 产品团队 |
| v28.0 | 2025-09-10 | 最终优化：平衡现状描述与重构目标，保持技术前瞻性同时确保文档准确性 | 产品团队 |
| v28.1 | 2025-09-10 | 更新数据库配置：明确使用MySQL 8.0而非PostgreSQL，引用docs/MustKnow.md获取详细配置信息；确认SiteRank已实现真实SimilarWeb API集成 | 产品团队 |
| v28.2 | 2025-09-10 | 全面校验并修正文档不一致性：确保技术架构描述统一；验证功能实现状态准确性；统一命名规范（BatchOpen/BatchGo, AdsCenterGo链接管理）；确认业务逻辑描述一致性；维护重构目标与现状描述的平衡 | 产品团队 |
| v28.3 | 2025-09-10 | 修正具体数值不一致：统一各版本URL限制（Basic:100/Silent:1,000/Automated:5,000）和并发数（Basic:1/Silent:5/Automated:50）；修正v15.0历史记录中Basic版本描述错误 | 产品团队 |
| v28.4 | 2025-09-10 | 明确HTTP和Puppeteer模式的代理配置要求：两种模式都必须支持代理IP和referer配置；实现每个代理IP完成一轮URL访问的轮转机制；添加代理管理相关API设计 | 产品团队 |
| v28.5 | 2025-09-10 | 深入分析GoFly Admin V3源码，全面更新GoFly集成架构：添加框架核心能力详解（MVC架构、自动路由、RBAC、自研ORM）；明确三级集成策略；修正单次任务URL数量为10/100/1000；创建独立GoFly分析文档 | 产品团队 |
| v28.6 | 2025-09-10 | 进一步优化GoFly集成细节：添加自动路由系统说明（命名约定、HTTP方法识别）；详细RBAC权限系统描述；完善ORM和中间件栈特性；更新服务列表具体实现方案 | 产品团队 |
| v28.7 | 2025-09-10 | 添加核心功能Go重构详细计划：分析3大核心功能业务逻辑，设计API兼容性保证方案，制定5阶段渐进式重构策略（总工期11周），包含风险控制措施和回滚保护机制 | 产品团队 |
| v28.8 | 2025-09-10 | 优化重构策略为直接替换模式：移除流量切换机制，改为8阶段直接替换策略（总工期13周），明确各模块停机时间（总计75分钟），简化数据迁移和回滚方案 | 产品团队 |
| v28.9 | 2025-09-10 | 进一步简化重构方案：确认3大核心功能无历史数据需要迁移，大幅缩短停机时间（总计13分钟），优化回滚机制为5分钟快速切换，无需数据备份和恢复 | 产品团队 |
| v30.2 | 2025-09-12 | 明确全新实现策略：无需数据库迁移，直接使用新MySQL数据库；移除渐进式重构，改为全新GoFly架构实现（总工期22周），系统无需迁移，直接部署新架构 | 产品团队 |
| v29.0 | 2025-09-11 | 架构评估与优化：深入评估GoFly框架的模块化设计特性，确认当前架构完全符合"Go单体应用+模块化设计"要求，更新技术架构设计章节，移除微服务描述，强调单体应用优势 | 产品团队 |
| v29.1 | 2025-09-12 | 功能模块重命名：将ChangeLinkGo更名为AdsCenterGo，统一所有相关描述和命名规范 | 产品团队 |
| v29.2 | 2025-09-12 | 统一命名规范：确保所有AdsCenter引用均使用AdsCenterGo格式，保持与BatchGo/SiteRankGo命名一致性 | 产品团队 |
| v29.3 | 2025-09-12 | 修正命名混淆：明确区分现有功能（ChangeLink）和重构版本（AdsCenterGo），添加命名说明章节，更新所有相关描述以准确反映现状 | 产品团队 |
| v30.0 | 2025-09-12 | 全面补充GoFly管理系统集成缺失：新增双管理后台架构设计、统一认证SSO、业务模块管理界面详细设计、实时数据推送增强、API网关详细设计、数据一致性管理、监控告警集成、部署运维增强，更新实施时间表为29周 | 产品团队 |
| v30.1 | 2025-09-12 | 架构优化：移除不必要的双管理后台设计，简化为单一管理后台架构，明确所有管理功能在GoFly Admin中实现，Next.js仅作为用户前端，大幅降低系统复杂度和维护成本 | 产品团队 |
| v31.0 | 2025-09-12 | 架构评估与优化：确认符合"Go单体应用+模块化设计"要求，简化认证系统为统一JWT认证，明确ORM策略为统一使用GoFly gform，优化部署架构为单一Go应用 | 产品团队 |
| v32.0 | 2025-09-12 | 文档一致性优化：修正前后不一致的描述，整合重复内容；明确登录功能（普通用户邮箱/Google OAuth，管理员账号密码无注册）；统一架构描述为Go单体应用+模块化设计；移除所有Prisma引用，统一使用GoFly gform | 产品团队 |

## 7. 架构优化总结

### 7.1 架构符合性确认

经过全面评估和优化，当前架构设计完全符合"Go单体应用+模块化设计"的核心要求：

**✅ 单体应用特征**
- 单一Go二进制文件部署
- 统一的进程空间和内存管理
- 共享数据库连接池和基础设施
- 简化的部署和运维流程

**✅ 模块化设计特征**
- 清晰的模块边界（business/、admin/、common/）
- 独立的包空间和路由前缀
- 基于接口的模块间通信
- 自动路由系统支持模块化开发

### 7.2 主要优化点

**1. 架构简化**
- 移除双管理后台设计，统一使用GoFly Admin
- 简化认证系统，采用统一JWT + Redis Session
- 明确ORM策略，统一使用GoFly gform
- 优化部署架构，单一Go应用处理所有业务逻辑

**2. 技术栈明确化**
- 后端：GoFly V3（唯一后端服务）
- 前端：Next.js（仅用户界面）
- 数据库：MySQL 8.0（全新实例）
- 缓存：Redis 7.0（会话、缓存、队列）

**3. 认证统一化**
- 用户和管理员使用同一套认证系统
- 基于角色的权限控制（USER/ADMIN）
- 统一的JWT Token，通过role字段区分权限
- 管理员通过独立入口访问管理后台

### 7.3 实施优势

**开发效率**
- GoFly提供完整的后台管理框架
- 自动CRUD生成和代码生成器
- 约定优于配置的开发模式
- 丰富的中间件和工具库

**性能优势**
- Go语言原生并发支持
- 函数调用级别的模块通信
- 共享内存，无序列化开销
- 统一的资源管理和连接池

**运维优势**
- 单一部署单元，简化CI/CD
- 统一的监控和日志收集
- 简化的故障排查和扩容
- 降低系统复杂度和维护成本

### 7.4 下一步行动计划

1. **高优先级**
   - 搭建GoFly基础架构
   - 配置新MySQL数据库
   - 实现统一认证系统

2. **中优先级**
   - 使用GoFly重新实现业务模块
   - 实现RBAC权限体系
   - 开发管理后台界面

3. **低优先级**
   - 性能优化和监控
   - 高级功能开发
   - 文档完善

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
- **ChangeLink**: 现有链接管理功能（Next.js实现），仅有UI界面
- **AdsCenterGo**: ChangeLink的Go重构版本，支持Google Ads多账户管理和自动化链接更新
- **签到**: 每日登录获得Token奖励的机制
- **邀请机制**: 用户邀请好友注册获得奖励的机制

### 8.2 参考资料
- GoFly Admin V3 文档
- AutoAds 现有系统架构文档
- 模块化架构设计模式
- 多用户 SaaS 架构最佳实践


### 3.8 GoFly 集成方案（增补，无“监控与运维”）

#### 3.8.1 目标与范围
- 目标：以 GoFly Admin V3 为唯一后端，承载业务 API 与后台运营；对前端提供与现有一致的 API 契约与体验。
- 范围：账号与认证、RBAC、配置、限流与审计、三大核心业务模块（BatchGo/SiteRankGo/AdsCenterGo）、Token/套餐/运营后台、部署与发布、迁移与切换、测试与验收、风险与里程碑。

#### 3.8.2 模块映射与职责
- 核心平台（GoFly 内建）：自动路由、JWT、RBAC、配置中心、限流、操作审计、菜单与权限、表单/表格组件、图表。
- 业务域模块（基于 GoFly 自研）：
  - 用户与订阅：用户、套餐、订阅、邀请、签到、通知、支付记录（人工）。
  - Token 计量：交易、消费、用量分析（统一 `token_balance`，交易追踪来源）。
  - BatchGo：任务、执行计划、代理池、执行结果、实时状态、历史与回放。
  - SiteRankGo：批量查询、缓存、历史、趋势与报表。
  - AdsCenterGo：账户、任务、规则引擎、执行监控、失败回滚。
- 支撑模块：缓存（Redis）、调度（Cron/延迟任务）、配置（YAML+ENV）。

#### 3.8.3 API 网关与路由策略
- 前端兼容优先：维持既有路径/契约；通过 Nginx/网关将 `/api/*` 反代至 GoFly。
- 版本化：统一以 `/api/v1` 暴露；GoFly 内部遵循“自动路由+可覆写”。
- 方法约定：`Get*`→GET、`Post*`→POST、`Put*`→PUT、`Del*`→DELETE。
- 典型接口（示例）：
  - BatchGo：`POST /api/v1/batchgo/tasks`，`POST /api/v1/batchgo/tasks/{id}/start`，`GET /api/v1/batchgo/tasks/{id}/status`
  - SiteRankGo：`POST /api/v1/siterank/query`，`GET /api/v1/siterank/history`
  - Token：`GET /api/v1/tokens/balance`，`GET /api/v1/tokens/transactions`
- 兼容路由：必要时提供“别名路由”以零改动切换前端。

#### 3.8.4 认证、会话与权限
- 用户态：JWT（短期）+ 刷新令牌（长期）；Google OAuth 回调后颁发平台 JWT；邮箱注册/验证/重置。
- 管理员态：独立后台入口（如 `/admin`）；账号密码登录（预置 admin）；与用户态完全隔离。
- RBAC：角色（user/admin）+ 细粒度权限点（模块/操作）；动态菜单与数据范围控制。
- 限流：全局/用户/接口三级限流（tollbooth）；套餐频控从“套餐权限矩阵”动态下发。
- CORS/CSRF：前端域名白名单；后台同域或独立子域部署。

#### 3.8.5 数据模型与存储
- 数据库：MySQL 8.0（新库，无迁移）；Redis 7.0（缓存/会话/令牌桶）。
- ORM：GoFly gform（软删、事务、缓存、链式查询）。
- ID 策略：对外对象用 `CUID`（VARCHAR(191)）；高频内部自增可用 BIGINT；保持索引与外键一致。
- 关键表：用户/角色/权限、plans、user_subscription、token_transactions、token_usage、invitations、check_ins、notification_template、user_notification、batchgo_*、siterank_*、adscenter_*。
- 缓存：SimilarWeb 结果多级缓存（Redis+本地）；BatchGo 任务状态与结果短期缓存；权限矩阵/配置热缓存+失效通知。

#### 3.8.6 BatchGo 实施要点
- 执行模式：
  - HTTP 模式：`net/http` 客户端 + 连接池 + KeepAlive + 超时/重试；代理支持 HTTP/HTTPS/SOCKS5；可自定义 UA/Headers/Cookies/Referer。
  - Puppeteer 模式：建议 `chromedp` 或 `go-rod` + Dockerized Chromium；上下文隔离、截图/调试、验证码与反爬兼容策略。
- 并发与调度：工作池 + 优先级队列；套餐限额（并发/URL 数量/循环次数）作为执行参数；HTTP 模式提供 10x 并发优化开关。
- 代理池：健康检查、失败熔断、轮转（FIFO，“每代理走完一轮 URL 再切换”）；失败 URL 重试与报表。
- 监控与历史：任务实时状态、成功率、响应时间、错误码统计；历史回放与导出。

#### 3.8.7 SiteRankGo 实施要点
- SimilarWeb API 封装：速率控制、幂等与重试；Key 管理与配额告警。
- 缓存策略：域名标准化、TTL 分层；批量查询并行化（受套餐与 API 限流约束）。
- 数据：历史存储、趋势序列、报表导出；响应时间目标 P95 < 500ms。

#### 3.8.8 AdsCenterGo 实施要点
- 集成：Google Ads 多账户 OAuth 授权与令牌管理；AdsPower 流程编排。
- 规则引擎：复杂替换规则可配置（审核/灰度/回滚）；执行监控与错误恢复。
- 套餐上限：Pro 10 账户、Max 100 账户；执行频控与并发随套餐下发。

#### 3.8.9 配置与环境
- 配置源：`config.yaml` + ENV 覆盖；开发态支持热更新。
- 关键 ENV：`DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`OAUTH_GOOGLE_CLIENT_ID/SECRET`、`PROXY_POOL_URLS`、`RATE_LIMIT_*`、`FEATURE_FLAGS_*`。
- 多环境：dev/staging/prod 三套；敏感信息仅用 ENV/密钥管理（不入仓）。

#### 3.8.10 部署与发布
- 形态：单体二进制 + Docker 镜像；Nginx 前置（TLS、静态、`/api` 与 `/admin` 反代）。
- 滚动策略：蓝绿/金丝雀；配置灰度开关（按用户/比例/租户）。
- 资源画像：
  - HTTP 模式：CPU 为主，内存中等。
  - Puppeteer 模式：CPU+内存+临时磁盘消耗高；Chromium 建议独立资源池/节点污点。

#### 3.8.11 迁移与切换步骤
1. 基座接入：GoFly 基座（路由/RBAC/配置/限流/审计）拉起。
2. 认证接入：Google OAuth 与邮箱注册打通，颁发平台 JWT；前端仅改 API Base（或网关映射）。
3. 套餐/Token：落库模型与后台配置页；限额与频控链路打通。
4. SiteRankGo：先行替换（低耦合），验证缓存与 NFR。
5. BatchGo HTTP：先上线 HTTP 模式，稳定后启用 Puppeteer 模式。
6. AdsCenterGo：分阶段（账户→任务→规则引擎→回滚）。
7. 运营后台：报表/审计完善；人工支付与咨询全流程。
8. 全量切换：启用兼容别名路由；关闭旧 API；保留回滚阀。

#### 3.8.12 测试与验收
- 合同测试：前端对等契约（路径/参数/响应）回归。
- 性能压测：并发 5k 用户、BatchGo 50 并发、P95 < 200ms；SimilarWeb 频控验证。
- 安全测试：JWT/OAuth、越权、数据隔离、敏感字段加密、审计完整性。
- 稳定性：任务幂等、重试、断点恢复、代理池故障注入。
- 后台 UAT：管理员后台操作链路通过。

#### 3.8.13 风险与缓解
- Puppeteer 资源与兼容：优先落地 HTTP 模式；浏览器独立资源池+限流；预热与复用策略。
- API 契约偏差：提供兼容别名路由；staging 上跑前端回归与合约测试。
- 代理质量波动：健康检查、熔断与降级；失败重试与黑名单。
- 配额与成本：SimilarWeb/代理池/Chromium 资源配额告警；动态限流与调度。

#### 3.8.14 里程碑与交付物
- M1（2 周）：GoFly 基座+认证+RBAC+配置；套餐/Token 模型与后台；前端连通自测。
- M2（2 周）：SiteRankGo 上线（缓存+报表）；BatchGo HTTP 模式（监控项与报表字段按“监控与历史”定义，不单列“监控与运维”章节）。
- M3（3 周）：BatchGo Puppeteer 模式（Docker Chromium、回放、代理池）；运营台仪表盘。
- M4（3 周）：AdsCenterGo 分阶段上线；支付咨询全链路；安全与稳定性回归；全量切换。
- 交付物：API 契约文档、配置清单、部署与发布手册、回归用例与压测报告。
