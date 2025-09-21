# Architecture Optimization 06 — 去除 Next Admin / Go 端单源迁移 / 文档可续接

本文档在 AO-02~05 的基础上，落实三项架构决策：

- 去除 Next 端 Admin（仅保留 Go 控制台，经 `/ops/*` 反代访问）。
- 支付闭环暂不启用（前端隐藏充值/支付，保留 Token 查询与扣费的服务端原子端点）。
- 数据 Schema 迁移集中在 Go 侧（唯一真源）；Next 仅作为 Prisma Client 的类型与读写网关（生产环境只读业务域）。

并通过“文档内任务清单 + 一次性执行指令”的方式，确保新开启的协作会话（人或代理）可以直接续接本优化方案的未完成工作。

---

## 目标状态（Target State）

- 前端（Next）：
  - 移除 Admin UI 与管理员凭证登录，仅保留用户侧 UI 与统一 BFF 反代。
  - 生产环境禁止 Next 写入业务数据（保留认证四表写入），所有业务写入统一走 Go 原子端点。
  - 规范化访问路径：统一通过 `/go/*` 访问容器内 Go 服务；`/ops/*` 专用于管理控制台反代。

- 后端（Go）：
  - 作为唯一写入与迁移端；以 `--migrate` 进行 Schema 迁移与演进。
  - 提供任务生命周期 API，支持“任务创建/查询进度/终止/恢复”，并保证与用户绑定、会话无关。
  - 继续提供限流、审计、调度等平台能力；生产强制启用内部 RS256 JWT 验签（`INTERNAL_JWT_ENFORCE=true`）。

---

## 路由与契约（Routing & Contract）

- 统一入口：
  - 用户/业务：`/go/api/v1/*`（Next Route Handler 反代到 `BACKEND_URL`）。
  - 管理后台：`/ops/console/*` 与 `/ops/api/v1/console/*`（仅反代，不再在 Next 渲染 Admin 页面）。

- 兼容层（迁移期）：
  - `/api/go/*`、`/api/(siterank|adscenter)/*` 保留为薄代理与合同兼容入口，开发/预发输出 Deprecation 提示；两版后可下线。

---

## 会话续接（文档持久化与任务清单）

本节面向“工程协作与自动化执行”，而非产品功能。通过“可勾选的任务清单 + 当前进度标记 + 一条不中断的一次性执行指令”，确保任何人在新开会话时都能快速续接：

- 当前进度标记（手动维护）：
  - CURRENT_STEP: <填写进行中的任务 ID>

- 任务清单（可续接）：
  - [x] T1 移除 Next Admin 代码（删除 `apps/frontend/src/admin/*`、`apps/frontend/src/app/(admin)/*` 等）
  - [x] T2 NextAuth 移除 Credentials Provider，仅保留 Google OAuth；将后台入口指向 `/ops/console/login`
  - [x] T3 生产禁用 Next 业务写入（保留认证四表），将开发态写入接口改为 501 或 dev-only
  - [x] T4 路由收敛：对外统一 `/go/*`，`/ops/*` 反代 Console；兼容层 `/api/go/*` 与 `/api/(siterank|adscenter)/*` 标注 Deprecation
  - [x] T5 迁移集中 Go：流水线/脚本在启动前执行 `--migrate`；前端仅 `prisma generate`
  - [x] T6 文档与 README 更新；移除支付/充值 UI 入口（无需支付闭环）
  - [x] T7 冒烟验证：登录、SiteRank 单/批、BatchOpen、Token 余额与统计、Console 可达

任何人接手时，仅需更新“CURRENT_STEP”并按任务清单顺序推进；或直接使用下文“一次性执行指令”完成可自动化的环节。

---

## 去除 Next Admin（实现要点）

- 目录移除：`apps/frontend/src/admin/*`、`apps/frontend/src/app/(admin)/*`、（如有）`apps/frontend/src/app/admin/*`。
- NextAuth：删除 Credentials Provider，仅保留 Google OAuth；管理员通过 Go 控制台独立账户与 JWT 体系登录。
- 导航与入口：所有“后台/管理”指向 `/ops/console/login`；Next 不再渲染 Admin UI。

---

## 生产只读（Next 端业务写入禁用）

- 保持 Prisma Guard：仅允许 `user/account/session/verificationToken/userDevice` 模型写入；其余模型写入在 `production/preview` 直接抛错（已有实现）。
- 旧有 Next 写入接口（如手动消费 Token 的开发路由）统一返回 `501 Not Implemented`（或在构建时剔除），并在 UI 隐藏入口。

---

## 迁移与发布（Go 单源）

