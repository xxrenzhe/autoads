# AutoAds 重构执行任务清单（Executable Tasks）

> 本清单基于 docs/ProductRefactoring.md（V‑Final）的最终决策，转化为可执行、可验收的任务集合，按“里程碑 → 子域/能力 → 任务项”组织。建议将每一条转为 GitHub Issue，并在里程碑与 Project 中跟踪。

## 执行约定
- 任务粒度：以“可在 0.5–2 天完成且可验收”为单位。
- 字段规范：每条任务含【Owner】【依赖】【输出物】【验收标准】。
- 分支/提交：一任务一分支；提交遵循“问题→实现→测试→文档→清理”顺序；完成即 PR。
- 安全与密钥：一律走 Secret Manager 与 ADC；禁止在代码库写入敏感信息。

## 里程碑
- M1 地基与核心服务（2–3 个月）：事件溯源底座、Identity、Billing、基础网关、前端导航骨架、用户级数据隔离与鉴权。
- M2 核心价值闭环（~2 个月）：Offer、Workflow、Siterank、Batchopen、前端去 DB 化、Secret 一致化、默认模板与国家曲线库、后台套餐/限额/Token 规则配置。
- M3 智能与放大（~2 个月）：Adscenter、风险策略引擎与批量操作、Cloud Functions 投影器、SEO/内容与分析联动。

---

## 跨领域：基础设施与平台（DevOps）
1) GCP 项目与仓库初始化
- 内容：Artifact Registry 仓库、Pub/Sub 主题、Secrets、默认区域与权限配置。
- 操作：使用 `scripts/gcp/bootstrap.sh`、`scripts/gcp/sql-ensure.sh` 完成。
- Owner：DevOps
- 依赖：GCP 账户与权限
- 输出物：可用的 Registry/Secret/SQL/Topic；记录到 docs/production-env-config.md
- 验收：脚本幂等；重复执行无报错；手动 smoke 通过。

2) Cloud SQL Auth Proxy（本地）与 Cloud Run（生产）连通
- 内容：本地通过 Proxy 连接；生产使用连接器；Secret 统一 `DATABASE_URL_SECRET_NAME`。
- Owner：DevOps
- 依赖：任务1
- 输出物：本地连接指引与 docker-compose 片段；Cloud Run 环境变量与 Secret 挂载
- 验收：本地/生产均能连通且无明文密码。

3) API Gateway 最小可用打通
- 内容：渲染与部署 `deployments/api-gateway/gateway.yaml`，替换后台地址。
- Owner：DevOps
- 依赖：Identity 服务健康检查
- 输出物：可访问的网关域名；部署脚本输出
- 验收：`/api/v1/identity/healthz` 200；受保护路由未带 JWT 返回 401/403。

4) Firebase & Firestore 初始化
- 内容：启用 Firebase 项目、Auth 登录方式、Firestore 实例（支持自定义 DB ID）。
- Owner：DevOps
- 依赖：任务1
- 输出物：前端 Web App 配置；`NEXT_PUBLIC_FIRESTORE_DB_ID`
- 验收：前端用 Web SDK 可读写（开发）；生产 ADC 生效（后端）；Firestore Security Rules 最小可行隔离；后端按 user_id 强鉴权。

---

## 事件溯源与投影（平台能力）
5) 事件表与最小事件仓库（Event Store）
- 内容：在 Cloud SQL 建立 `events` 表；提供 Append/Load API（Go pkg）。
- Owner：BE 平台
- 依赖：任务2
- 输出物：`pkg/eventstore`（Append、LoadByAggregate、LoadByType）；迁移脚本
- 验收：单元测试覆盖基本写读；幂等版本控制通过。

6) Pub/Sub 事件发布封装
- 内容：统一 `pkg/events` 发布器，约定 Topic 与消息格式（含事件元信息）。
- Owner：BE 平台
- 依赖：任务5
- 输出物：`pkg/events/publisher.go`、事件 Envelope 约定
- 验收：本地与 GCP 发布成功；错误重试策略可配置。

7) 投影器 Cloud Functions（最小版）
- 内容：Functions 订阅 Pub/Sub，更新读模型（PostgreSQL/Firestore）。
- Owner：BE 平台
- 依赖：任务6
- 输出物：`functions/projectors/*` 样例（UserCreated、SubscriptionUpdated）
- 验收：触发事件后读模型更新可见；幂等；失败有告警日志。

8) 领域事件契约仓库
- 内容：定义 `identity`, `billing`, `offer`, `siterank`, `batchopen`, `workflow`, `adscenter` 事件 schema。
- Owner：架构/BE
- 依赖：任务5
- 输出物：`docs/api/event-schemas.md` 与 `pkg/events/schemas.go`
- 验收：所有服务引用同一版本；CI 检查不一致时阻断。

