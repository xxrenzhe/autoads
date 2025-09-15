#!/usr/bin/env bash
set -euo pipefail

# Minimal smoke test for idempotency, rate limit headers and config hot update.
# Requirements:
#   - env BASE_URL (e.g. https://www.autoads.dev)
#   - env USER_TOKEN (Bearer token for user APIs)
#   - env ADMIN_TOKEN (Bearer token for console APIs)
#
# Usage:
#   BASE_URL=http://localhost:3000 USER_TOKEN="Bearer xxx" ADMIN_TOKEN="Bearer yyy" ./scripts/e2e-smoke.sh

: "${BASE_URL:?BASE_URL is required (e.g. http://localhost:3000)}"
: "${USER_TOKEN:?USER_TOKEN is required (Authorization header for user APIs)}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN is required (Authorization header for console APIs)}"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

step() { echo; green "[SMOKE] $*"; }

# 1) SITERANK check
step "SITERANK :check"
curl -fsS -H "Authorization: ${USER_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"domains":["example.com","openai.com"]}' \
  "${BASE_URL}/go/api/v1/siterank/batch:check" | jq -r '.sufficient,.required' >/dev/null || red "siterank check failed"

# 2) SITERANK :execute idempotency
IDEM_KEY="smoke-$(date +%s)"
step "SITERANK :execute first (Idempotency-Key=${IDEM_KEY})"
curl -fsSI -H "Authorization: ${USER_TOKEN}" \
  -H "Idempotency-Key: ${IDEM_KEY}" \
  -H 'Content-Type: application/json' \
  "${BASE_URL}/go/api/v1/siterank/batch:execute" -d '{"domains":["example.com"]}' | awk '/X-Request-Id|X-RateLimit-/{print}'

step "SITERANK :execute duplicate (Idempotency-Key=${IDEM_KEY})"
curl -fsS -H "Authorization: ${USER_TOKEN}" \
  -H "Idempotency-Key: ${IDEM_KEY}" \
  -H 'Content-Type: application/json' \
  "${BASE_URL}/go/api/v1/siterank/batch:execute" -d '{"domains":["example.com"]}' | jq -r '.duplicate' | grep -q true && green "duplicate ok" || red "duplicate not true"

# 3) Config hot update ETag
TMP_KEY="smoke.etag.key"
TMP_VAL="v-$(date +%s)"
step "Config hot update via /ops/api/v1/console/system/config"
curl -fsS -H "Authorization: ${ADMIN_TOKEN}" -H 'Content-Type: application/json' \
  -d "{\"key\":\"${TMP_KEY}\",\"value\":\"${TMP_VAL}\",\"category\":\"smoke\"}" \
  "${BASE_URL}/ops/api/v1/console/system/config" >/dev/null

step "Fetch /ops/console/config/v1 to capture ETag"
ETAG1=$(curl -fsSI -H "Authorization: ${ADMIN_TOKEN}" "${BASE_URL}/ops/console/config/v1" | awk '/ETag:/ {print $2}' | tr -d '\r')
sleep 1
curl -fsS -H "Authorization: ${ADMIN_TOKEN}" -H "If-None-Match: ${ETAG1}" "${BASE_URL}/ops/console/config/v1" -o /dev/null -w "%{http_code}\n" | grep -q 304 && green "ETag 304 ok" || red "ETag 304 fail"

green "SMOKE OK"

