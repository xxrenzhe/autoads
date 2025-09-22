# AutoAds SaaS平台重构与演进蓝图 (V-Final)

## 0. 文档说明
本文档为本次AutoAds平台重构的**唯一事实来源 (Single Source of Truth, SSOT)**。它汇总了所有关于产品、架构、技术和实施路线图的最终决策。后续如有变更，请在本文件追加“变更记录”并同步相关实现。

---

## 变更记录（2025-09-22）

本次对齐与确认的关键决策如下（与代码实现同步）：

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

## 2. 产品重新定位：Brand Bid艺术家的增长套件
我们将不再把AutoAds视为一个工具集，而是将其重新定位为一个**围绕Google Ads Brand Bid策略，引导用户完成“评估 → 优化 → 放大”增长飞轮的智能化增长套件**。

- **评估 (Evaluate)**: `siterank`是机会雷达。
- **优化 (Optimize)**: `batchopen`是转化率艺术调色盘。
- **放大 (Scale)**: `adscenter`是自动化增长引擎。

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
  planName           String   // e.g., "Pro", "Max"
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
- [ ] **导航栏**: 顶层导航将变为“**仪表盘**”、“**Offer库**”、“**工作流**”、“**博客(Blog)**”和“**计费中心**”。
- [ ] **Offer库 (`/offers`)**: 新的应用核心。一个看板或列表视图，展示所有Offers及其当前状态。
- [ ] **工作流 (`/workflows`)**: 展示可用的工作流模板，并引导用户完成整个流程。
- **后台管理 (`/console`)**:
    - **隐藏入口**: 网站前端UI（导航栏、页脚等）**不会包含任何**指向后台管理系统的链接。
    - **访问方式**: 管理员只能通过直接访问特定URL（例如 `https://app.autoads.com/console`）进入。
    - **安全保障**: Next.js的`middleware.ts`将严格校验访问`/console`路径的用户角色，非`ADMIN`用户将被重定向到404或登录页，确保了后台的安全性与隐蔽性。

### 6.2. 核心功能实现
| 功能模块 | 实现方案 (V-Final) |
| :--- | :--- |
| **“目标导向”新手引导** | 新用户登录后，出现可交互的清单组件，完成后端通过事件驱动机制自动校验并**发放Token奖励**。 |
| **“工作流模板”** | 由**Workflow服务**编排，通过发布和订阅领域事件，与`Siterank`、`Batchopen`等其他服务解耦协作。 |
| **“全局Offer库”** | 由**Offer服务**统一管理，成为所有功能的数据中心，沉淀用户核心资产。 |
| **“主动价值提醒”通知** | 一个独立的`ai-insights-worker` (Cloud Function) 定期分析**事件流**，发现风险与机会，然后发布通知事件。 |
| **“透明可控”计费中心** | 在用户个人中心聚合“我的订阅”、“Token管理”、“消费历史”三大模块。**套餐订阅与Token充值将通过客服咨询窗口（二维码）进行处理**，以简化初期支付流程。 |
| **Siterank AI机会评估** | 由**Siterank服务**实现，调用Genkit Flow，结合SimilarWeb数据和后台知识库，提供量化的、**基于数据推导**的机会得分和策略建议。 |
| **Batchopen转化率仿真** | 由**Batchopen服务**实现。用户定义期望的数据模型（总量、时长、时间分布），后端调度器将其分解为分时、分批的异步任务，交由工作单元精准执行。 |
| **Adscenter智能优化** | 由**Adscenter服务**实现，包括A/B测试规则、跨账户数据洞察（通过独立的同步Worker）、以及AI合规性预警。 |
| **Blog内容管理** | 采用 **Firebase Firestore** 存储文章。前端 Next.js 直接使用 Firebase Web SDK 读取；开发阶段可客户端渲染，生产建议结合 ISR/SSG 提升 SEO 与性能。|

---

## 7. 套餐管理与Token规则 (最终版)
此套餐设计严格遵循`prd-new-V3.md`中的基础设定，并融入了我们所有的新功能，形成清晰的价值阶梯。

| 套餐 | **核心价值** | **关键功能** | 包含Tokens |
| :--- | :--- | :--- | :--- |
| **Free (入门/试用)** | 体验核心工具 | "批量访问"(初级+静默), "网站排名"(100/次), 1个Google账户 | 1,000 |
| **Pro (专业)** | **自动化提效** | "批量访问"(+自动化), "网站排名"(500/次), 10个Google账户, **AI机会评估**, **A/B测试**, **工作流模板** | 10,000 |
| **Max (增长)** | **智能化决策** | "网站排名"(5000/次), 100个Google账户, **转化率仿真模式**, **AI合规预警**, **AI风险机会通知** | 100,000 |

**Token消耗规则**:
- `siterank`域名查询: 1 Token (缓存), 1 Token (实时)
- **`siterank` AI机会评估: 10 Token**
- `batchopen`模拟点击: 1 Token (HTTP), 2 Token (Puppeteer)
- **`adscenter` AI合规预警: 25 Token**
- **启动工作流**: 5 Token (作为启动成本，体现工作流的价值)
- **新手引导奖励**: 按步骤奖励，总计约200 Token
- **每日签到**: 10 Token

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

## 9. 分阶段实施路线图
1.  **第一阶段：地基与核心服务 (2-3个月)**
    - **目标**: 搭建好事件溯源基础设施和核心领域服务。
    - **任务**:
        - [ ] 建立事件存储与 Pub/Sub 主题。
        - [ ] 开发**Identity**和**Billing**两个核心微服务 (基础框架)。
        - [ ] 完成用户注册、登录的核心流程。
        - [ ] 完成订阅流程 (客服模式)。
    - **交付物**: 一个用户可以注册、付费的后端核心。

2.  **第二阶段：核心价值闭环 (2个月)**
    - **目标**: 上线 Offer 库与工作流，形成核心闭环；完成 Secret Manager 一致化与本地 Cloud SQL Proxy 对接；前端去 DB 化。
    - **任务**:
        - **[ ]** 开发 **Offer** 与 **Workflow** 微服务（基础版本）。
        - **[ ]** 开发 **Siterank** 与 **Batchopen** 微服务（基础版本）。
        - **[ ]** 实现“新 Offer 标准上线流程”工作流。
        - **[ ]** 前端移除 Prisma 依赖，改为调用微服务 API/读取 Firestore。
    - **交付物**: 用户可以完成“评估→优化”的 MVP 流程；统一 Secret 管理与稳定的本地/生产数据库连通。

3.  **第三阶段：智能化与放大 (2个月)**
    - **目标**: 上线 Adscenter 与 AI 功能，形成增长飞轮；迁移投影器/异步任务至 Cloud Functions；接入 API Gateway。
    - **任务**:
        - **[ ]** 开发 **Adscenter** 微服务（基础框架）。
        - **[ ]** 集成 Genkit/AI 赋能能力。
        - **[ ]** 将进程内投影器迁移为 Cloud Functions 订阅者。
        - **[ ]** 配置 Google Cloud API Gateway（JWT 策略、路由、速率限制）。
    - **交付物**: 功能完整、具备强实时与可扩展能力的智能化 SaaS 产品。

---

## 10. 未来规划与可扩展性
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
    *   SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data，这是一个免费的API，无需任何key
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
