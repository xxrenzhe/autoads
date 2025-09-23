# AutoAds SaaS平台重构与演进蓝图 (V-Final, 经MVP焦点讨论更新)

> 重要说明：本文件为 v1 汇总稿，最新、规范化的 SSOT 文档请参见：`docs/productrefactoring-v2/README.md`（v2 文档体系涵盖产品总纲、模块 PRD、架构、实施计划、运维、ADR 与 API 契约）。

## 0. 文档说明
本文档为本次AutoAds平台重构的**唯一事实来源 (Single Source of Truth, SSOT)**。它汇总了所有关于产品、架构、技术和实施路线图的最终决策。后续如有变更，请在本文件追加“变更记录”并同步相关实现。

---

## 变更记录（2025-09-22）

本次对齐与确认的关键决策如下（与代码实现同步）：

- 产品定位更新：AutoAds 是一个专为 Google Ads 品牌竞价（Brand Bidding）与联盟营销（Affiliate Marketing）高阶玩家打造的、集“规模放大”“效能优化”“合规审计”于一体的智能自动化 SaaS 平台。核心价值：增收、提效、避险。
- Token 使用原则：Token 仅用于平台资源计费/配额与用量扣费；不作为广告优化与复盘指标，仅在计费中心展示。
- MVP 范围确立：MVP 必须完整覆盖从“Offer 库与机会推荐”到“评估-仿真-放大-诊断”的全链路核心功能，解决 8 大核心痛点。
- 统一 Dashboard：首页展示账户健康分、风险项数量、自动化任务执行次数，支持全局→账号→Offer 三级钻取与风险卡片直达处理。
- 仿真（Batchopen）定位：核心在于“合规预热”，为新 Offer 建立稳定可信的质量与分布信号，是 MVP 必要环节。
- 诊断能力前置：Pre-flight 智能诊断器作为 Adscenter 核心能力在 MVP 阶段就提供，解决“无曝光无点击”的优化盲目问题。
- 评估（Siterank）：输入 Offer URL+国家，浏览器自动化追踪重定向获取最终落地页，结合 SimilarWeb API 与 AI 洞察产出机会评估；每日落地页可用性巡检作为内置能力。
- 仿真（Batchopen）：以“点击任务模板”降低配置难度，包含代理 IP 国家匹配、Referer、每日点击次数、点击时间分布曲线（国家上网习惯默认+拖拽自定义）、UA 多样性、地域/时区分布（与投放国家一致）。去除“试运行/预算上限/限速护栏”的文案与功能定位。
- 放大（Adscenter）：绑定包含“平台绑定 + 用户授权”两步；Pre-flight 包含 Ads 账号状态、Ads API 数据获取能力与缺失检测、结构有效性（系列/广告组/广告）、账号余额/结算、转化回传/UTM、落地有效与政策敏感项。
- 风险识别策略：内置“低曝光低点击”“高曝光低点击”“高曝光高点击（需人工核验转化有效性）”“落地页不可用”“数据缺失”等规则，并支持后台可配置阈值与动作（提示/建任务/触发工作流/自动处置/下线或删除）。
- 套餐与计费：不提供免费版本，套餐分为 Pro / Max / Elite 三档。套餐“管控功能与限额”，Token “按使用量扣费”。
- 默认模板：为“不同阶段的模板（评估/仿真/放大/工作流）”与“点击时间分布曲线”提供国家级默认选项，用户可零配置一键跑通完整工作流，也可拖拽自定义。
- 多用户与隔离：AutoAds 是多用户高并发 SaaS（无租户概念），所有配置/模板/任务/日志/报表/授权均按 user_id 级隔离；后端做强鉴权与行级过滤，Firestore 使用最小可行 Security Rules；接口幂等与原子扣费保障高并发一致性。
- 后台管理台最终形态：Next.js 路由 `/console` + `middleware.ts` 在边缘层校验 Firebase ID Token 与角色（`role=ADMIN`），前端导航不暴露入口，仅支持直达 URL；后台与前台界面风格完全独立但共享组件体系与设计变量。
- 云集成架构：不设置“集中式集成服务”。每个领域微服务自行集成 Google Cloud 与 Firebase 能力（Secret Manager、Cloud SQL、Pub/Sub、Firestore、Firebase Auth 等）。投影器/异步任务使用 Google Cloud Functions 订阅 Pub/Sub。生产接入层使用 Google Cloud API Gateway 做 JWT 校验与路由，本地使用 Nginx 反代。
- 配置与密钥：所有敏感环境变量（如数据库连接串）统一存放于 Google Cloud Secret Manager，通过 `*_SECRET_NAME` 环境变量传入 Secret 路径（例如 `DATABASE_URL_SECRET_NAME=projects/<PROJECT_ID>/secrets/DATABASE_URL/versions/latest`）。
- 数据库访问：彻底移除本地 Postgres/Redis 依赖。本地使用 Cloud SQL Auth Proxy 连接 Cloud SQL；生产使用 Cloud Run 原生连接/连接器。各服务启动时通过 Secret Manager 获取 DSN。
- Blog 内容：确定使用 Firebase Firestore 存储文章。前端 Next.js 直接使用 Firebase Web SDK 读取；开发阶段可客户端读取，生产建议结合 ISR/SSG 提升 SEO 与性能。
- 前端去 DB 化：前端不再直连业务数据库或使用 Prisma，改为“UI + 调用后端微服务 API/读取 Firestore”。逐步移除前端侧 Prisma 依赖。
- 镜像与发布：统一使用 Google Cloud Artifact Registry 存储镜像，Cloud Build 构建推送，Cloud Run 部署。

## 1. 指导原则与设计哲学
本方案的每一项决策都严格遵循项目已建立的核心思想：

