# 后台管理系统需求文档

## 项目简介

为AutoAds自动化营销平台设计并实现一个全面的后台管理系统，该系统将集成用户管理、角色权限、配置管理、套餐管理、支付系统、通知管理和API管理等核心功能。系统需要保持与现有siterank、batchopen、adscenter三大核心功能的完全兼容，并提供统一的管理界面。

## 需求列表

### 需求1：用户认证与管理系统

**用户故事：** 作为系统管理员，我希望能够管理用户的注册、登录和认证，以便控制系统访问权限和用户行为。

#### 验收标准

1. WHEN 用户访问注册页面 THEN 系统 SHALL 仅支持Gmail账号直接注册并登录
2. WHEN 用户成功登录 THEN 系统 SHALL 根据用户角色显示相应的功能权限
3. WHEN 管理员访问用户管理页面 THEN 系统 SHALL 显示所有用户信息、状态和操作记录
4. WHEN 用户访问个人中心 THEN 系统 SHALL 显示个人信息、数据统计和订阅管理
5. WHEN 系统记录用户行为 THEN 系统 SHALL 提供基础的用户行为分析和统计报告
6. WHEN 管理员查看用户行为分析 THEN 系统 SHALL 显示功能使用数据、Token消耗数据、用户活跃度统计

### 需求2：角色权限管理系统

**用户故事：** 作为超级管理员，我希望能够管理不同用户角色的权限，以便实现精细化的访问控制。

#### 验收标准

1. WHEN 系统初始化 THEN 系统 SHALL 创建普通用户、管理员用户、超级管理员用户三种角色
2. WHEN 管理员分配角色 THEN 系统 SHALL 根据角色自动分配相应的功能权限
3. WHEN 用户访问功能模块 THEN 系统 SHALL 验证用户角色权限并允许或拒绝访问
4. WHEN 角色权限变更 THEN 系统 SHALL 记录变更日志并立即生效

### 需求3：免费访问与登录控制

**用户故事：** 作为产品经理，我希望用户可以免登录访问免费功能，但需要登录才能使用核心功能，以便提高用户转化率。

#### 验收标准

1. WHEN 未登录用户访问网站 THEN 系统 SHALL 允许访问免费套餐支持的页面
2. WHEN 未登录用户尝试使用siterank功能 THEN 系统 SHALL 要求用户登录
3. WHEN 未登录用户尝试使用batchopen功能 THEN 系统 SHALL 要求用户登录
4. WHEN 未登录用户尝试使用adscenter功能 THEN 系统 SHALL 要求用户登录
5. WHEN 用户登录后 THEN 系统 SHALL 根据用户套餐显示可用功能

### 需求4：配置管理系统

**用户故事：** 作为系统管理员，我希望能够管理所有环境变量和系统配置，以便实现系统的灵活配置和热更新。

#### 验收标准

1. WHEN 管理员访问配置管理页面 THEN 系统 SHALL 显示所有环境变量的当前值和状态
2. WHEN 管理员修改环境变量 THEN 系统 SHALL 支持热更新而无需重启服务
3. WHEN 管理员配置限速参数 THEN 系统 SHALL 实时应用新的限速规则
4. WHEN 管理员配置功能权限 THEN 系统 SHALL 与套餐管理系统联动更新权限
5. WHEN 配置发生变更 THEN 系统 SHALL 记录变更日志和操作人员信息

### 需求5：套餐管理系统

**用户故事：** 作为产品经理，我希望能够管理不同的订阅套餐，以便为用户提供灵活的付费选项。

#### 验收标准

1. WHEN 系统初始化 THEN 系统 SHALL 创建免费套餐（Free）、高级套餐（Pro）、白金套餐（Max）
2. WHEN 管理员配置套餐 THEN 系统 SHALL 支持月订阅和年订阅两种计费方式
3. WHEN 管理员设置套餐权限 THEN 系统 SHALL 支持配置访问功能权限、限速和Token配额参数
4. WHEN 管理员配置Token消耗规则 THEN 系统 SHALL 支持为不同功能设置Token消耗数量
5. WHEN 用户使用功能 THEN 系统 SHALL 根据配置的Token消耗规则扣除相应Token数量并记录消耗日志
6. WHEN 用户访问价格页面 THEN 系统 SHALL 展示所有套餐内容、Token配额和引导订阅支付
7. WHEN 用户订阅套餐 THEN 系统 SHALL 自动更新用户权限和Token配额
8. WHEN 用户Token不足 THEN 系统 SHALL 提示用户升级套餐或等待Token重置

