# Operations — 运维与配置（摘要）

## 部署与环境
- 后端：Cloud Build → Artifact Registry → Cloud Run；事件处理：Cloud Functions。
- 前端：Next.js → Firebase Hosting（生产建议 ISR/SSG）。
- 网关：API Gateway（JWT 校验与路由）。

## 配置与密钥
- Secret Manager：DATABASE_URL、外部 API Key 等；以 *_SECRET_NAME 注入。
- Firebase Admin：生产用 ADC，开发用 JSON（不推荐）。

## 配置中心（后台）
- 套餐/限额/Token 规则：版本、灰度、生效时间、审计。
- 模板与国家曲线库：新增/下发/回滚；标记“系统默认”。

## Runbook（例）
- 评估失败排查：SimilarWeb 限额/网络、重定向失败、降级策略。
- 批量异常回滚：通过审计快照一键回滚，生成工单与告警。
- 仿真质量偏低：检查代理/Referer/UA 权重配置与地域一致性。
