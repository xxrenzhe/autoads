#!/usr/bin/env bash

# AutoAds SaaS 全量功能测试脚本（本地）
# 依赖：curl、(可选) jq、(可选) node 用于JWT生成
# 用法：
#   BASE_URL=http://localhost:8888 \
#   AUTH_SECRET='<secret>' USER_ID='<uid>' USER_EMAIL='tester@dev' \
#   ADMIN_USER='admin' ADMIN_PASS='admin123' \
#   ./scripts/test-full.sh

set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:8888}
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-admin123}

log() { echo -e "\033[1;32m[TEST]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err() { echo -e "\033[0;31m[ERR ]\033[0m $*"; }

AUTH_HEADER=""
if [[ -n "${AUTH_TOKEN:-}" ]]; then
  AUTH_HEADER="Authorization: Bearer ${AUTH_TOKEN}"
elif [[ -n "${AUTH_SECRET:-}" && -n "${USER_ID:-}" ]]; then
  if command -v node >/dev/null 2>&1; then
    export AUTH_TOKEN=$(node -e '
      const jwt=require("jsonwebtoken");
      const secret=process.env.AUTH_SECRET;
      const uid=process.env.USER_ID;
      const email=process.env.USER_EMAIL||"tester@dev";
      const tok=jwt.sign({user_id:uid,email,role:"user",plan_name:"pro"}, secret, {algorithm:"HS256",expiresIn:"12h"});
      console.log(tok);')
    AUTH_HEADER="Authorization: Bearer ${AUTH_TOKEN}"
    log "JWT 已生成"
  else
    warn "node 不存在，无法自动生成JWT；请导出 AUTH_TOKEN 环境变量"
  fi
else
  warn "未检测到 AUTH_TOKEN 或 (AUTH_SECRET+USER_ID)，只运行不需鉴权的接口"
fi

hdr_auth=()
if [[ -n "${AUTH_HEADER}" ]]; then hdr_auth+=( -H "$AUTH_HEADER" ); fi

run() {
  local name="$1"; shift
  log "$name: $*"
  if ! eval "$*"; then
    err "$name 失败"
    exit 1
  fi
}

# 1) 健康检查
run "健康检查 /api/health" \
  "curl -sf ${BASE_URL}/api/health >/dev/null"
run "健康检查 /api/health/v2" \
  "curl -sf ${BASE_URL}/api/health/v2 >/dev/null"

# 2) SiteRank 单域
if [[ -n "${AUTH_HEADER}" ]]; then
  run "SiteRank 单域" \
    "curl -sf ${hdr_auth[@]} '${BASE_URL}/api/siterank/rank?domain=example.com' >/dev/null"
fi

# 3) SiteRank 批量
if [[ -n "${AUTH_HEADER}" ]]; then
  run "SiteRank 批量" \
    "curl -sf ${hdr_auth[@]} -H 'Content-Type: application/json' -d '{"domains":["example.com","openai.com"],"force":false}' ${BASE_URL}/api/v1/siterank/batch >/dev/null"
fi

# 4) 邀请
if [[ -n "${AUTH_HEADER}" ]]; then
  run "邀请 info" \
    "curl -sf ${hdr_auth[@]} ${BASE_URL}/api/v1/invitation/info >/dev/null"
  run "邀请 generate-link" \
    "curl -sf ${hdr_auth[@]} -H 'Content-Type: application/json' -d '{"baseUrl":"https://example.com"}' ${BASE_URL}/api/v1/invitation/generate-link >/dev/null"
  run "邀请 history" \
    "curl -sf ${hdr_auth[@]} ${BASE_URL}/api/v1/invitation/history >/dev/null"
fi

# 5) 签到
if [[ -n "${AUTH_HEADER}" ]]; then
  run "签到 info" \
    "curl -sf ${hdr_auth[@]} ${BASE_URL}/api/v1/checkin/info >/dev/null"
  run "签到 perform" \
    "curl -sf ${hdr_auth[@]} -X POST ${BASE_URL}/api/v1/checkin/perform >/dev/null"
fi

# 6) BatchOpen Silent
if [[ -n "${AUTH_HEADER}" ]]; then
  tmpfile=$(mktemp)
  run "BatchOpen silent-start" \
    "curl -s ${hdr_auth[@]} -H 'Content-Type: application/json' -d '{"urls":["https://a.com","https://b.com"],"concurrency":2,"timeout":20,"retry_count":1}' ${BASE_URL}/api/batchopen/silent-start | tee $tmpfile >/dev/null"
  task_id=$(sed -n 's/.*"task_id"\s*:\s*"\([^"]\+\)".*/\1/p' "$tmpfile" | head -1)
  if [[ -n "$task_id" ]]; then
    log "获取到 task_id=$task_id，查询进度"
    run "Silent 进度" \
      "curl -sf ${hdr_auth[@]} '${BASE_URL}/api/batchopen/silent-progress?taskId='${task_id} >/dev/null"
    run "Silent 终止" \
      "curl -sf ${hdr_auth[@]} -H 'Content-Type: application/json' -d '{"taskId":"'${task_id}'"}' ${BASE_URL}/api/batchopen/silent-terminate >/dev/null"
  else
    warn "未能解析 task_id，跳过进度/终止测试"
  fi
  rm -f "$tmpfile"
fi

# 7) 管理后台（Basic Auth）
if command -v curl >/dev/null 2>&1; then
  run "Admin users 列表" \
    "curl -sf -u '${ADMIN_USER}:${ADMIN_PASS}' ${BASE_URL}/admin/users >/dev/null"
  # 可选：示例更新（需指定真实用户ID）
  if [[ -n "${UPDATE_USER_ID:-}" ]]; then
    run "Admin 更新用户状态" \
      "curl -sf -u '${ADMIN_USER}:${ADMIN_PASS}' -H 'Content-Type: application/json' -X PUT -d '{"status":"active"}' ${BASE_URL}/admin/users/${UPDATE_USER_ID} >/dev/null"
  fi
  run "Admin stats" \
    "curl -sf -u '${ADMIN_USER}:${ADMIN_PASS}' ${BASE_URL}/admin/stats >/dev/null"
fi

log "全部用例执行完成"

