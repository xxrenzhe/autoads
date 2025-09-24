# Adscenter OAuth + MCC 绑定最小对接说明

## 1. 授权与回调（用户首次使用）
- 获取授权链接：`GET /api/v1/adscenter/oauth/url`
  - 需登录（携带 Firebase ID Token）
  - 响应 `{ authUrl: string }`，前端跳转该 URL
- 回调地址：`/api/v1/adscenter/oauth/callback`
  - 已在服务端校验 `state`（HMAC-SHA256，`OAUTH_STATE_SECRET`）
  - 成功后将 `refresh_token` 加密入库（`REFRESH_TOKEN_ENC_KEY_B64`）并与用户绑定
  - 前端可在回调结束后跳转控制台或引导下一步（选择 customer_id）

提示：回调 URL 列表通过 Secret Manager 注入 `ADS_OAUTH_REDIRECT_URLS`（多行，每行一个 URL），服务将按请求 Host 精确匹配。

## 2. 选择要绑定/管理的客户账号（后续接口补充）
- 列表（示例占位）：`GET /api/v1/adscenter/accounts`
  - 需要使用“用户级 refresh token”调用 Google Ads API（后端完成）

## 3. 绑定到平台统一 MCC（经理-客户关系）
- 发送邀请：`POST /api/v1/adscenter/mcc/link`
  - body: `{ "customerId": "1234567890" }`
  - 返回：`{ status: "queued" | "ok", message: string }`
- 查询状态：`GET /api/v1/adscenter/mcc/status?customerId=1234567890`
  - 返回：`{ customerId, status: "pending"|"active"|"rejected"|"unknown" }`
- 解除绑定：`POST /api/v1/adscenter/mcc/unlink`
  - body: `{ "customerId": "1234567890" }`

说明：当前为最小占位接口，默认 stub；ads_live 构建下可接入 Google Ads API 的 manager-link 邀请/查询/解绑能力。

## 4. Pre-flight（使用用户 token）
- `POST /api/v1/adscenter/preflight`
  - body: `{ "accountId": "1234567890" }`
  - 行为：强制要求用户级 refresh token，缺失时报错（不降级）
  - 响应：`{ summary: "ready|degraded|blocked", checks: [{ code, severity, message, details? }] }`

## 5. Secret Manager 与环境变量
- 已注入（Cloud Run — adscenter）：
  - `ADS_OAUTH_REDIRECT_URLS`：多行回调 URL 列表
  - `OAUTH_STATE_SECRET`：state HMAC 秘钥
  - `REFRESH_TOKEN_ENC_KEY_B64`：base64(32B) AES-GCM 加密密钥
- Ads 凭据（值或 *_SECRET_NAME 任一）：
  - `GOOGLE_ADS_DEVELOPER_TOKEN`
  - `GOOGLE_ADS_OAUTH_CLIENT_ID`
  - `GOOGLE_ADS_OAUTH_CLIENT_SECRET`
  - `GOOGLE_ADS_LOGIN_CUSTOMER_ID`（统一 MCC）

## 6. 轮换策略（refresh token 加密密钥）
- 读取时支持新旧双密钥解密：`REFRESH_TOKEN_ENC_KEY_B64` → `REFRESH_TOKEN_ENC_KEY_B64_OLD`
- 迁移工具（一次性密文重写）：
  - `services/adscenter/cmd/migrate-refresh-tokens`
  - 运行前：`export DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)`
  - `REFRESH_TOKEN_ENC_KEY_B64` 必须为 base64 的 32 字节
  - dry-run：`go run ./services/adscenter/cmd/migrate-refresh-tokens -dry-run=false`