---

## 后端微服务（Go / Cloud Run）
9) Identity 服务（最小版）
- 内容：健康检查；Firebase JWT 校验中间件；登录后用户首登事件。
- Owner：BE（identity）
- 依赖：任务6、任务8
- 输出物：`services/identity` 健康路由与 `/me`；集成 `pkg/middleware` 实现真实校验
- 验收：携带有效 ID Token 返回 200 与用户信息；首登触发 `UserRegistered` 事件。

10) Billing 服务（客服模式）
- 内容：订阅/Token 查询接口；手工发放/消费 Token 的命令接口（受限角色）。
- Owner：BE（billing）
- 依赖：任务8
- 输出物：`services/billing` 的 `/subscriptions/me`、`/tokens/me`、`/tokens/grant`（仅 ADMIN）
- 验收：事件驱动更新 `UserToken` 读模型；令牌变更写入 `TokenTransaction`。

11) Offer 服务（全局 Offer 库）
- 内容：创建、查询、状态更新；与 Workflow、Siterank 集成事件。
- Owner：BE（offer）
- 依赖：任务8
- 输出物：`services/offer` 的 CRUD 与事件发布
- 验收：创建 Offer 触发 `OfferCreated`；更新状态触发相应事件；读模型可查询。

12) Siterank 服务（基础版）
- 内容：SimilarWeb 数据读取（免费端点）；AI 评估 Flow 接口占位；结果持久化。
- Owner：BE（siterank）
- 依赖：任务8
- 输出物：`services/siterank` 的 `/analyze`、`/score`；事件 `SiterankCompleted`
- 验收：输入域名返回评分草案；完成后事件驱动读模型更新。

13) Batchopen 服务（基础版）
- 内容：仿真任务接入；任务状态机与事件；进度上报。
- Owner：BE（batchopen）
- 依赖：任务8
- 输出物：`services/batchopen` 的 `/tasks` 创建与查询；事件 `BatchopenTaskStarted/Completed`
- 验收：任务创建后可轮询进度；完成触发事件并更新读模型。

14) Workflow 服务（模板 + 编排）
- 内容：工作流模板读取；启动工作流命令；跨服务事件编排。
- Owner：BE（workflow）
- 依赖：任务11–13
- 输出物：`services/workflow` 的 `/workflows` 列表与启动；事件 `WorkflowStarted/Advanced/Completed`
- 验收：基于模板驱动 Siterank→Batchopen 的 MVP 闭环跑通。

15) Adscenter 服务（占位到基础版）
- 内容：占位健康接口；读模型定义；后续接入 Google Ads 同步 Worker 规划。
- Owner：BE（adscenter）
- 依赖：任务8
- 输出物：`services/adscenter` 的健康与基本资源占位路由
- 验收：可被 API Gateway 路由并通过 JWT 校验；读模型可查询。

16) Console 服务目录对齐决策
- 内容：现有 `services/console` 与“前端 /console 页面”策略对齐，决定废弃或转职责。
- Owner：架构/BE/FE
- 依赖：任务9、任务20
- 输出物：决策记录与 Issue；若废弃则标记弃用计划；若保留则定位为 Admin API 代理。
- 验收：文档化并在 CI 中移除/保留构建目标。

---

17) AI Insights Worker（通知/洞察发布）
- 内容：Cloud Functions 订阅事件流与读模型快照，周期性产出 AI 机会与风险洞察并发布通知（Notification）。
- Owner：BE 平台
- 依赖：任务8、任务9
- 输出物：`functions/insights/*`；事件到通知的映射与抑制策略；失败重试与告警
- 验收：事件命中后产生去重的高质量通知；前端能拉取并一键跳转处理。

18) 风险策略引擎（后端）
- 内容：实现可配置规则评估（阈值/趋势/结构/完备性）与动作（提示/建任务/触发工作流/自动处置），支持优先级/冲突、命中日志、版本与回滚、沙盒验证。
- Owner：BE 平台
- 依赖：任务9、任务12–16
- 输出物：`pkg/rules/*` 引擎与存储结构；评估 API；动作执行器与审计
- 验收：规则命中准确可回溯；沙盒模式不动真设置但给出影响评估。

19) Siterank 落地页可用性巡检任务
- 内容：对绑定的 Offer URL 做每日重定向链与可达性巡检；异常事件/通知发布；与 Pre-flight 复用。
- Owner：BE（siterank）
- 依赖：任务13、任务8
- 输出物：定时任务/Cloud Functions；异常分类与重试/退避策略
- 验收：异常可定位（网络/跳转/状态码/内容变更）；误报率可控。

---

## 前端（Next.js / Firebase Web SDK）
20) 导航与信息架构更新
- 内容：导航改为“仪表盘/Offer库/工作流/博客/计费中心”；移除后台入口。
- Owner：FE
- 依赖：无
- 输出物：`apps/frontend/src/app/(*)` 布局与导航组件更新
- 验收：导航显示正确；/console 不在任何可见入口。

