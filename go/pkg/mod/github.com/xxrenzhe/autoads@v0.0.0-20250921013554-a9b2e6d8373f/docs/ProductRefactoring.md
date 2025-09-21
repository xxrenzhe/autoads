# AutoAds SaaS平台重构与演进蓝图 (V-Final)

## 0. 文档说明
本文档为本次AutoAds平台重构的**唯一事实来源 (Single Source of Truth, SSOT)**。它汇总了所有关于产品、架构、技术和实施路线图的最终决策。后续如有变更，请在本文件追加“变更记录”并同步相关实现。

---

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
- **导航栏**: 顶层导航将变为“**仪表盘**”、“**Offer库**”、“**工作流**”、“**博客(Blog)**”和“**计费中心**”。
- **Offer库 (`/offers`)**: 新的应用核心。一个看板或列表视图，展示所有Offers及其当前状态。
- **工作流 (`/workflows`)**: 展示可用的工作流模板，并引导用户完成整个流程。
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
| **“透明可控”计费中心** | 在用户个人中心聚合“我的订阅”、“Token管理”、“消费历史”三大模块。**Token充值**区域将同时提供“Stripe自动支付”和“联系客服”两个入口。 |
| **Siterank AI机会评估** | 由**Siterank服务**实现，调用Genkit Flow，结合SimilarWeb数据和后台知识库，提供量化的、**基于数据推导**的机会得分和策略建议。 |
| **Batchopen转化率仿真** | 由**Batchopen服务**实现。用户定义期望的数据模型（总量、时长、时间分布），后端调度器将其分解为分时、分批的异步任务，交由工作单元精准执行。 |
| **Adscenter智能优化** | 由**Adscenter服务**实现，包括A/B测试规则、跨账户数据洞察（通过独立的同步Worker）、以及AI合规性预警。 |
| **Blog内容管理** | 采用**Headless CMS** (如Contentful, Strapi, 或Firestore) 进行文章管理。Next.js前端应用通过SSG (Static Site Generation) 在构建时获取文章内容，生成静态页面，以获得最佳的性能和SEO效果。|

---

## 7. 套餐管理与Token规则 (最终版)
此套餐设计严格遵循`prd-new-V3.md`中的基础设定，并融入了我们所有的新功能，形成清晰的价值阶梯。

| 套餐 | **核心价值** | **关键功能** | 包含Tokens |
| :--- | :--- | :--- | :--- |
| **Free (入门/试用)** | 体验核心工具 | "批量访问"(初级+静默), "网站排名"(100/次), 1个Google账户 | 1,000 |
| **Pro (专业)** | **自动化提效** | "批量访问"(+自动化), "网站排名"(500/次), 10个Google账户, **AI机会评估**, **A/B测试**, **工作流模板** | 10,000 |
| **Max (增长)** | **智能化决策** | "网站排名"(5000/次), 100个Google账户, **转化率仿真模式**, **AI合规预警**, **AI风险机会通知** | 100,000 |

**Token消耗规则**:
- `siterank`域名查询: 1 Token (缓存), 5 Token (实时)
- **`siterank` AI机会评估: 10 Token**
- `batchopen`模拟点击: 1 Token (HTTP), 2 Token (Puppeteer)
- **`adscenter` AI合规预警: 25 Token**
- **启动工作流**: 5 Token (作为启动成本，体现工作流的价值)
- **新手引导奖励**: 按步骤奖励，总计约200 Token
- **每日签到**: 10 Token

---

## 8. 开发、测试与部署工作流
1.  **开发环境 (Firebase Studio)**:
    - 通过`.idx/dev.nix`配置标准化环境。
    - 使用`concurrently`实现一键启动所有本地微服务（或使用Skaffold等工具）。
    - 实现秒级的“修改-预览”反馈循环。

2.  **自动化测试 (CI/CD)**:
    - **单元/集成测试**: 每个微服务都必须有自己的测试套件。
    - **E2E测试 (Playwright)**: 在GitHub Actions中，于每次`push`后自动运行，模拟完整的用户流程。
    - **契约测试 (Pact)**: (推荐) 在微服务之间引入契约测试，确保服务间的API兼容性。

3.  **部署 (CI/CD)**:
    - `git push`到`main`分支后，**GitHub Actions**自动触发。
    - 流水线会**独立构建、测试和部署**每一个发生变更的微服务到**Cloud Run**。
    - 前端独立部署到**Firebase Hosting**。
    - 部署结束后，调用`deployments/scripts/deployment-notification.sh`发送通知。

