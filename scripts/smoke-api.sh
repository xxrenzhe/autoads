#!/usr/bin/env bash

# Simple smoke test for core APIs
# Usage: BASE_URL=http://localhost:8888 AUTH="Bearer <token>" scripts/smoke-api.sh

set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:8888}
AUTH_HEADER=${AUTH:-}

hdr=()
if [[ -n "$AUTH_HEADER" ]]; then
  hdr+=( -H "Authorization: $AUTH_HEADER" )
fi

echo "[SMOKE] Health..."
curl -sf "$BASE_URL/api/health" >/dev/null
curl -sf "$BASE_URL/api/health/v2" >/dev/null || true

echo "[SMOKE] SiteRank single..."
curl -sf ${hdr[@]:-} "$BASE_URL/api/siterank/rank?domain=example.com" >/dev/null || true

echo "[SMOKE] SiteRank batch..."
curl -sf ${hdr[@]:-} -H 'Content-Type: application/json' \
  -d '{"domains":["example.com","openai.com"]}' \
  "$BASE_URL/api/v1/siterank/batch" >/dev/null || true

echo "[SMOKE] Invitation info..."
curl -sf ${hdr[@]:-} "$BASE_URL/api/v1/invitation/info" >/dev/null || true

echo "[SMOKE] Checkin info..."
curl -sf ${hdr[@]:-} "$BASE_URL/api/v1/checkin/info" >/dev/null || true

echo "[SMOKE] Done"