- 迁移唯一真源：Go 服务。
  - 数据演进通过 `./server --migrate` 或 `go run cmd/server/main.go --migrate` 执行。
  - 部署流水线在启动前执行迁移 Job，失败则回滚，不启动业务进程。
- Next 与 Schema 同步：
  - 开发/预发：当 Go 迁移变更后，执行 `prisma db pull` + `prisma generate` 更新类型与客户端，然后提交代码。
  - 生产：构建阶段仅 `prisma generate`，禁止对生产库发起 `migrate/db push`。

---

## 配置要求（关键项）

- 内部 JWT：
  - Next：`INTERNAL_JWT_PRIVATE_KEY`（PEM，RS256）、`INTERNAL_JWT_TTL_SECONDS`、`INTERNAL_JWT_ISS=autoads-next`、`INTERNAL_JWT_AUD=internal-go`。
  - Go：`INTERNAL_JWT_PUBLIC_KEY`（PEM）、`INTERNAL_JWT_ENFORCE=true`（生产强制）。
- 域名与 CORS：按现有 `NEXT_PUBLIC_DOMAIN/NEXT_PUBLIC_DEPLOYMENT_ENV` 与中间件策略保持一致；`/api/auth/csrf` 允许域名需覆盖 www/裸域。

---

## 代理/自动化一次性执行指令（非产品功能）

本节给出“对代理（你）的一次性自然语言指令模板”，用于在单个会话中连续完成本优化方案（非产品功能）。

将以下指令原样发送给代理即可一次性执行，不中途停顿或等待确认：

```
一次性执行 docs/ArchitectureOptimization06.md 的优化方案（T1~T7），不要停顿、不要等待确认：
1) 按 T1 删除 Next Admin 相关目录与引用；
2) 按 T2 移除 NextAuth Credentials Provider，仅保留 Google；所有后台入口指向 /ops/console/login；
3) 按 T3 在生产禁用 Next 业务写入，保留认证四表；将开发写入路由改为 501 或 dev-only；
4) 按 T4 收敛路由：统一对外 /go/*，/ops/* 反代 Console；对 /api/go/* 与 /api/(siterank|adscenter)/* 标注 Deprecation；
5) 按 T5 将迁移集中至 Go：配置与脚本在启动前执行 --migrate；前端仅 prisma generate；
6) 按 T6 更新文档与 README，隐藏支付/充值入口（无需支付闭环）；
7) 按 T7 做冒烟验证；
完成后输出：改动文件列表、关键变更点、遗留项与下一步建议。
```

可选（如需分步推进），使用下面的分步指令模板：

```
请按 docs/ArchitectureOptimization06.md 的任务清单执行第 {N} 步（T{N}），完成后自动继续下一步，直到 T7 结束；中间不要等待我的确认。
```

---

## 回滚与风险

- 若 Admin 下线引发运营影响，可临时引导使用 `/ops/console/login` 的 Go 控制台；Next 不再提供 Admin 渲染。
- 若内部 JWT 配置缺失导致 401，请先回退 `INTERNAL_JWT_ENFORCE=false`（仅预发/故障期），修复后立即恢复 true。
- 若任务续接失败，多半为客户端无 `taskId` 或服务端缺少“latest”接口：
  - 先从本地缓存恢复 `last_task_id` 并调用 `/go/api/v1/.../progress`；
  - 再启用建议新增的 `tasks:latest`/`tasks?status=running` 接口兜底。

---

## CI 清理与归档

- 构建与推送镜像的唯一主流程：`.github/workflows/docker.yml`。
- 已归档的非主流程（避免混淆）：
  - `.github/workflows/archived/build-and-push.yml`
  - `.github/workflows/archived/deploy.yml`
  - `.github/workflows/archived/deploy-production.yml`
  - `.github/workflows/archived/autoads-saas-cicd.yml`
  - `.github/workflows/archived/build-gofly-admin.yml`
  - `.github/workflows/archived/optimized-build.yml`
  - `.github/workflows/archived/debug-permissions.yml`
- 安全与质量相关工作流（如 `security.yml`、`code-quality.yml`、`sbom-generation.yml`）保留不变。


## 验收（验收清单）

- Next 无 Admin 页面与管理员凭证入口；`/ops/*` 正常反代 Go 控制台。
- 生产环境 Next 对业务模型写入被 Guard 拦截；所有扣费/任务创建经 Go 原子端点完成。
- 新会话进入后：能自动恢复最近运行中的 BatchOpen 任务进度（本地 ID 或服务端 latest 列表），不会重复扣费。
- 部署顺序为“迁移先行”，镜像构建成功并能在本地/预发启动。