---

## 9. 分阶段实施路线图
1.  **第一阶段：地基与核心服务 (2-3个月)**
    - **目标**: 搭建好事件溯源基础设施和核心领域服务。
    - **任务**: 建立事件存储和Pub/Sub总线；开发**Identity**和**Billing**两个核心微服务；完成用户注册、登录、支付、订阅的核心流程。
    - **交付物**: 一个用户可以注册、付费的后端核心。

2.  **第二阶段：核心价值闭环 (2个月)**
    - **目标**: 上线Offer库和工作流，形成产品核心价值闭环。
    - **任务**: 开发**Offer**和**Workflow**微服务；开发**Siterank**和**Batchopen**微服务的基础版本；实现“新Offer标准上线流程”工作流。
    - **交付物**: 用户可以完成“评估→优化”的MVP流程。

3.  **第三阶段：智能化与放大 (2个月)**
    - **目标**: 上线Adscenter和AI功能，形成增长飞轮。
    - **任务**: 开发**Adscenter**微服务，实现A/B测试和数据洞察；集成Genkit，上线所有AI赋能功能；完善通知和新手引导系统。
    - **交付物**: 一个功能完整、具备强大竞争力的智能化SaaS产品。

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
- **`sitemap.xml`**: 使用`next-sitemap`包，在每次构建后自动生成包含所有静态页面（首页、定价、博客文章等）的站点地图。
- **`robots.txt`**: 明确允许搜索引擎爬取公共页面，并禁止爬取用户特定页面（如`/offers`）。
- **结构化数据 (JSON-LD)**: 为`/pricing`页面添加`Product`和`Offer` schema；为博客文章添加`Article` schema，以增强在搜索结果中的展示效果。
- **元数据 (Metadata)**: 在Next.js中，为每个页面（特别是博客文章）动态生成唯一的、包含关键词的`<title>`和`<meta name="description">`标签。

### 11.3. 内容策略：Blog模块
Blog是吸引自然流量、建立行业权威、教育潜在用户的核心阵地。文章将从Brand Bid从业者的痛点出发，提供价值，并自然地引导至AutoAds解决方案。

---

## 附录A：推广博客文章草稿

### **文章一**

**Title**: The Silent Killer of Your Brand Bid Campaigns: Why Low CTR is Costing You More Than You Think

**SEO Keywords**: Brand Bidding, Google Ads CTR, ad click optimization, quality score

**Body**:

(800-1000 words)

