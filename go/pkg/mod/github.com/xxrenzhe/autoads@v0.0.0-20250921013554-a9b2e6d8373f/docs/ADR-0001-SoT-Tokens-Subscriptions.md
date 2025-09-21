# ADR-0001 — Token 与订阅的事实来源（SoT）收敛

## 背景
- 系统内同时存在 Next(Prisma) 与 Go(user/token) 两处“Token/订阅”的读写逻辑，容易造成数据不一致与判断分叉。
- 当前关键功能（SiteRank 批量、BatchOpen silent/AutoClick、AdsCenter 执行）均在 Go 侧完成扣费/退款与审计，实际“业务权威”在 Go。

## 决策
1) 事实来源（SoT）
   - Token/计费/扣费：以 Go 服务为唯一事实来源。
   - 订阅/套餐：以 Go 的只读端点为权威查询口径；Go 直接读 Prisma 表（MySQL）生成只读视图。

2) Next 的角色
   - 仅读 + 聚合：站点仅展示余额、订阅与配额；不在生产/预发环境中写 Token/订阅相关数据。
   - 业务写入（如调度/扣费）统一通过 `/go/api/v1/*` 上游服务完成。

3) 写操作守门
   - 使用环境开关 `ALLOW_NEXT_WRITES=false`（默认）配合中间件禁用 Next API 写操作（非白名单），避免生产/预发出现写入。
   - 在开发环境 `NODE_ENV=development` 或显式 `ALLOW_NEXT_WRITES=true` 时允许 Next 写入，便于本地调试与回归测试。

4) 对外契约
   - 保持既有路由与响应结构不变（Never break userspace）。
   - 新增/优化时优先在 Go 侧实现，并通过 BFF `/api/go/*` 转发。

## 实施要点
- 中间件生效：`apps/frontend/src/middleware.ts`
  - 预发/生产：对 `/api/*` 的非 GET/HEAD/OPTIONS 写操作默认 501，白名单包括 `/api/auth/*`、`/go/*`、`/ops/*`、`/api/stripe/webhook`。
  - 开发环境或设置 `ALLOW_NEXT_WRITES=true` 时放开限制。

- Next 侧写路由（保持仅开发可用）：
  - `apps/frontend/src/app/api/user/tokens/consume/route.ts` → 默认返回 501（NOT_IMPLEMENTED），仅开发/ALLOW_NEXT_WRITES=true 可用。

- 读路径统一：
  - 订阅/配额与余额前端从 Go 只读端点聚合，示例：
    - `/go/api/v1/user/subscription/current`
    - `/go/api/v1/tokens/balance`

## 影响
- 减少双处写入带来的不一致风险；便于在 Go 统一实现扣费、退款与审计。
- 对现有前端功能无破坏：已通过中间件在生产关闭 Next 写入，开发保持兼容。

## 迁移与后续
- P1：逐步迁移任何遗留的 Next 写入逻辑到 Go 端点（若存在）。
- P1：补充“购买 Token 成功后的入账”调用到 Go（若需要）。
- P2：提供只读统计端点（失败退款计数、缓存命中率等）用于观测。

## 状态
- 采纳（Adopted）。

