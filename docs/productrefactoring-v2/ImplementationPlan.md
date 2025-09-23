# Implementation Plan — 实施与交付

## 当前进展（阶段性汇报）
- 环境与底座（完成）
  - GCP 项目与区域：gen-lang-client-0944935873 / asia-northeast1
  - Cloud SQL（私网）+ Serverless VPC Access 连接器（cr-conn-default-ane1）+ 防火墙放通（10.8.0.0/28→5432）
  - Pub/Sub：创建主题 `domain-events-prod` 与订阅（identity/offer/workflow/billing）
  - Secret Manager：写入 `DATABASE_URL`（私网DSN）与 `GOOGLE_ADS_*`（developer token / OAuth client / MCC / test id）
  - Cloud Build 日志：切换至自管桶 `gs://autoads-build-logs-asia-northeast1` 并启用 `--gcs-log-dir`
- 服务与接口（上线/对齐）
  - Adscenter（上线）：鉴权中间件 + 账户占位 + Pre-flight 基础校验（校验 GOOGLE_ADS_*、accountId 格式）
  - Identity（上线）：Firebase 鉴权（ADC）+ 基本路由（/me/healthz），绑定私网数据库
  - Offer（上线）：/api/v1/offers（GET/POST），事件发布降级可运行
  - Siterank（上线）：新增 `/api/v1/siterank/analyze`（202）与 `/api/v1/siterank/{offerId}`（最新分析）
  - Workflow（上线，最小实现）：/api/v1/workflows/templates、/api/v1/workflows/start（202）
  - Billing（上线，最小实现）：/api/v1/billing/subscriptions/me、/tokens/me、/tokens/transactions
  - Batchopen（上线，最小实现）：/api/v1/batchopen/tasks（202）
  - Console（上线，占位）：/console/* 直达页
- 构建与交付（完成）
  - Go 版本统一 1.25.1；所有服务 Dockerfile 调整为“依赖缓存→源码构建”的两段式缓存；根 .dockerignore/.gcloudignore 优化；前端独立 .dockerignore
  - 网关模板与渲染：扩展 gateway.yaml 覆盖所有服务路径；render-gateway-config.sh 支持多服务 URL 占位符
  - API Gateway：已发布 autoads-gw-885pd7lz.an.gateway.dev，/api/health 健康返回 200，受保护路由未授权 401
  - 前端 Hosting：
    - GitHub Actions 工作流已添加（.github/workflows/deploy-frontend.yml）
    - 方案一（推荐）：Hosting 重写至 Cloud Run frontend 服务（上线后切换）
    - 方案二：Hosting frameworks（SSR）直接部署（使用 Actions 避免本地工具链冲突）

## 里程碑（对齐 MVP）
- M1（3-4 个月）：MVP 闭环
  - 智能 Offer 中心（资产/ROSC/推荐）
  - 评估与仿真工作流（Siterank/Batchopen + 一键流转）
  - 批量操作与 Pre-flight 诊断（Adscenter）
  - AI 风险与机会洞察（基础规则与建议）
  - 底座与 CI/CD（事件溯源、Pub/Sub、部署、网关、监控）
- M2（2 个月）：智能与数据壁垒
  - 机会推荐算法优化、AI 建议深化、竞品监控、自定义报表
- M3（2 个月）：协作与生态
  - 团队空间与 RBAC、模板市场、更多第三方集成

## 任务来源
- 参考：docs/ProductRefactoring_Tasks.md（既有清单）
- 新增重点：
  - 配置中心（套餐/限额/Token 规则、模板与国家曲线库）
  - 风险策略引擎与通知中心（前后端）
  - 机会推荐引擎（最小可用）

## 任务分解（MVP 必交付）
- 配置中心（/console）
  - Plan/Entitlement/TokenRule/TemplateBundle 数据结构与接口
  - 后台 UI：功能开关、限额、Token 规则版本/灰度/审计、模板与曲线下发
  - SDK/缓存：各服务订阅配置变更，热更新
- 机会推荐引擎（MVP）
  - 成功范本向量化（行业/关键词/落地页要素/历史曲线）
  - 规则召回 + 排序（相似关键词/行业/地域）
  - 推荐卡片与“加入待办”链路
- 风险策略引擎（后端）
  - 规则执行（阈值/趋势/结构/完备性）与动作（提示/建任务/触发工作流/自动处置）
  - 优先级/冲突、去重抑制、命中日志、沙盒验证
- 通知中心（前端 + Worker）
  - AI Insights Worker：事件流/读模型周期分析→通知
  - 前端聚合页与全局入口：筛选/已读/直达处理
- 仿真默认模板与国家时间分布曲线库
  - 国家曲线（工作日/周末/节假日/均匀）首批 10–20 国
  - 曲线拖拽编辑器 + 越界提示 + 恢复默认
- OpenAPI 契约（服务级）与 Gateway 规范
  - 提交各服务 openapi.yaml + 安全定义（Firebase Bearer）
  - Gateway 路由与安全策略渲染脚本
- 架构图与时序图
  - 评估/仿真/放大三条主链路的 Mermaid 序列图
  - 数据流/组件依赖图

## 上线门槛（MVP）
- 零配置可跑通“评估→仿真→放大”闭环
- 计费中心可见：订阅/限额/Token 余额与明细
- Pre-flight 能诊断“无曝光无点击”的主干问题并给出行动
- 风险告警到达并可一键直达处理

## 风险与缓解
- Ads API 配额与速率：队列/并发控制、抽样预览、回滚
- 数据延迟与缺失：显式标注、降级策略、重试/退避
- 合规边界：不提供绕过机制；失败/拦截透明化