### 需求6：支付配置系统

**用户故事：** 作为财务管理员，我希望能够管理订阅和支付流程，以便处理用户的付费订阅。

#### 验收标准

1. WHEN 用户选择订阅套餐 THEN 系统 SHALL 通过Stripe处理支付流程
2. WHEN 支付成功 THEN 系统 SHALL 自动激活用户订阅并更新权限
3. WHEN 支付失败 THEN 系统 SHALL 记录失败原因并通知用户
4. WHEN 管理员配置支付方式 THEN 系统 SHALL 为PayPal等其他支付方式预留接口
5. WHEN 订阅到期 THEN 系统 SHALL 自动处理续费或降级用户权限

### 需求7：通知管理系统

**用户故事：** 作为运营人员，我希望能够管理消息推送，以便及时通知用户重要信息。

#### 验收标准

1. WHEN 管理员创建通知 THEN 系统 SHALL 支持邮件和短信两种通知方式
2. WHEN 系统事件触发 THEN 系统 SHALL 根据配置自动发送相应通知
3. WHEN 用户订阅状态变更 THEN 系统 SHALL 自动发送确认邮件
4. WHEN 支付失败 THEN 系统 SHALL 发送提醒通知给用户
5. WHEN 管理员发送批量通知 THEN 系统 SHALL 支持用户分组和定时发送

### 需求8：API管理系统

**用户故事：** 作为技术管理员，我希望能够管理API接口访问，以便控制系统的对外服务。

#### 验收标准

1. WHEN 管理员访问API管理页面 THEN 系统 SHALL 显示所有API接口的状态和使用情况
2. WHEN 管理员配置API限制 THEN 系统 SHALL 支持按用户、按接口设置访问频率限制
3. WHEN API调用超限 THEN 系统 SHALL 返回相应错误码并记录日志
4. WHEN 管理员查看API统计 THEN 系统 SHALL 提供详细的调用统计和性能分析
5. WHEN API出现异常 THEN 系统 SHALL 自动记录错误日志并发送告警

### 需求9：数据库设计与初始化

**用户故事：** 作为系统架构师，我希望设计合理的数据库结构，以便支持所有管理功能的数据存储需求。

#### 验收标准

1. WHEN 系统部署 THEN 系统 SHALL 使用PostgreSQL作为主数据库，支持环境变量配置
2. WHEN 系统启动 THEN 系统 SHALL 使用Redis作为缓存数据库，支持环境变量配置
3. WHEN 数据库初始化 THEN 系统 SHALL 创建所有必要的表结构和索引
4. WHEN 系统运行 THEN 系统 SHALL 确保数据库读写操作的正常执行
5. WHEN 数据库连接异常 THEN 系统 SHALL 提供错误处理和重连机制

### 需求10：后台管理界面

**用户故事：** 作为管理员，我希望有一个统一的后台管理界面，以便方便地管理所有系统功能。

#### 验收标准

1. WHEN 管理员访问后台 THEN 系统 SHALL 提供与首页风格一致的管理界面
2. WHEN 用户查看导航栏 THEN 系统 SHALL 在导航栏显示后台管理入口
3. WHEN 管理员登录后台 THEN 系统 SHALL 根据角色显示相应的管理模块
4. WHEN 管理员操作界面 THEN 系统 SHALL 提供直观的操作反馈和状态提示
5. WHEN 界面加载 THEN 系统 SHALL 确保响应式设计在不同设备上的良好体验

### 需求11：系统集成与第三方服务配置

**用户故事：** 作为系统集成工程师，我希望获得详细的第三方服务配置指导和集成管理功能，以便正确集成所有外部依赖并进行统一管理。

#### 验收标准

1. WHEN 管理员配置Gmail OAuth THEN 系统 SHALL 提供Google Cloud Console项目创建、OAuth 2.0客户端配置、回调URL设置的详细步骤和实时状态检测
2. WHEN 管理员配置Stripe支付 THEN 系统 SHALL 提供Stripe账户设置、API密钥获取、Webhook配置的完整指南和测试工具
3. WHEN 管理员配置SimilarWeb API THEN 系统 SHALL 提供API密钥申请流程、配额管理、错误处理的说明文档（用于siterank功能）
4. WHEN 管理员配置邮件服务 THEN 系统 SHALL 支持SMTP、SendGrid、AWS SES等多种邮件服务的配置指导和发送测试
5. WHEN 管理员配置短信服务 THEN 系统 SHALL 提供Twilio、阿里云短信等服务的集成说明和功能测试
6. WHEN 配置完成后 THEN 系统 SHALL 提供一键测试功能验证所有第三方服务的连接状态和可用性
7. WHEN 第三方服务异常 THEN 系统 SHALL 提供故障排查指南、错误诊断工具和备用方案建议
8. WHEN 管理员查看集成状态 THEN 系统 SHALL 显示所有第三方服务的连接状态、配额使用情况和性能指标