21) /console 受限路由与 middleware 校验
- 内容：在 `middleware.ts` 对 `/console` 强制校验角色 `role=ADMIN`。
- Owner：FE
- 依赖：任务9（后端提供自定义 Claims）
- 输出物：`apps/frontend/src/middleware.ts`；`/app/console/*` 页面骨架
- 验收：非 ADMIN 访问被 404/重定向；ADMIN 正常访问。

22) Firestore 初始化与 DB ID 支持
- 内容：支持 `NEXT_PUBLIC_FIRESTORE_DB_ID`；统一初始化封装。
- Owner：FE
- 依赖：任务4
- 输出物：`apps/frontend/src/lib/firebase.ts`（或等价位置）
- 验收：开发/生产环境分别能读写（开发端可直读；生产结合 ISR/SSG）。

23) 前端去 DB 化（移除 Prisma 依赖）
- 内容：将 `apps/frontend/src/lib/services/*` 中直接访问 Prisma 的逻辑改为调用后端 API 或 Firestore 读取；移除 prisma 运行时依赖与脚本。
- Owner：FE + BE 协作
- 依赖：任务9–15
- 输出物：替换为 `fetch`/SDK 调用；删除/隔离 `scripts/db-check.js`、`prisma` 运行时路径
- 验收：构建与运行不再需要数据库直连；E2E 正常。

24) Offer 库与工作流 UI（MVP）
- 内容：Offer 列表/详情；基于模板的工作流启动/进度展示。
- Owner：FE
- 依赖：任务11、任务14
- 输出物：`/offers`、`/workflows` 页面与组件
- 验收：可创建 Offer 并启动工作流；状态实时刷新（结合读模型/Firestore）。

25) Blog 模块（Firestore 方案）
- 内容：Blog 列表/详情读取 Firestore；生产 ISR/SSG；基础 SEO 元信息。
- Owner：FE
- 依赖：任务4
- 输出物：`/blog/*` 页面与 Firestore 查询封装
- 验收：生产页面具备静态化与增量再生；开发可直读。

26) 通知中心（前端）
- 内容：系统消息、AI 机会提醒、预算/转化/CPA/落地可用性等风险聚合；筛选/已读；从通知卡片直达 Offer 画布或批量处理。
- Owner：FE
- 依赖：任务17、任务12–16
- 输出物：`/notifications` 页面与全局入口；读取 Notification 读模型/接口
- 验收：通知与风险卡片一致；操作链路顺畅无歧义。

---

## API Gateway 与安全
23) 网关配置渲染与发布流水线
- 内容：将 Cloud Run 域名注入 `deployments/api-gateway/gateway.yaml` 并发布。
- Owner：DevOps
- 依赖：任务9–15
- 输出物：`scripts/deploy/render-gateway.sh`、`scripts/deploy/gateway-deploy.sh` 调通
- 验收：受保护路由 JWT 校验通过；冒烟脚本 `scripts/tests/gateway-smoke.sh` 绿灯。

24) 后端 JWT 中间件（真实版）
- 内容：用 Firebase Admin SDK 替换占位校验（`pkg/middleware`）。
- Owner：BE 平台
- 依赖：任务4
- 输出物：`pkg/middleware/middleware.go` 完成 Token 验证与 `role` 提取
- 验收：错误 Token 拒绝；ADMIN/USER 角色可在服务端路由中判定。

---

## CI/CD 与质量
25) 后端增量部署工作流
- 内容：按服务变更构建/发布 Cloud Run；命中共享目录触发全量。
- Owner：DevOps
- 依赖：任务9–15
- 输出物：`.github/workflows/deploy-backend.yml`、检测脚本
- 验收：改动仅触发相关服务；发布后自动冒烟。

26) 前端部署工作流（Hosting）
- 内容：Next.js 构建并部署到 Firebase Hosting。
- Owner：DevOps
- 依赖：任务22
- 输出物：`.github/workflows/deploy-frontend.yml`
- 验收：每次合入自动部署并产出预览/生产地址。

27) 网关部署工作流
- 内容：变更检测并自动更新 API Gateway。
- Owner：DevOps
- 依赖：任务23
- 输出物：`.github/workflows/deploy-gateway.yml`
- 验收：网关变更自动发布且稳定。

28) 基础测试策略与准入门槛
- 内容：单测（事件与读模型）、冒烟（健康与权限）、E2E（核心流程）。
- Owner：全体
- 依赖：相关模块完成
- 输出物：`services/*` 单元测试；`scripts/tests/*` 冒烟；前端 Playwright/E2E
- 验收：PR 必须通过；新增服务附带基础测试。