- **KISS原则 (Keep It Simple, Stupid)**: 用最清晰、最直接的方式解决问题，绝不引入不必要的复杂性。
- **简化数据结构为第一要务**: 所有设计的起点，都是一个优雅、范式化、无特殊情况的数据库模型。
- **追求“好品味”**: 我们的目标是构建一个在架构、代码和产品层面都具备“好品味”的系统。
- **清晰性高于一切**: 用最笨但最清晰的方式实现，确保代码和架构的长期可维护性。
- **Git Commit纪律**: 每次有意义的更新后都进行`git commit`，保证开发过程的可追溯性。

---

## 2. 产品定位、用户与MVP定义

### 2.1. 产品定位与价值主张 (V-Final)
AutoAds是一个为联盟营销与品牌竞价高阶玩家打造的，集“机会发现、智能诊断与自动化增长”于一体的Google Ads盈利效率平台。

- 核心价值主张: 帮助用户“更快地验证新机会，更稳地放大盈利盘”。我们将“增收、提效、避险”三大价值浓缩于此，聚焦于从0到1和从1到10的增长过程。
  - 增收 (Scale): 通过“机会推荐引擎”和“批量操作”能力，帮助用户复制成功路径，突破规模化瓶颈。
  - 提效 (Optimize): 通过打通“评估-仿真-放大”的全链路工作流，极大提升新Offer的上线和迭代速度。
  - 避险 (Audit): 通过“合规仿真”和“智能诊断”，提前规避广告合规风险，并快速定位和解决广告投放中的疑难杂症。
- 方法链路：以 Offer 为中心，串联“评估（Siterank）→ 仿真（Batchopen）→ 放大（Adscenter）”。三者在产品语义上是工作流（Workflow）的三个阶段，既有独立微服务支撑，又由工作流模板统一编排。
- Token 说明：Token 仅用于平台资源计费/配额与用量扣费，不进入广告优化指标与复盘话术；仅在计费中心展示。

### 2.2. 核心用户画像与痛点分析
- 身份: 独立或小团队的联盟营销从业者、品牌竞价操盘手。
- 经验: “高阶增长者”，从“作坊式”向“工业化”转型。
- 八大痛点: 资产管理混乱、机会评估低效、增长路径断裂、规模化效率低、批量操作易错、风险后知后觉、成功不可复制、上线后优化盲目。

### 2.3. MVP（最小可行产品）定义
目标：用最小功能集完整解决 8 大痛点，形成“机会→评估→仿真→放大→诊断”的闭环。
- 模块一：智能 Offer 中心（Offer 资产库 + 机会推荐引擎）。
- 模块二：自动化评估与仿真工作流（Siterank 快扫/深评 + Batchopen 合规仿真 + 一键流转）。
- 模块三：批量操作与智能诊断控制台（多账户批量操作 + Pre-flight 智能诊断器）。
- 模块四：AI 风险与机会洞察引擎（规则识别 + AI 优化建议）。

---

## 3. 最终系统架构：领域驱动的微服务 on Cloud Run
我们将彻底告别Go单体应用的限制，采用基于领域驱动设计 (DDD) 的微服务集群架构，以获得极致的灵活性、可靠性和弹性。

```mermaid
graph TD
    subgraph 用户端
        A[用户浏览器]
    end
    
    subgraph 接入层 (Google Cloud)
        B[API Gateway / IAP]
    end

    subgraph 服务层 (Cloud Run Microservices)
        C[身份认证服务 (Identity)]
        D[计费服务 (Billing)]
        E[Offer管理服务 (Offer)]
        F[网站排名服务 (Siterank)]
        G[真实点击服务 (Batchopen)]
        H[广告中心服务 (Adscenter)]
        I[工作流服务 (Workflow)]
    end

    subgraph 数据与事件层 (Google Cloud)
        J[PostgreSQL: 事件存储 (Event Store)]
        K[PostgreSQL: 投影/读模型 (Read Models)]
        L[Pub/Sub: 领域事件总线]
        M[Cloud Functions: 异步工作单元/投影器]
    end

    A --> B
    B -- AuthN/AuthZ --> C
    B -- /billing/* --> D
    B -- /offers/* --> E
    B -- /siterank/* --> F
    B -- /batchopen/* --> G
    B -- /adscenter/* --> H
    B -- /workflows/* --> I

    C -- 发布事件 --> L
    D -- 发布事件 --> L
    E -- 发布事件 --> L
    F -- 发布事件 --> L
    G -- 发布事件 --> L
    H -- 发布事件 --> L
    I -- 发布事件 --> L

    L -- 触发 --> M
    M -- 更新 --> K

    C -- 写入事件 --> J
    D -- 写入事件 --> J
    E -- 写入事件 --> J
    F -- 写入事件 --> J
    G -- 写入事件 --> J
    H -- 写入事件 --> J
    I -- 写入事件 --> J

    C -- 读取投影 --> K
    D -- 读取投影 --> K
    E -- 读取投影 --> K
    F -- 读取投影 --> K
    G -- 读取投影 --> K
    H -- 读取投影 --> K
    I -- 读取投影 --> K
```

---

## 4. 核心技术支柱
### 4.0.1. Firestore 多数据库与前端配置
- 若项目启用了非默认数据库（如 `firestoredb`），前端需显式指定数据库 ID。
- 约定：`NEXT_PUBLIC_FIRESTORE_DB_ID=firestoredb`，前端以 Firebase Web SDK 初始化：`getFirestore(app, process.env.NEXT_PUBLIC_FIRESTORE_DB_ID)`。
- Blog 页面 / 其他 Firestore 读取均复用该配置。

