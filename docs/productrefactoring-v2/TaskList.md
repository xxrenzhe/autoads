# TaskList — 可执行任务清单（对齐 v2 / MVP）

> 说明：本清单整合 v1 的 ProductRefactoring_Tasks.md 并按 v2 SSOT 重组。建议每条任务转为 Issue，纳入 Milestone/Project 追踪。字段建议：【Owner】【依赖】【输出物】【验收】。

## 进展快照（阶段性）
- 基础设施
  - 私网数据库链路：Serverless VPC Access 连接器 + 防火墙放通（完成）
  - Pub/Sub：主题 `domain-events-prod` 与订阅（identity/offer/workflow/billing）完成
  - Secret Manager：`DATABASE_URL`（私网 DSN）与 `GOOGLE_ADS_*`（完成）
  - Cloud Build：日志切换至 `gs://autoads-build-logs-asia-northeast1`（完成）
- 服务与接口
  - Identity/Adscenter/Offer/Siterank/Workflow/Billing/Batchopen：已上线（均绑定 VPC 连接器与私网 DB；Workflow/Billing 最小实现）
  - Console：占位上线（/console/*）
- 构建与代码
  - Go 版本统一 1.25.1；Dockerfile 两段式缓存；根 .dockerignore/.gcloudignore 优化；前端独立 .dockerignore（完成）
  - 网关：扩展 docs/productrefactoring-v2/API/openapi/gateway.yaml 覆盖多服务；render-gateway-config.sh 支持多服务 URL 渲染（完成）
  - 前端发布：Cloud Run `frontend` + Hosting 重写（public → run:frontend），工作流多阶段拆分（完成）

## A. 跨领域与平台
- A1 配置中心（/console）
  - Plan/Entitlement/TokenRule/TemplateBundle 数据结构与后端接口
  - 后台 UI：功能开关、限额、Token 规则版本/灰度/审计、模板与国家曲线下发
  - 各服务订阅配置变更（Pub/Sub 或轮询）+ 本地缓存热更新
- A2 用户级数据隔离与幂等扣费
  - 以 user_id 为行级鉴权边界；接口幂等键、原子扣费、失败回滚；全链路审计
- A3 事件溯源与投影
  - Event Store（Append/Load API）、事件发布器、Projector（Cloud Functions）样例（User/Subscription）

验收示例（节选，完整模板见 TaskAcceptanceTemplate.md）：
- A1 配置中心
  - Given 管理员在 /console 修改某套餐的 TokenRule 并保存，When 客户端调用该动作，Then 后端按新版本扣费且无需重启；Given 回滚，When 再调用，Then 扣费按旧版本执行。
- A2 用户级隔离与幂等扣费
  - Given 同一用户并发触发同一动作（带幂等键），When 执行完成，Then 仅扣费一次且记录可追溯；Given 跨用户请求，Then 不得越权读取或写入对方数据。

## B. 架构与网关
- B1 API Gateway 渲染与部署脚本（x-google）（完成）
- B2 各服务 OpenAPI v3 契约提交与校验（完成/对齐：identity、billing、offers、siterank、batchopen、adscenter、workflow）

## C. 后端服务（MVP）
- C1 Identity 最小版：/me、Auth 中间件接入 Firebase Admin、健康检查
- C2 Billing：订阅/Token 明细读接口；配合扣费事件化（统一扣减 API）
- C3 Offer：CRUD + 状态机 + 事件发布；读模型聚合阶段成果
- C4 Siterank：/analyze、SimilarWeb 接入、AI 洞察、每日落地可用性巡检 Job/CF
- C5 Batchopen：点击任务模板（默认+自定义）、任务创建/查询、质量评分
- C6 Adscenter：平台绑定+用户授权；Pre-flight；批量操作（CPC/预算/URL/启停/删除）+ 快照回滚
- C7 Workflow：模板列表、启动工作流（串联评估→仿真→放大）；零配置闭环
- C8 AI Insights Worker：周期性分析事件流，产出通知
- C9 风险策略引擎：规则执行（阈值/趋势/结构/完备性）→ 动作（提示/建任务/触发工作流/自动处置）→ 去重/抑制/沙盒

验收示例：
- C4 Siterank
  - Given 输入有效 Offer URL+国家，When 发起 /siterank/analyze，Then 秒级返回快扫，深评在可接受时间返回；Given 落地不可达，Then 返回可解释的失败原因与降级策略提示。
- C6 Adscenter Pre-flight
  - Given 账号授权有效且结构完整，When 运行 /adscenter/preflight，Then 报告显示“通过”并列出关键检查项；Given 缺失回传或授权失效，Then 明确指出缺项并给出修复建议。

## D. 前端（Next.js）
- D1 导航与信息架构：Dashboard / Offer中心 / 工作流 / 计费中心 / 通知 / 博客
- D2 中间件与安全：/console 角色校验（ADMIN）
- D3 Firestore 初始化（支持 DB ID）与 Web SDK 读写（开发）/ISR（生产）
- D4 Offer 列表与详情（阶段成果画布、ROSC 趋势、下一步 CTA）
- D5 工作流页（默认模板一键启动 + 高级参数）
- D6 Siterank 评估结果视图（快扫→深评）
- D7 Batchopen 模板库与曲线拖拽编辑器（国家默认 + 自定义）
- D8 Adscenter 控制台（批量操作、Pre-flight 报告、回滚）
- D9 计费中心（订阅/限额、Token 余额与用量、消费明细、超限策略）
- D10 通知中心（机会/风险/系统，筛选/已读/直达处理）

验收示例：
- D7 Batchopen 曲线编辑器
  - Given 选择“CN 工作日”默认曲线，When 拖拽调整某小时权重，Then 总和保持 100 且越界标黄；Given 点击“恢复默认”，Then 曲线恢复至系统默认值。
- D9 计费中心
  - Given 当前套餐为 Pro，When 访问计费中心，Then 显示 Pro 的能力与剩余额度、Token 余额与周期用量；Given 超限付费策略关闭，When 超配额操作，Then 明确提示并引导升级或次日再试。

## E. 默认数据与配置
- E1 国家时间分布曲线库（首批 10–20 国；已提供 US/CN/JP 示例）
- E2 阶段模板（评估/仿真/放大/工作流）默认包与版本化

## F. CI/CD 与质量
- F1 后端增量部署（变更检测→ Cloud Build/Run）+ 冒烟（完成）
  - 拆分：meta / changes / build-images / tag-images / deploy-services；空矩阵保护；Tag 构建强制全量
  - Artifact Registry：asia‑northeast1‑docker.pkg.dev/<PROJECT>/autoads-services/<service>:<tag>
- F2 前端（Cloud Run + Hosting）发布（完成）
  - 拆分：meta / build-image / tag-image / deploy-cloudrun / deploy-hosting / summary
  - Hosting：public + rewrites → run:frontend（不走 Web Frameworks 函数化构建）
  - 容器：Next `output: 'standalone'` + `node:22-bookworm-slim`；仅生产依赖（workspace 安装）；CI 下关闭 TS/ESLint；增大 Node 堆
- F3 网关变更自动发布（完成）
  - 拆分：discover-render / publish；Job Summary 输出默认域名
- F4 基础测试策略：单测（事件/读模）、冒烟（健康/权限）、E2E（闭环主路径）（进行中）

## G. 指标与上线门槛
- G1 北极星：每周用“默认模板”跑通完整工作流的活跃 Offer 数
- G2 辅助：关键风险项已处置数量；落地页可用性合格率
- G3 MVP 门槛：零配置闭环/计费中心可见/Pre-flight 可诊断/风险告警可达并可直达处理

## H. 机会推荐（MVP）
- H1 成功范本向量化（行业/关键词/落地要素/历史曲线）
- H2 规则召回 + 排序（相似关键词/行业/地域）
- H3 推荐卡片（证据摘要）+ 加入待办

## I. 风险与回滚
- I1 Ads API 配额/速率保护（并发/队列/退避）
- I2 数据延迟与缺失标注（ROSC/同步）
- I3 变更快照与一键回滚