---

## SEO 与内容（增长）
29) 基础 SEO 与站点地图
- 内容：根据路由输出 `<title>` 与 `<meta name="description">`；生成 sitemap 与 robots。
- Owner：FE
- 依赖：任务22
- 输出物：`apps/frontend/src/app/*` 头部生成；`next-sitemap`
- 验收：Lighthouse SEO 指标达标；sitemap 可访问。

30) Blog 内容生产与导入
- 内容：建立 Firestore 集合结构；导入首批文章；渲染卡片/详情页。
- Owner：产品/运营 + FE
- 依赖：任务22
- 输出物：文章 10–20 篇与封面资源；分类/标签策略
- 验收：搜索索引收录；页面性能与首屏合格。

---

## 产品与计费（套餐/Token）
31) 后台套餐/限额/Token 规则配置中心
- 内容：在 `/console` 提供 Free/Pro/Max 的功能开关、限额与 Token 规则配置；支持版本化/灰度生效/审计；变更通知各服务缓存刷新。
- Owner：BE + FE + 产品
- 依赖：任务4、任务10
- 输出物：Plan/Entitlement/TokenRule/TemplateBundle 数据结构与管理界面；订阅与缓存机制
- 验收：配置改动无需重发版即可灰度生效；安全审计与回滚可靠。

32) Token 规则落地与核算
- 内容：在 Siterank/Batchopen/Adscenter/Workflow 消耗 Token；Billing 统一扣减。
- Owner：BE（各服务）
- 依赖：任务10、任务12–15
- 输出物：统一扣减 API 与事件；读模型汇总视图
- 验收：任一功能调用后余额正确变化且可追溯。

35) 默认阶段模板与国家时间分布曲线库
- 内容：预置“评估/仿真/放大/工作流”阶段模板与国家上网习惯曲线；支持拖拽自定义、导入/导出与版本化；标记“系统默认”。
- Owner：产品/FE/BE
- 依赖：任务14、任务15
- 输出物：模板与曲线库数据结构、前端编辑器与默认选项、下发/回滚机制
- 验收：零配置可跑通完整工作流；模板变更可灰度生效。

36) 计费中心前端（透明可控）
- 内容：在前端实现“订阅/权限与限额”“Token 余额与用量明细”“消费账单与导出/申诉”三视图；结合后台策略支持“超限付费执行”的引导与确认。
- Owner：FE + BE（billing）
- 依赖：任务11、任务31、任务32
- 输出物：`/billing` 或“计费中心”页面与组件；调用 Billing/Token 读模型与明细 API
- 验收：
  - 展示当前套餐可用能力与剩余额度；
  - 展示 Token 余额与周期明细；
  - 消费记录可按动作/对象（Offer/系列/广告组）追溯并导出；
  - 若开启“超限付费执行”，前端给出清晰提示与操作路径。

---

## 运营与分析
33) GA4/Firebase Analytics 集成
- 内容：关键页面与事件打点；转化路径与漏斗配置。
- Owner：FE + 数据
- 依赖：任务17–22
- 输出物：分析方案与前端埋点；数据看板
- 验收：能看到注册、Offer 创建、工作流启动等指标。

34) Google Ads 转化追踪（可选）
- 内容：广告来源 UTM 与转化事件绑定；回传配置。
- Owner：市场/FE
- 依赖：任务33
- 输出物：转化设置文档与代码
- 验收：广告系列效果可量化评估。

---

## 风险与待确认
- `services/console` 与前端 `/console` 的职责冲突需决策（任务16）。
- Adscenter 与 Google Ads 授权与配额需评估。
- Cloud Functions 成本与并发限制；必要时迁回 Cloud Run Worker。
- 前端去 DB 化的渐进式迁移影响范围较大，需分模块推进并保留回滚方案。

---

## 成功指标（简化）
- 北极星：每周用“默认模板”跑通完整工作流的活跃 Offer 数
- 辅助（≤2 项）：关键风险项已处置数量；落地页可用性合格率

---

## 任务模板（用于创建 Issue）
- 标题：模块/能力 - 目标 - 简述
- 背景：问题与上下文
- 目标：完成后用户可获得的价值
- 变更点：代码路径与接口
- 步骤：1) 2) 3)
- 依赖：上游/下游任务
- 输出物：代码/配置/文档
- 验收标准：可量化校验项
- 风险与回滚：潜在影响与应对
27) Dashboard 健康分与风险卡片
- 内容：实现健康分计算器（可配权重：合规/稳定性/数据完备性/风险命中）与风险卡片分组显示，提供一键直达处理。
- Owner：FE + BE
- 依赖：任务18、任务26
- 输出物：健康分服务端计算与前端可视化组件；卡片到处理入口的路由
- 验收：健康分与风险卡片与规则引擎结果一致；性能稳定。