### 4.1. 领域驱动设计 (DDD) 服务边界
我们将业务拆分为清晰、有边界的领域服务，每个服务都是一个独立的Cloud Run应用。

| 领域服务 (Bounded Context) | 职责 | 核心实体 (Aggregate Roots) |
| :--- | :--- | :--- |
| **身份认证 (Identity)** | 用户注册、登录、个人信息、角色管理 | `User` |
| **计费 (Billing)** | 套餐、订阅、支付、Token管理 | `Subscription`, `UserToken` |
| **Offer管理 (Offer)** | 全局Offer库的管理 | `Offer` |
| **网站排名 (Siterank)** | `siterank`功能的核心逻辑、缓存、AI评估 | `SiterankAnalysis` |
| **真实点击 (Batchopen)** | `batchopen`功能的核心逻辑、调度、仿真 | `BatchopenTask` |
| **广告中心 (Adscenter)** | `adscenter`功能的核心逻辑、Google Ads集成、A/B测试 | `AdscenterCampaign` |
| **工作流 (Workflow)** | “工作流模板”和“新手引导”的引擎 | `WorkflowInstance`, `OnboardingProgress` |

**用户认证重构方案**:
- **普通用户**: 采用 Firebase Authentication 进行注册和登录，支持多种身份验证方式（如邮箱/密码、Google、GitHub等），提供安全、便捷的用户体验，并由 Firebase 托管。
- **管理员**: 后台管理系统 (`/console`) 仅支持通过预设的初始化账号和密码登录，不提供注册功能。Next.js `middleware.ts` 配合 Firebase Auth JWT 进行角色校验，确保只有 `ADMIN` 角色能访问后台。

**多用户数据隔离**: API Gateway验证Firebase Auth JWT并注入`user_id`。每个服务在处理命令时，都**必须**使用与该`user_id`关联的聚合根ID，从根本上保证用户数据的隔离。

### 4.1.1. 环境与密钥管理（最终）
- 敏感配置统一存储在 Secret Manager（如 `DATABASE_URL`、外部 API Key 等），服务通过 `*_SECRET_NAME` 环境变量读取 Secret 引用路径。
- 本地开发：通过 Cloud SQL Auth Proxy 连接 Cloud SQL；生产：Cloud Run 使用原生连接或连接器。
- 统一约定（示例）：
  - `DATABASE_URL_SECRET_NAME=projects/<PROJECT_ID>/secrets/DATABASE_URL/versions/latest`
  - Secret 值（PostgreSQL，本地走 Proxy 主机）：`postgres://USER:PASSWORD@cloudsql-proxy:5432/DB?sslmode=disable`

### 4.1.2. Firebase Admin SDK（后端）
- 本地开发：使用服务账号 JSON 初始化（示例路径 `secrets/firebase-adminsdk.json`）。
  - Go 代码（示例）：
    - `opt := option.WithCredentialsFile(os.Getenv("FIREBASE_CREDENTIALS_FILE"))`
    - `app, _ := firebase.NewApp(ctx, nil, opt)`
- 生产（Cloud Run）：推荐使用 ADC（工作负载身份）替代下发 JSON。
  - 给 Cloud Run 服务账号授予最小权限：
    - 读取 Firestore：`roles/datastore.user`（或只读 `viewer`）
    - 管理 Firebase Auth（可选）：`roles/firebaseauth.admin`
  - 无需设置 `FIREBASE_CREDENTIALS_FILE`，Admin SDK 自动走 ADC。

### 4.0. 集成形态（最终确认）
- 不设集中式“集成服务”。每个领域微服务直接集成所需的 Google Cloud 与 Firebase 能力（Auth、Secret、SQL、Pub/Sub、Firestore 等）。
- 投影器/异步任务：使用 Google Cloud Functions 订阅 Pub/Sub 事件，更新读模型（PostgreSQL/Firestore）。
- 接入层：生产使用 Google Cloud API Gateway 对外统一入口，执行 JWT 校验与路由；本地开发使用 Nginx 反代。
- 共享能力：通过共享平台库（如 `pkg/*`）复用通用封装（Firebase Admin 中间件、Secret Manager 访问、Pub/Sub 事件发布与订阅、数据库连接）。

### 4.2. 事件溯源 (Event Sourcing) 作为事实之源
我们将用事件溯源作为整个系统的原子级事实基础。

- **事件存储 (Event Store)**: 一个PostgreSQL的`events`表，是**唯一需要写入**的核心表，记录所有不可变的领域事件。
- **读模型 (Read Models)**: 我们之前设计的所有表（`users`, `subscriptions`等）现在都变成了**只读的、可随时重建的“投影”**，用于优化查询性能。
- **工作流程**: **命令(Command)** -> **命令处理器(Handler)** -> **发布事件(Event)** -> **事件总线(Pub/Sub)** -> **投影器(Projector)** -> **更新读模型(Read Model)**。

### 4.3. Firestore 在系统管理中的应用
在重构方案中，Firestore 将作为 PostgreSQL 事件存储的有效补充，尤其在简化系统管理方面发挥关键作用：

- **实时读模型缓存与优化**: 针对前端 UI（用户仪表盘、Offer库、工作流状态、后台管理界面等）的数据展示需求，Firestore 可以作为 PostgreSQL 读模型的实时缓存层。事件处理器在更新 PostgreSQL 读模型的同时，可以同步更新 Firestore 中对应的文档，从而实现毫秒级的实时数据同步，极大地提升用户体验和管理效率，减少后端服务负载。
    - **优点**: 高效灵活的存储适应非规范化数据；实时同步减少前端开发复杂性；强大查询能力直接满足UI需求。