### 需求12：安全性与性能优化

**用户故事：** 作为安全工程师，我希望系统具备良好的安全性和性能，以便保护用户数据和提供良好的用户体验。

#### 验收标准

1. WHEN 用户访问系统 THEN 系统 SHALL 实施HTTPS加密和安全头配置
2. WHEN 用户登录 THEN 系统 SHALL 使用安全的会话管理和密码策略
3. WHEN 系统处理敏感数据 THEN 系统 SHALL 实施数据加密和访问控制
4. WHEN 系统负载增加 THEN 系统 SHALL 通过缓存和优化保持良好性能
5. WHEN 发生安全事件 THEN 系统 SHALL 记录安全日志并触发告警机制

### 需求13：用户行为分析与数据统计

**用户故事：** 作为产品经理，我希望能够分析用户行为和功能使用情况，以便优化产品功能和套餐配置。

#### 验收标准

1. WHEN 用户使用任何功能 THEN 系统 SHALL 记录功能使用次数、Token消耗量、成功率等基本数据
2. WHEN 管理员查看功能使用统计 THEN 系统 SHALL 显示各功能的使用频率排行和使用趋势图表
3. WHEN 管理员分析Token消耗数据 THEN 系统 SHALL 提供Token消耗分布和消耗趋势分析
4. WHEN 管理员查看用户统计 THEN 系统 SHALL 提供用户活跃度、功能偏好等基础分析
5. WHEN 系统检测异常使用模式 THEN 系统 SHALL 识别异常Token消耗、频繁调用等并发送告警
6. WHEN 系统导出分析数据 THEN 系统 SHALL 支持CSV格式的数据导出

### 需求14：Context7文档规范与AI友好架构

**用户故事：** 作为技术架构师，我希望系统采用Context7文档规范和AI友好的技术架构，以便为LLMs和AI代码编辑器提供最新、准确的文档支持，同时确保系统的稳定可靠。

#### 验收标准

1. WHEN 系统架构设计 THEN 系统 SHALL 采用Next.js + React的现代化技术栈，并遵循Context7的最新技术文档规范
2. WHEN 编写代码文档 THEN 系统 SHALL 使用Context7推荐的文档格式，确保LLMs和AI工具能够准确理解代码结构和功能
3. WHEN 集成第三方API THEN 系统 SHALL 使用Context7标准的API集成文档模板和错误处理机制说明
4. WHEN 实现用户认证 THEN 系统 SHALL 采用NextAuth.js的OAuth 2.0最佳实践，并提供Context7格式的认证流程文档
5. WHEN 处理数据库操作 THEN 系统 SHALL 使用Prisma ORM和数据库连接池管理，配备Context7规范的数据模型文档
6. WHEN 构建API接口 THEN 系统 SHALL 遵循RESTful API设计规范，并使用Context7的API文档标准确保AI工具可读性
7. WHEN 更新系统文档 THEN 系统 SHALL 保持与Context7最新文档规范的同步，确保AI代码编辑器获得准确的上下文信息
8. WHEN 代码变更时 THEN 系统 SHALL 自动更新相关的Context7格式文档，保持文档与代码的一致性

### 需求15：多环境部署与配置管理

**用户故事：** 作为DevOps工程师，我希望系统能够支持多环境部署和配置管理，以便在不同环境中正确运行和管理。

#### 验收标准

1. WHEN 系统部署到测试环境 THEN 系统 SHALL 使用localhost域名和对应的环境变量配置
2. WHEN 系统部署到预发环境 THEN 系统 SHALL 使用urlchecker.dev域名和preview环境配置
3. WHEN 系统部署到生产环境 THEN 系统 SHALL 使用autoads.dev域名和production环境配置
4. WHEN 代码推送到main分支 THEN 系统 SHALL 自动构建preview环境Docker镜像
5. WHEN 代码推送到production分支 THEN 系统 SHALL 自动构建生产环境Docker镜像
6. WHEN 管理员切换环境 THEN 系统 SHALL 自动加载对应环境的数据库连接、API密钥等配置

