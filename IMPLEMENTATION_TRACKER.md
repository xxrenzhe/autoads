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