- **动态配置中心**:
    - **产品定价与套餐规则**: 存储产品套餐详情、Token 消耗规则等配置。管理员可以通过简单操作更新这些配置，无需重新部署，即可实现 A/B 测试、功能灰度发布等动态管理策略。
    - **特性开关 (Feature Flags)**: 管理应用级的特性开关，允许团队在运行时启用或禁用特定功能。
    - **客户端直读**: 许多配置可以直接从前端应用读取，降低了后端服务的压力。
- **用户个性化设置**:
    - `User` 模型中的 `notificationPreferences` 等用户个性化设置，可以作为独立的 Firestore 文档或子集合进行管理。用户实时更新偏好时，可以直接写入 Firestore，并即时反映在界面上，无需通过核心事件流。
- **后台管理系统数据支持**:
    - Firebase Studio (或自定义的后台管理界面) 可以直接以 Firestore 为数据源，提供高效、实时的用户、订阅、Token 交易、系统配置等数据视图，加速后台管理功能的开发和迭代。
    - 结合 Firebase Security Rules，可以为后台管理数据提供精细化的访问控制，确保数据安全。
- **轻量级审计日志与监控数据**:
    - 除了核心的 PostgreSQL 事件存储，Firestore 可用于存储和展示实时性要求较高的操作日志、系统健康快照等，便于管理员快速洞察系统运行状态和用户行为。

通过以上方式，Firestore 将助力系统管理实现**实时化、动态化、可扩展和开发运维友好**。

### 4.4. 产品市场表现分析 (Analytics Integration)
为全面跟踪产品的市场表现和用户行为，我们将集成强大的分析能力：

- **产品分析 (Product Analytics)**:
    - 集成 Google Analytics (GA4) 和 Firebase Analytics，全面跟踪用户在前端应用（Next.js）和后端服务中的行为。
    - 关键指标包括：用户注册转化率、功能使用率（如 Siterank、Batchopen、Adscenter 的使用频率和深度）、用户留存率、购买转化漏斗、Token 消耗模式等。
    - 这些数据将为产品迭代方向、功能优化和用户体验改进提供数据支持。
- **市场表现跟踪 (Marketing Performance)**:
    - 通过集成 Google Ads 转化跟踪，精确衡量不同广告系列、关键词和创意带来的用户注册、付费订阅、Offer 创建等关键转化行为。
    - 结合 UTM 参数追踪，分析不同营销渠道（如社交媒体、内容营销、邮件推广）的效果。
    - 数据将用于优化市场预算分配，提升广告投资回报率 (ROI)。

---

## 5. 数据结构 (Prisma Schema for Read Models)
这是方案的基石，遵循“简化数据结构”的原则，将所有新功能模块化。

```prisma
// --- 核心实体 ---
model User {
  id                      String    @id
  email                   String    @unique
  name                    String?
  role                    String    @default("USER") // "USER" or "ADMIN"
  createdAt               DateTime
  lastLoginAt             DateTime?
  notificationPreferences Json?
  
  // 关系投影
  subscription            Subscription?
  tokens                  UserToken?
}

model Subscription {
  id                 String   @id
  userId             String   @unique
  planId             String
  planName           String   // e.g., "Pro", "Max", "Elite"
  status             String   // "trialing", "active", "canceled"
  trialEndsAt        DateTime?
  currentPeriodEnd   DateTime
  stripeCustomerId   String?
}

model UserToken {
  userId    String @id
  balance   BigInt
  updatedAt DateTime
}

// --- 全局Offer库 (核心资产) ---
model Offer {
  id            String    @id
  userId        String
  name          String
  originalUrl   String
  status        String    // "evaluating", "optimizing", "scaling", "archived"
  siterankScore Float?
  createdAt     DateTime
  
  @@index([userId])
}

// --- 工作流与新手引导 ---
model WorkflowTemplate {
  id          String @id
  name        String @unique
  description String
  steps       Json   // 定义工作流的步骤 e.g., [{"step": 1, "module": "siterank", ...}]
}
model UserWorkflowProgress {
  id           String   @id
  userId       String
  templateId   String
  currentStep  Int
  status       String   // "in_progress", "completed"
  context      Json?    // 存储工作流过程中的数据，如siterank评估结果
  
  @@index([userId])
}
model OnboardingChecklist {
  id           String @id
  step         Int    @unique
  title        String
  description  String
  targetUrl    String
  rewardTokens Int
}
model UserChecklistProgress {
  id          String   @id
  userId      String
  stepId      String
  isCompleted Boolean
  completedAt DateTime?
  
  @@unique([userId, stepId])
}

// --- 通知系统 ---
model Notification {
  id        String   @id
  userId    String
  title     String
  content   String
  isRead    Boolean  @default(false)
  createdAt DateTime
  
  @@index([userId])
}

// --- 各功能模块的读模型 ---
model BatchopenTask {
  id               String @id
  userId           String
  offerId          String
  simulationConfig Json
  status           String // "queued", "running", "completed", "failed"
  progress         Float  @default(0)
  createdAt        DateTime
  
  @@index([userId, offerId])
}

// ... 其他如 AdscenterCampaign, SiterankAnalysis 等读模型
```

---

## 6. 产品功能与前端UI/UX设计
### 6.1. 前端UI核心变更
- 导航栏：仪表盘（Dashboard）/ Offer中心 / 工作流 / 博客 / 计费中心；全局“创建”按钮直达创建 Offer 或启动工作流。
- 仪表盘：
  - 首页三大指标：账户健康分、风险项数量、自动化任务执行次数（近7/30天）。
  - 视图层级：全局→账号→Offer 三级钻取；风险卡片一键直达对应 Offer 的“阶段成果画布”。
  - 新增模块：机会推荐引擎，展示基于“成功范本”的新机会。