*   **Introduction**: Start with a relatable story. "You've found the perfect Brand Bid offer. The payout is high, the brand is popular. You launch your Google Ads campaign, but days later, the impressions are high, but the clicks are depressingly low. Your Quality Score is tanking, and your Cost-Per-Click (CPC) is skyrocketing. What's going on?" Introduce the concept of Click-Through Rate (CTR) as the most critical, yet often misunderstood, metric in Brand Bidding.
*   **The Vicious Cycle of Low CTR**: Explain the technicals in simple terms. How Google's algorithm punishes low CTR ads with lower ad rank and higher CPCs. Use a simple chart or graphic to illustrate this downward spiral. Explain that for Brand Bidders, this is even more critical as you are competing against the brand owner themselves.
*   **Why "Normal" Clicks Aren't Enough**: Discuss the core pain point. Brand Bid campaigns often target keywords that a typical user might not search for. The organic traffic profile doesn't match the ad's targeting, leading to low relevance and low CTR. The traffic you're getting isn't "primed" to click.
*   **The Old Way: Risky & Inefficient**: Briefly touch on old methods like buying low-quality traffic, which can get your affiliate account banned and pollute your data.
*   **The AutoAds Solution: The Art of Click Optimization**: Introduce \`batchopen\` not as a "click bot", but as a "Click Profile Simulator". 
    *   **[Image: Screenshot of the BatchOpen "Scenario Presets" UI, showing options like "Simulate US Social Traffic"]**
    *   Explain how AutoAds allows you to supplement your campaigns with high-quality, geo-targeted, and contextually relevant clicks. This isn't about cheating the system; it's about aligning your ad's click profile with the audience profile that the ad network expects, making your metrics "make sense".
*   **Case Study (Hypothetical)**: "How a Campaign for 'ExampleVPN' Went from a 1% to a 7% CTR in 3 Days". Show a before-and-after graph of CTR and CPC. Detail how the user used \`batchopen\`'s "Simulate Tech Review Traffic" preset to align the click profile.
*   **Conclusion & CTA**: Summarize the argument: managing your CTR isn't a hack, it's a fundamental part of a successful Brand Bid strategy. Stop letting low CTR silently kill your profits. **Start your 14-day Pro trial with AutoAds today and take control of your ad performance.**

### **文章二**

**Title**: Flying Blind: Are You Bidding on the Right Brand Offers? A Data-Driven Approach to Affiliate Marketing

**SEO Keywords**: Brand Bid offers, affiliate marketing, SimilarWeb alternative, competitor analysis

**Body**:

(800-1000 words)

*   **Introduction**: Paint a picture of the affiliate marketer's dilemma. "You see a hot offer on an affiliate network. Everyone's talking about it. You jump in, spend weeks building a campaign, only to find the market is oversaturated, and the real traffic doesn't convert. You've been flying blind."
*   **The Problem with Gut Feeling**: Discuss how relying on network hype or gut feeling is a recipe for disaster. Introduce the need for objective, data-driven evaluation *before* investing time and money.
*   **What Data Actually Matters?**: Break down the key metrics for evaluating an offer's potential:
    1.  **Traffic Volume & Source**: Is the traffic real and from valuable geos?
    2.  **Audience Engagement**: Are users actually sticking around, or is it a bounce-fest?
    3.  **Keyword Landscape**: What are the actual keywords driving traffic? Are they high-intent? Are they too competitive?
*   **Introducing AutoAds Siterank: Your Opportunity Radar**: Present \`siterank\` as the solution. It's more than just a data dump.
    *   **[Image: Screenshot of the Siterank "AI Opportunity Score" UI, showing a high score for an example domain with the AI's reasoning.]**
    *   Explain the "AI Opportunity Score". It doesn't just show you data; it interprets it for you. It analyzes the raw numbers against our proprietary knowledge base of different industries and geos to give you a simple, actionable score.
*   **From Data to Strategy**: Show how to use the insights. "Our AI analysis shows the primary traffic is from Germany via search, with the keyword 'Günstige Flüge'. This tells you immediately that your landing page and ad copy *must* be in German and optimized for that keyword."
*   **The Workflow Advantage**: Connect it to the bigger picture. "Finding a great offer is only step one. With AutoAds, you're not just getting data; you're starting a workflow. Right from the Siterank report, you can one-click launch a \`batchopen\` task to test the offer's technical path or send it to \`adscenter\` to start building your campaign."
*   **Conclusion & CTA**: Stop wasting your budget on dead-end offers. Make data-driven decisions from day one. **Sign up for AutoAds and get 1,000 free tokens to evaluate your next big offer today.**

### **文章三**

**Title**: The Brand Bidder's Nightmare: How a Single Policy Violation Can Wipe Out Your Google Ads Empire

**SEO Keywords**: Google Ads compliance, Brand Bidding policy, avoid account suspension, ad compliance checker

**Body**:

(800-1000 words)

*   **Introduction**: Start with a story that taps into every affiliate's deepest fear. "Your campaigns are profitable. The numbers are climbing. You wake up one morning, grab your coffee, and open your Google Ads dashboard to see the dreaded red banner: 'Your account has been suspended for circumventing systems policy'. " It's the Brand Bidder's nightmare.
*   **Why Brand Bidding is a High-Stakes Game**: Explain the inherent risks. You are operating in a grey area. The line between clever marketing and a policy violation is razor-thin. Google's automated systems are unforgiving.
*   **The Hidden Dangers in Your Links**: Detail the specific problems:
    *   **Unstable Redirects**: The offer owner changes their landing page redirect chain without telling you.
    *   **Cloaking**: The offer's landing page shows one thing to Google's bots and another to users.
    *   **Forbidden Content**: The final landing page contains words or imagery that violate Google's policies (e.g., aggressive health claims).
*   **Manual Checking is Impossible**: Explain that manually checking hundreds of links across dozens of campaigns every day is not a viable strategy. You need an automated watchdog.
*   **AutoAds Adcenter: Your Automated Compliance Shield**: Introduce the \`adscenter\` AI Compliance Alert feature.
    *   **[Image: Screenshot of the Adcenter UI showing a link with a red "Compliance Risk" warning and the AI's explanation.]**
    *   Explain how it works. Before you even push a link live, our AI engine simulates a visit, analyzes the entire redirect path, and scans the final landing page content for potential policy violations.
    *   Show an example of an AI-generated warning: "'Risk Detected: The final landing page contains the phrase 'guaranteed results', which may violate Google's 'Unrealistic Promises' policy. Suggestion: Contact the offer owner for a compliant landing page.'"
*   **Beyond Compliance: A/B Testing for a Competitive Edge**: Briefly mention that once your links are safe, \`adscenter\` helps you automatically A/B test them to find the highest-performing variations, turning compliance from a defensive chore into an offensive advantage.
*   **Conclusion & CTA**: Don't leave the fate of your business to chance. Proactively protect your Google Ads accounts with automated compliance checks. **Try AutoAds Max for 14 days and let our AI be your first line of defense.**


## 附录B：重构前置检查项 (Pre-Refactoring Checklist)

为确保本文档中描述的重构方案能够高效、无中断地执行，以下为启动开发前的最终决策与准备清单。

### 一、最终技术决策与规范

1.  **API 契约 (Contracts)**
    *   **方案**: 所有微服务间的API将使用 **OpenAPI 3.0 (Swagger)** 规范进行定义。规范文件 (`openapi.yaml`) 将存放在Monorepo的相应服务目录下，作为代码的一部分进行版本控制，确保设计的统一性和契约的单一来源。

2.  **领域事件模式 (Event Schemas)**
    *   **方案**: 核心领域事件（如 `UserRegistered`, `SubscriptionStarted`）将使用 **JSON Schema** 定义。Schema文件将存放在代码库的共享目录中，供事件的生产者和消费者共同引用。

3.  **数据状态确认 (Data State Confirmation)**
    *   **方案**: **确认项目为全新构建，不存在历史用户数据**。因此，无需制定和执行数据迁移方案，这将极大简化上线流程。

4.  **配置和密钥管理 (Config & Secrets Management)**
    *   **方案**: 统一使用 **Google Secret Manager** 作为所有敏感信息（API密钥、数据库密码等）的唯一存储。Cloud Run服务将通过绑定的服务账号权限在运行时安全地拉取配置。非敏感配置将通过代码库中的配置文件管理。

### 二、产品与开发流程

1.  **UI/UX 设计流程**
    *   **方案**:
        1.  **现有UI转化**: 使用工具（如 `html-to-figma` 插件）将现有前端UI的关键页面转化为Figma设计稿，作为新设计的基础。
        2.  **新功能设计**: 所有新功能（如Offer库、工作流页面）将在Figma中完成高保真设计，并包含覆盖主要用户流程的交互原型。Figma将作为UI/UX的唯一真相来源。

2.  **开发工作流 (Solo Developer)**
    *   **方案**:
        *   **任务管理**: 所有开发任务、Bug和功能点将通过代码库的 **GitHub Issues** 进行跟踪，利用标签和项目板进行自我管理。
        *   **决策记录**: 对于重大的架构或技术栈变更，将采用 **轻量级ADR (Architecture Decision Record)** 的方式，在 `docs/adr` 目录下创建Markdown文件进行记录，以保持思路清晰和决策的可追溯性。

3.  **代码库结构**
    *   **方案**: 采用 **Monorepo** 策略，使用 **Turborepo** 进行构建和任务编排，以简化依赖管理和跨服务代码共享。

### 三、资源与环境准备

1.  **基础设施与账户**
    *   **方案**: 所有云资源和第三方服务的申请与配置，遵循 **附录C：基础设施设置指南** 中的步骤执行。该指南提供了从零开始的完整操作流程。

2.  **本地开发环境**
    *   **方案**: 项目根目录将提供一个 `docker-compose.yml` 文件，用于一键启动所有本地开发所需的服务（Go微服务、Next.js、PostgreSQL、Redis等），确保开发环境的一致性和便捷性。

3.  **初始管理员凭证**
    *   **方案**: 将在Go服务中创建一个启动脚本或CLI命令 (`go run ./cmd/admin create --username <user> --password <pass>`)，用于安全地创建第一个 `ADMIN` 账号。

---

## 附录C：基础设施设置指南 (Infrastructure Setup Guide)

本指南旨在引导你完成项目所需的所有基础设施和第三方服务的配置。请在重构过程中逐步完成。

### 1. Google Cloud Platform (GCP) 项目设置

1.  **创建项目**:
    *   登录 [Google Cloud Console](https://console.cloud.google.com/)。
    *   创建一个新的GCP项目（例如 `autoads-saas-prod`）。
    *   确保项目已关联到一个有效的结算账户。

2.  **启用 APIs**:
    *   在 "APIs & Services" > "Library" 中，搜索并启用以下API：
        *   `Cloud Run Admin API`
        *   `Artifact Registry API`
        *   `Cloud Pub/Sub API`
        *   `Secret Manager API`
        *   `Cloud SQL Admin API`
        *   `Identity and Access Management (IAM) API`

### 2. 数据库设置 (Cloud SQL for PostgreSQL)

1.  **创建实例**:
    *   导航至 "Databases" > "SQL"。
    *   创建一个新的PostgreSQL实例。
    *   **配置**:
        *   选择合适的版本（如 PostgreSQL 15）。
        *   在 "Connectivity" 选项卡中，**启用 "Private IP"** 并选择默认的VPC网络。**禁用 "Public IP"** 以增强安全性。
        *   记下创建时设置的 `postgres` 用户密码，后续将存入Secret Manager。

2.  **创建数据库**:
    *   实例创建后，在实例的 "Databases" 选项卡中，创建一个新的数据库（例如 `autoads_db`）。

### 3. 服务部署与CI/CD准备

1.  **创建服务账号 (Service Account)**:
    *   导航至 "IAM & Admin" > "Service Accounts"。
    *   创建一个服务账号（例如 `github-actions-deployer`）。
    *   授予以下角色：
        *   `Cloud Run Admin` (部署Cloud Run服务)
        *   `Storage Admin` (推送Docker镜像到Artifact Registry)
        *   `Secret Manager Secret Accessor` (拉取密钥)
        *   `Cloud SQL Client` (连接数据库)
        *   `Service Account User` (模拟服务账号)
    *   创建此服务账号的密钥（JSON格式），并下载保存。

2.  **配置 GitHub Actions**:
    *   在你的GitHub仓库 "Settings" > "Secrets and variables" > "Actions" 中：
    *   创建一个名为 `GCP_SA_KEY` 的新仓库密钥，将上一步下载的JSON密钥文件的**内容**粘贴进去。
    *   创建一个名为 `GCP_PROJECT_ID` 的新仓库变量，值为你的GCP项目ID。

3.  **创建镜像仓库 (Artifact Registry)**:
    *   导航至 "Artifact Registry"。
    *   创建一个新的Docker仓库（例如 `autoads-images`）。

### 4. 密钥与配置管理 (Secret Manager)

1.  **创建密钥**:
    *   导航至 "Security" > "Secret Manager"。
    *   为以下敏感信息创建密钥，并将对应的值存入：
        *   `POSTGRES_PASSWORD`: Cloud SQL实例的`postgres`用户密码。
        *   `DATABASE_URL`: 数据库连接字符串，格式为 `postgresql://postgres:<PASSWORD>@<PRIVATE_IP>:5432/autoads_db` (将`<PASSWORD>`和`<PRIVATE_IP>`替换为实际值)。
        *   `STRIPE_SECRET_KEY`: 你的Stripe Secret Key。
        *   `SIMILARWEB_API_KEY`: 你的SimilarWeb API Key。
        *   `NEXTAUTH_SECRET`: 一个安全的随机字符串，用于NextAuth。
        *   `INTERNAL_JWT_SECRET`: 一个安全的随机字符串，用于内部服务间认证。

### 5. 第三方服务账户

1.  **Firebase**:
    *   使用你的Google账号登录 [Firebase Console](https://console.firebase.google.com/)。
    *   创建一个新的Firebase项目，并关联到你的GCP项目。
    *   启用 **Firebase Authentication**，并配置你希望支持的登录方式（如Google、Email/Password）。
    *   启用 **Firestore** 数据库。
    *   在项目设置中，获取你的Firebase Web App配置对象，用于前端集成。

2.  **Stripe**:
    *   注册并登录 [Stripe Dashboard](https://dashboard.stripe.com/)。
    *   获取你的**测试模式** (Test mode) 的`Publishable key`和`Secret key`。

3.  **SimilarWeb**:
    *   申请并获取你的SimilarWeb API密钥。
    *   SIMILARWEB_API_URL=https://data.similarweb.com/api/v1/data，这是一个免费的API，无需任何key