### 需求16：核心功能兼容性保护

**用户故事：** 作为产品负责人，我希望确保后台管理系统不会破坏现有的siterank、batchopen、adscenter三大核心功能，以便保持系统稳定性。

#### 验收标准

1. WHEN 后台管理系统上线 THEN 系统 SHALL 确保siterank功能的所有现有API和界面正常工作
2. WHEN 后台管理系统上线 THEN 系统 SHALL 确保batchopen功能的所有现有API和界面正常工作  
3. WHEN 后台管理系统上线 THEN 系统 SHALL 确保adscenter功能的所有现有API和界面正常工作
4. WHEN 管理员修改配置 THEN 系统 SHALL 验证配置变更不会影响核心功能的正常运行
5. WHEN 系统升级 THEN 系统 SHALL 提供核心功能的回归测试和兼容性验证
6. WHEN 数据库结构变更 THEN 系统 SHALL 确保现有功能的数据访问不受影响
7. WHEN 权限系统变更 THEN 系统 SHALL 保持现有功能的访问权限逻辑不变

### 需求17：数据库连接与缓存配置

**用户故事：** 作为系统管理员，我希望能够灵活配置数据库和缓存连接，以便适应不同的部署环境和性能需求。

#### 验收标准

1. WHEN 系统启动 THEN 系统 SHALL 支持通过环境变量配置PostgreSQL连接
2. WHEN 系统启动 THEN 系统 SHALL 支持通过环境变量配置Redis连接
3. WHEN 数据库连接失败 THEN 系统 SHALL 提供详细的错误信息和重连机制
4. WHEN Redis连接失败 THEN 系统 SHALL 降级到无缓存模式并记录警告日志
5. WHEN 管理员测试数据库连接 THEN 系统 SHALL 提供连接测试工具和状态监控

### 需求18：导航栏集成与界面一致性

**用户故事：** 作为用户体验设计师，我希望后台管理系统能够无缝集成到现有界面中，以便提供一致的用户体验。

#### 验收标准

1. WHEN 用户访问网站 THEN 系统 SHALL 在导航栏显示"管理后台"入口（仅对有权限的用户可见）
2. WHEN 用户访问网站 THEN 系统 SHALL 在导航栏显示"价格"tab，链接到套餐展示页面
3. WHEN 用户进入后台管理 THEN 系统 SHALL 保持与首页相同的设计风格和色彩方案
4. WHEN 用户在后台操作 THEN 系统 SHALL 使用与现有页面一致的组件库和交互模式
5. WHEN 用户切换页面 THEN 系统 SHALL 保持导航状态和面包屑导航的一致性

### 需求19：简单实用设计原则

**用户故事：** 作为产品设计师，我希望系统遵循简单实用的设计原则，以便提供高效易用的管理体验。

#### 验收标准

1. WHEN 设计系统架构 THEN 系统 SHALL 避免过度设计，采用简洁明了的模块化架构
2. WHEN 设计用户界面 THEN 系统 SHALL 优先考虑易用性和直观性，减少不必要的复杂功能
3. WHEN 实现功能模块 THEN 系统 SHALL 专注于核心需求，避免功能冗余和复杂度膨胀
4. WHEN 用户执行操作 THEN 系统 SHALL 提供清晰的操作流程和即时反馈
5. WHEN 展示数据信息 THEN 系统 SHALL 使用简洁的图表和表格，突出关键信息
6. WHEN 配置系统参数 THEN 系统 SHALL 提供合理的默认值和简化的配置选项
7. WHEN 处理错误情况 THEN 系统 SHALL 提供简明的错误信息和解决建议

### 需求20：性能监控与优化

**用户故事：** 作为性能工程师，我希望系统能够提供基础的性能监控和优化功能，以便确保系统的稳定运行。

#### 验收标准

1. WHEN 系统运行 THEN 系统 SHALL 监控API响应时间、数据库查询性能等关键指标
2. WHEN 性能指标异常 THEN 系统 SHALL 记录性能日志
3. WHEN 管理员查看性能报告 THEN 系统 SHALL 提供基础的性能仪表板
4. WHEN 系统负载增加 THEN 系统 SHALL 启用缓存策略
5. WHEN 数据库查询缓慢 THEN 系统 SHALL 识别慢查询并记录日志