- Offer中心（/offers）：Offer 卡片显示状态（评估/仿真/放大）、核心 ROSC、最近动作与下一步 CTA。
- 工作流（/workflows）：可选“默认闭环模板”，零配置一键跑通；亦支持高级参数微调。
- 后台管理（/console）：
  - 隐藏入口：前台不暴露链接，仅直达 URL。
  - 安全：middleware 在边缘校验 `role=ADMIN`，非 ADMIN 404/重定向。

### 6.2. 核心功能实现（按方法链路）
- 全局 Offer 库（核心资产中心）
  - 定义：所有投放对象（Offer）在系统内的统一资产中心，贯穿评估→仿真→放大全链路，是工作流与风险策略的“锚点”。
  - 能力：Offer 创建/归属/标签与搜索、状态机（evaluating/optimizing/scaling/archived）、最近动作与下一步 CTA、与工作流/风险/报告的关联视图。
  - API/读模型：由 Offer 服务统一管理读/写与事件发布，前端在 Offer 卡片上直达阶段成果画布各卡片（评估/仿真/放大）。

- 评估（Siterank）
  - 输入 Offer URL+国家；浏览器自动化（Puppeteer/Playwright）追踪重定向，定位最终落地页。
  - SimilarWeb API 拉取域名排名/流量/关键词；AI 输出机会评估与可执行建议（两级评估：快扫→深评）。
  - 每日落地页可用性检测：巡检可达性与重定向链变化，异常即时告警。
- 仿真（Batchopen）
  - 目标：以合规方式补足请求并模拟真实浏览器特征，构建稳定可信的质量与分布信号。
  - 点击任务模板（可复制/版本化/导入导出）：
    - 代理 IP 来源国家匹配；Referer 设置与随机化。
    - 每日点击次数与抖动。
    - 点击时间分布曲线：国家上网习惯默认（工作日/周末/节假日/均匀）+ 拖拽自定义；执行对齐当地时区。
    - UA/设备多样性权重；地域/时区分布与投放国家一致。
  - 质量监控：停留/跳出、UA/Referer/地域分布一致性、失败/拦截原因、重定向完整性；“完成度与质量评分”汇总。
  - 去除“试运行/预算上限/限速护栏”的旧设定与文案。
- 放大（Adscenter）
  - 绑定：平台绑定 + 用户授权（OAuth 范围确认）。
  - Pre-flight：Ads 账号状态、Ads 数据获取与缺失检测（API 权限/配额/同步成功率/最近同步）、结构有效性（系列/广告组/广告）、账号余额/结算、转化回传与 UTM、落地有效/政策敏感项。
  - 智能告警与处置：预算/转化/CPA 异常；自动暂停/降频（可选审批）；变更留痕与回滚。
  - 批量操作：CPC/每日预算/Final URL suffix/状态（下线/删除）跨账号/系列一键执行，支持影响预估。
- 工作流（Workflow）
  - 模板串联“评估→仿真→放大”；提供按行业/国家的默认模板，零配置可跑通，亦可极速模式直达结果。
  - 展示阶段完成度、关键成果摘要、当前阻塞与可执行动作；失败可重试、断点续跑。
  - 注：评估/仿真/放大为工作流阶段，每一阶段均提供模板与默认参数，支持复制与版本化。
- 风险识别与策略引擎
  - 规则：低曝光低点击/高曝光低点击/高曝光高点击（需人工核验转化有效性）/落地不可用/数据缺失等。
  - 动作：提示/建任务/触发工作流/自动处置（含下线/删除系列）。
  - 后台：可配置范围（全局/账号/Offer/国家）、阈值、优先级、版本与回滚；沙盒验证（仅评估影响）。

- 计费中心（透明可控）
  - 定位：聚合“我的订阅（Free/Pro/Max）”“Token 管理（余额/购买/充值）”“消费明细（按功能与对象可追溯）”三大模块，确保“能不能用”“用多少”心中有数。
  - 视图：
    - 订阅与权限：展示当前套餐的功能开关与限额剩余，说明“套餐=权限/限额”。
    - Token 与用量：展示 Token 余额与周期内的用量明细，说明“Token=按使用量扣费”，不进入优化话术。
    - 账单与审计：消费记录按动作/对象（Offer/系列/广告组）可追溯，支持导出；异常争议入口。
  - 交互：支持“超限付费执行”策略的可视化选择（若后台开启）；引导升级套餐或增购 Token；全部变更留痕可审计。

- 通知与洞察中心（Notification Center）
  - 聚合系统消息、AI 机会提醒、风险告警（预算/转化/CPA/落地可用性/数据缺失），与工作流/风险策略联动。
  - 后端由 AI Insights Worker（Cloud Functions）周期性分析事件流并发布通知；前端提供已读/筛选与一键直达处理入口。

- 新手引导（Onboarding / Checklist）
  - 登录后引导完成关键路径（创建 Offer→评估→仿真→放大）的小任务清单；完成项可发放 Token 激励（由后台配置）。
  - 与工作流模板联动，优先提供“默认闭环模板”零配置跑通。

- Blog 内容管理
  - 使用 Firestore 存储文章，开发期可直读；生产结合 ISR/SSG 增强 SEO 与首屏性能；与 Dashboard/产品功能形成内容闭环。

---

## 7. 套餐与计费 (Pro/Max/Elite + Token 按用量扣费)
原则：套餐“管控功能与限额”，Token“按使用量扣费”。我们不提供免费版本，所有用户均为付费订阅用户。套餐不作为优化指标，仅决定“能不能用、用多少”；Token 规则用于执行时的原子扣费与排队。

示例能力矩阵（后台可配置开关/限额/Token 规则，以后台为准）：

