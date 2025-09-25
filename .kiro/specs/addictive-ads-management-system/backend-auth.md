# 后端服务身份解析（网关V2 + pkg/auth）

目标：服务端不再自行校验 Firebase。统一在 Google Cloud API Gateway 完成 Firebase Bearer 验证，后端服务仅解析用户标识（User ID）。

服务端解析顺序（pkg/auth.ExtractUserID）
- X-User-Id：优先读取（BFF/受信层可直传）。
- X-Endpoint-API-UserInfo：API Gateway 会注入此头，值为 base64 JSON，包含 `sub`/`email` 等声明；优先取 `sub`。
- Authorization: Bearer <JWT>：用于无网关直连（本地/CI）。若设置了 `INTERNAL_JWT_PUBLIC_KEY`（RS256 公钥），可验证并提取 `sub`；如未设置，仅当 `ALLOW_INSECURE_INTERNAL_JWT=true` 时才允许无验证解析（开发用途）。

前端/BFF 配合
- Next BFF（/api/go/[...path]）在无 Authorization 时，将：
  - 生成内部 JWT（RS256）并设置 Authorization: Bearer <token>
  - 同时设置 `X-User-Id: <session.user.id>`

环境变量
- 服务端：
  - INTERNAL_JWT_PUBLIC_KEY（可选）：PEM 格式 RS256 公钥，用于校验来自 BFF 的内部 JWT。
  - ALLOW_INSECURE_INTERNAL_JWT（默认 false）：true 时允许无验证解析 JWT（仅限开发环境）。
- BFF（Next.js）：
  - INTERNAL_JWT_PRIVATE_KEY / INTERNAL_JWT_PRIVATE_KEY_FILE：用于签发内部 JWT（RS256）。
  - INTERNAL_JWT_ISS / INTERNAL_JWT_AUD / INTERNAL_JWT_TTL_SECONDS：可选定制。

最佳实践
- 生产流量：通过 API Gateway，后端从 `X-Endpoint-API-UserInfo` 获取 userId；无需内部 JWT。
- 预发/本地：
  - 若走 Gateway：同上。
  - 若直连服务：BFF 注入 Authorization 与 X-User-Id；服务端设置 `INTERNAL_JWT_PUBLIC_KEY` 以严格校验。

故障排查
- 401：确认 Gateway 已配置 Firebase 验证；或 BFF 是否注入 `X-User-Id`/Authorization。
- 403：确认用户角色/套餐检查逻辑（按服务侧实现）。
- 5xx：检查 `x-request-id` 并于日志中关联排查。
