# Implementation Tracker (P0/P1/P2)

This tracker mirrors docs/ArchitectureOptimization05.md gates, ensuring no gaps between design and code.

## P0 – Pre-release (in progress)
- [x] Single middleware: inject x-request-id; fix /api/auth/csrf CORS
- [x] Add unified BFF: /api/go/[...path] → BACKEND_URL (X-BFF-Enforced; request-id passthrough)
- [x] Remove legacy middlewares (edge/admin/csrf duplicates)
- [x] Map critical public APIs to /api/go – owner: FE
  - [x] SiteRank: rank, batch, batch-minimal
  - [x] BatchOpen: silent-start, silent-progress, silent-terminate, version, proxy-url-validate
  - [x] AdsCenter: accounts, configurations, executions
- [x] Verify headers contract (x-request-id & X-BFF-Enforced) via integration test – owner: FE
- [x] Add readiness gating in /api/go (503 + Retry-After on not ready) – owner: FE
- [x] Add passthrough test for X-RateLimit-* headers – owner: FE

## P1 – Backend consolidation
- [ ] Go implements BatchOpen (basic/silent/autoclick w/ dynamic http→puppeteer), SiteRank, AdsCenter
- [x] Go: add /api/v1/batchopen/start|progress|terminate|version|proxy-url-validate (compat, reuse legacy handlers)
- [x] Go: add /api/v1/batchgo/tasks/{id}/start|stop|terminate with real cancellation for silent
- [x] Go: SiteRank /api/v1/siterank/rank|batch (+ batch:check|batch:execute), with caching + token checks
- [x] Go: AdsCenter v1 minimal – /api/v1/adscenter/accounts|configurations|executions (billing via chengelink.update_ads)
- [x] BatchGo: add silent fail_rate_threshold to spawn AutoClick fallback task
- [x] DB: Auto-migrate BatchOpen unified tables (batch_jobs, batch_job_items, batch_job_progress)
- [x] Billing: AdsCenter dedicated rule adscenter.update + staged per-item deduction
- [x] Next API routes forward (thin wrappers) and begin removing Node executors
- [ ] Admin features complete; SystemConfig write path removed; read-only window planned
- [x] SiteRank frontend service forced to backend only
- [x] Puppeteer visitor stubbed; task-execution-service minimized (tools only)
- [x] silentBatchTaskManager.terminateTask proxies to API
- [x] Contract tests for siterank/batchopen/adscenter forward mapping

## P2 – Performance & cleanup
- [ ] k6/Vegeta baseline meets SLO; readiness/health dashboards green
- [ ] Remove deprecated code/flags; finalize docs and ownership checks

---
For each item: link PRs, test reports, and checklist confirmations.

## Refactor-V2 Kickoff (AA-MS)
- [x] 新增 pkg/logger（zerolog JSON）用于统一日志输出（LOG_LEVEL控制）
- [x] 新增 pkg/errors 统一错误体输出 {code,message,details?,traceId}
- [x] siterank: 接入统一错误体；新增 /healthz 与 /readyz（轻量就绪）
- [x] 输出 API Gateway v2 契约草案 deployments/gateway/gateway.v2.yaml（移除 workflow/identity；新增 notifications 占位；新增 /readyz）
- [ ] 后续：渲染并部署 gateway.v2（脚本可用 scripts/gateway/render-gateway-config.sh）
- [ ] 后续：统一 pkg/auth（Firebase Bearer 由 Gateway 校验，服务侧读取 X-User-Id）并清理 Identity 直连路径