| 功能模块 | Pro 套餐 | Max 套餐 | Elite 套餐 |
| :--- | :--- | :--- | :--- |
| Offer中心 | 100个Offer上限 | 500个Offer上限 | 无上限 |
| 机会推荐引擎 | 基础推荐 | 增强推荐（含竞品动态） | 优先推荐（含市场趋势） |
| 评估(Siterank) | 每日50次快扫，10次深评 | 每日200次快扫，50次深评 | 无上限 |
| 仿真(Batchopen) | 10个可用模板，基础曲线 | 50个可用模板，高级自定义曲线 | 无上限，专用代理IP池 |
| 放大(Adscenter) | 绑定10个Ads账号 | 绑定50个Ads账号 | 无上限 |
| 批量操作 | ✓ | ✓ | ✓ |
| 智能诊断器 | 标准诊断 | 高级诊断（含AI建议） | 深度诊断（含人工专家建议） |
| 风险识别引擎 | 标准规则 | 高级规则（可自定义） | 实时预警 |
| 支持 | 邮件支持 | 优先邮件支持 | 专属客户成功经理 |

Token 默认消耗（后台可改）：

- 评估：快扫 1/次；深评（含 AI 洞察/竞品/趋势）10/次；落地巡检 0.2/次。
- 仿真：标准点击 2/次；高拟真点击 3/次。
- 放大：Pre-flight 5/次（账号/系列维度）；批量操作 1/受影响对象或 10/批次（取大者）。
- 工作流：启动 5/次（编排开销；阶段按各自规则扣）。
- 风控/报告：风险扫描 0.5/单元；导出报告 1–3/份。

后台管理能力（/console）：

- 功能开关（Feature Toggles）：按套餐启用/禁用模块与子能力。
- 限额（Quota Policies）：按用户/日/周/月计数；是否允许“超限付费执行”。
- Token 规则（Token Rules）：动作→Token 映射，版本与生效时间，灰度发布，变更审计。
- 模板与曲线库：阶段模板/点击模板/国家习惯曲线的新增/下发/回滚；标记“系统默认”。

---

## 8. 构建、测试与部署权威指南 (V2.0)

本节为项目提供标准化的构建、测试与部署流程。所有自动化脚本（CI/CD）和手动操作都应以此为准。

### 8.1. 环境准备

在开始之前，请确保您的本地环境或CI/CD Runner已完成以下配置：
1.  **安装核心工具**:
    *   `gcloud` CLI (Google Cloud SDK)
    *   `firebase-tools` CLI
    *   `docker`
    *   `pnpm`
    *   `go` (版本 >= 1.25)
2.  **认证**:
    *   运行 `gcloud auth login` 并登录您的GCP账户。
    *   运行 `firebase login` 并登录您的Firebase账户。
    *   运行 `gcloud auth configure-docker asia-northeast1-docker.pkg.dev` 来配置Docker认证。
3.  **设置项目**:
    *   运行 `gcloud config set project gen-lang-client-0944935873`。
    *   运行 `firebase use gen-lang-client-0944935873`。

### 8.2. 后端微服务部署流程 (以 `identity` 服务为例)

所有Go微服务（位于 `./services/*`）均采用相同的流程独立部署。

**第1步：构建Docker镜像**

我们使用 Google Cloud Build 在云端构建镜像，并推送到 Google Cloud Artifact Registry。

```bash
# [SERVICE_NAME] 可替换为: identity, billing, offer, 等...
SERVICE_NAME="identity"
PROJECT_ID="gen-lang-client-0944935873"
REGION="asia-northeast1"
REPO="autoads-services"
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}:latest"

gcloud builds submit "./services/${SERVICE_NAME}" --tag "${IMAGE_TAG}"
```

**第2步：部署到Cloud Run**

镜像构建成功后，我们将其部署为一个新的Cloud Run服务。

```bash
# 部署服务的初始版本
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${REGION}" \
  --platform "managed" \
  --allow-unauthenticated \
  --set-env-vars="GIN_MODE=release" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --update-env-vars="DATABASE_URL_SECRET_NAME=projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest"
```
*   `--allow-unauthenticated`: 允许公网访问。在生产环境中将通过 Google Cloud API Gateway 做 JWT/IAM 保护。
*   `--set-secrets`: 将Google Secret Manager中的密钥安全地挂载为环境变量。

**注意**: 对于后续的更新，只需重复以上两个步骤即可。Cloud Run会自动创建新的修订版本并无缝切换流量。

### 8.3. 前端应用部署流程

前端Next.js应用（位于 `./apps/frontend`）被部署为静态站点，并由Firebase Hosting提供服务。

**第1步：构建应用**

在项目根目录运行 `pnpm` 命令来构建和打包所有应用。

```bash
# 安装依赖
pnpm install

# 构建所有应用，包括前端
pnpm build
```
此命令会利用 `turbo` 来高效地执行构建流程，最终的静态文件输出位于 `apps/frontend/out` 目录。

**第2步：部署到Firebase Hosting**

使用Firebase CLI进行部署。

```bash
# 确保您在正确的Firebase项目中
firebase use gen-lang-client-0944935873

# 部署到Firebase Hosting
# --only hosting 指定只部署Hosting服务
firebase deploy --only hosting
```
部署完成后，Firebase CLI会提供一个托管URL，您可以从中访问最新的前端应用。

### 8.4. CI/CD自动化（GitHub Actions，按改动增量部署）

本项目采用“按改动增量部署 + 部署后自动冒烟”的 CI/CD：

- 后端（Cloud Run）：`.github/workflows/deploy-backend.yml`
  - 变更检测：`scripts/deploy/detect-changed-services.sh` 比较 BASE..HEAD，仅对改动的 `services/<name>` 做部署；若改动命中共享/关键目录（`pkg/**`、`go.work*`、`scripts/deploy/**`、`deployments/api-gateway/**`、工作流自身等）则触发全量。
  - 部署策略：矩阵并行（strategy.matrix.service），每个服务通过 Cloud Build 构建镜像 → 推 Artifact Registry → 部署 Cloud Run。
  - Secret 注入：部署时设置 `--set-secrets=DATABASE_URL=DATABASE_URL:latest` 与 `--update-env-vars=DATABASE_URL_SECRET_NAME=projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest`。
  - 网关与冒烟：部署完成后渲染 Gateway（自动替换 Cloud Run URL），发布 API Gateway 并执行 E2E 冒烟（见下）。

- 网关（API Gateway）：`.github/workflows/deploy-gateway.yml`
  - 触发：`deployments/api-gateway/gateway.yaml` 变更或后端服务发布完成。
  - 渲染与发布：`scripts/deploy/render-gateway.sh` + `scripts/deploy/gateway-deploy.sh`。
  - E2E 冒烟：`scripts/tests/gateway-smoke.sh`，健康 `/api/v1/identity/healthz` 预期 200；未带 JWT 访问受保护路由预期 401/403；如提供 `FIREBASE_TEST_ID_TOKEN`，带 JWT 访问受保护路由预期 200。

- 前端（Firebase Hosting）：`.github/workflows/deploy-frontend.yml`
  - 触发：`apps/frontend/**` 改动。
  - 步骤：pnpm 安装/构建 → Firebase Hosting 部署（`FirebaseExtended/action-hosting-deploy`）。

CI 需要的 GitHub Secrets（简化）：
- `GCP_PROJECT_ID`（如：gen-lang-client-0944935873）
- `GCP_REGION`（默认：asia-northeast1）
- `GCP_SA_KEY`（具备 Cloud Build / Artifact Registry / Cloud Run / API Gateway 权限的 SA JSON）
- `FIREBASE_SERVICE_ACCOUNT`（Firebase Hosting 发布用 SA JSON）
- `FIREBASE_TEST_ID_TOKEN`（可选；E2E 冒烟带 JWT 测试）

更多说明参见：`docs/deployment/CI-CD.md`。

---

## 9. 分阶段实施路线图 (已按MVP重写)
1.  第一阶段：MVP版本 - 核心价值闭环 (3-4个月)
    - 目标: 上线MVP，完整解决已识别的8大核心痛点，打通从“机会发现”到“智能诊断”的全链路工作流。
    - 核心任务:
        - [ ] 开发智能Offer中心：Offer资产库（状态、ROSC管理）与机会推荐引擎。
        - [ ] 开发自动化评估与仿真工作流：Siterank评估、Batchopen合规仿真与一键流转。
        - [ ] 开发批量操作与智能诊断控制台：Adscenter 多账户批量操作与 Pre-flight 智能诊断器。
        - [ ] 开发AI风险与机会洞察引擎：基础风险模型告警与AI优化建议。
        - [ ] 完成基础设施：事件溯源、Pub/Sub、微服务部署等。
    - 交付物: 一个功能闭环、价值主张清晰的SaaS产品。

2.  第二阶段：深化智能与数据壁垒 (2个月)
    - 目标: 增强AI能力，深化数据洞察。
    - 任务:
        - [ ] 优化机会推荐算法。
        - [ ] 增强AI优化建议的深度和广度。
        - [ ] 竞品监控功能。
        - [ ] 自定义报表与数据导出。

3.  第三阶段：探索团队协作与生态 (2个月)
    - 目标: 从个人工具扩展为团队协作平台。
    - 任务:
        - [ ] 团队空间与基于角色的权限（RBAC）。
        - [ ] 模板市场：分享工作流模板和点击曲线。
        - [ ] 对接更多第三方联盟与数据平台API。

---

## 10. 成功指标（简化版）与未来规划
北极星：每周用“默认模板”跑通完整工作流的活跃 Offer 数。

辅助（≤2 项）：
- 已处置的关键风险项数量。
- 落地页可用性合格率。

---

未来可扩展方向：
本方案采用的DDD微服务和事件溯源架构，为产品的长期发展提供了无与伦比的可扩展性。

- **增加新功能**: 当需要增加一个全新的功能（例如“广告素材AI生成服务”）时，我们只需：
    1.  创建一个新的`AdCreative`微服务。
    2.  让它订阅事件总线上已有的领域事件（如`OfferCreated`）。
    3.  增加新的`Plan`套餐权限和`TokenRule`消耗规则。
    4.  在前端增加新的UI入口。
    *这个过程完全不会影响任何现有的微服务，实现了真正的“开闭原则”。*

- **替换技术栈**: 如果未来发现某个领域用Python比Go更合适（例如，AI/ML相关的服务），我们可以用Python重写该领域的微服务，只要它遵守相同的API契约和领域事件，就可以无缝替换，而系统的其他部分完全无感。

---

## 11. SEO与内容营销策略
### 11.1. 核心关键词
- **主要关键词**: "Brand Bid automation", "Google Ads Brand Bidding", "ad click optimization tool"
- **次要关键词**: "Google Ads final URL suffix", "affiliate cloaking tool", "SimilarWeb alternative for affiliates", "ad compliance checker"
- **长尾关键词**: "how to increase CTR for Brand Bidding", "avoid Google Ads account suspension", "simulate ad clicks safely"

### 11.2. 技术SEO实施
- [ ] **`sitemap.xml`**: 使用`next-sitemap`包，在每次构建后自动生成包含所有静态页面（首页、定价、博客文章等）的站点地图。
- [ ] **`robots.txt`**: 明确允许搜索引擎爬取公共页面，并禁止爬取用户特定页面（如`/offers`）。
- **结构化数据 (JSON-LD)**: 为`/pricing`页面添加`Product`和`Offer` schema；为博客文章添加`Article` schema，以增强在搜索结果中的展示效果。
- **元数据 (Metadata)**: 在Next.js中，为每个页面（特别是博客文章）动态生成唯一的、包含关键词的`<title>`和`<meta name="description">`标签。

### 11.3. 内容策略：Blog模块
Blog 是吸引自然流量、建立行业权威、教育潜在用户的核心阵地。文章存储于 Firestore；内容从 Brand Bid 从业者痛点出发，提供可操作的实践，并自然引导到 AutoAds 解决方案。开发阶段允许客户端读取，生产建议结合 ISR/SSG 输出静态页面以增强 SEO 与首屏性能。

---

## 附录A：推广博客文章草稿
... (内容不变)

## 附录B：重构前置检查项 (Pre-Refactoring Checklist)

### 一、最终技术决策与规范
1.  [ ] **API 契约 (Contracts)**
2.  [ ] **领域事件模式 (Event Schemas)**
3.  [ ] **数据状态确认 (Data State Confirmation)**
4.  [ ] **配置和密钥管理 (Config & Secrets Management)**

### 二、产品与开发流程
1.  [ ] **UI/UX 设计流程** (基础转化)
2.  [ ] **开发工作流 (Solo Developer)**
3.  [ ] **代码库结构**

### 三、资源与环境准备
1.  [ ] **基础设施与账户** (用户已确认)
2.  [ ] **本地开发环境**
3.  [ ] **初始管理员凭证**

---

## 附录C：基础设施设置指南 (Infrastructure Setup Guide)

本指南旨在引导你完成项目所需的所有基础设施和第三方服务的配置。请在重构过程中逐步完成。

### 1. Google Cloud Platform (GCP) 项目设置
... (内容不变)

### 2. 数据库设置 (Cloud SQL for PostgreSQL)
... (内容不变)

### 3. 服务部署与CI/CD准备
... (内容不变)

### 4. 密钥与配置管理 (Secret Manager)
... (内容不变)

### 5. 第三方服务账户

1.  **Firebase**:
    *   使用你的Google账号登录 [Firebase Console](https://console.firebase.google.com/)。
    *   创建一个新的Firebase项目，并关联到你的GCP项目。
    *   启用 **Firebase Authentication**，并配置你希望支持的登录方式（如Google、Email/Password）。
    *   启用 **Firestore** 数据库。
    *   在项目设置中，获取你的Firebase Web App配置对象，用于前端集成。

2.  **SimilarWeb**:
    *   申请并获取你的SimilarWeb API密钥。
    *   SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data（公开端点，当前无需 key；如策略更新需调整）
### 8.5. Cloud Run 上的 Firebase Admin 配置
- 推荐：生产环境使用 ADC（工作负载身份），不下发 JSON。
  - 给 Cloud Run 服务账号授予：`roles/datastore.user`（读写 Firestore）、`roles/firebaseauth.admin`（如需管理用户/Claims）。
  - 后端不设置 `FIREBASE_CREDENTIALS_FILE`，Admin SDK 自动读取 ADC。
- 本地或特殊场景（不推荐生产）：使用 JSON 文件
  - 设置 `FIREBASE_CREDENTIALS_FILE=/app/secrets/firebase-adminsdk.json`，将密钥文件以只读方式挂载到容器。
  - 代码保持 `option.WithCredentialsFile` 初始化。

---

## 12. API Gateway（生产接入层）

下面给出一个最小 OpenAPI（v2）示例，启用 Firebase JWT 校验并路由到 Cloud Run 后端。Gateway 负责校验 issuer/audience，`role=ADMIN` 的细粒度授权在后端中间件完成（配合 Next.js middleware 与后端服务中间件）。

```yaml
swagger: "2.0"
info:
  title: autoads-gateway
  version: 1.0.0
schemes:
  - https
produces:
  - application/json
securityDefinitions:
  firebase:
    type: oauth2
    flow: "implicit"
    authorizationUrl: ""
    x-google-issuer: "https://securetoken.google.com/gen-lang-client-0944935873"
    x-google-jwks_uri: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
    x-google-audiences: "gen-lang-client-0944935873"
paths:
  /api/v1/offers:
    get:
      security:
        - firebase: []
      x-google-backend:
        address: https://offer-<hash>-<region>-a.run.app
      responses:
        '200': { description: OK }
    post:
      security:
        - firebase: []
      x-google-backend:
        address: https://offer-<hash>-<region>-a.run.app
      responses:
        '202': { description: Accepted }
  /api/v1/workflows/*:
    x-google-backend:
      address: https://workflow-<hash>-<region>-a.run.app
    get:
      security: [ { firebase: [] } ]
      responses: { '200': { description: OK } }
    post:
      security: [ { firebase: [] } ]
      responses: { '202': { description: Accepted } }
```

部署步骤（概览）：
1. 打包规范到 `gateway.yaml`
2. `gcloud api-gateway apis create autoads-api --project=gen-lang-client-0944935873`
3. `gcloud api-gateway api-configs create autoads-v1 --api=autoads-api --openapi-spec=gateway.yaml --project=gen-lang-client-0944935873`
4. `gcloud api-gateway gateways create autoads-gw --api=autoads-api --api-config=autoads-v1 --location=asia-northeast1 --project=gen-lang-client-0944935873`

说明：
- API Gateway 负责 JWT 校验；自定义 `role=ADMIN` 需要在后端微服务中间件中基于 Firebase Token 的自定义 Claim 再次判定。
- 对 `/console` 前端路由，继续使用 Next.js middleware（Edge）做角色限制。
