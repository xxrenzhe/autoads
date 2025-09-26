#!/usr/bin/env bash
set -euo pipefail

# Authenticated smoke for API Gateway endpoints.
# Usage:
#   HOST=autoads-gw-xxxxx.an.gateway.dev TOKEN=$ID_TOKEN ./deployments/scripts/gateway-smoke-auth.sh

HOST=${HOST:?HOST required}
TOKEN=${TOKEN:?TOKEN (Firebase ID token) required}

auth=( -H "Authorization: Bearer ${TOKEN}" )

echo "[smoke] GET /api/health/adscenter (200)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/health/adscenter"

echo "[smoke] GET /api/v1/adscenter/bulk-actions (200 or 204)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/v1/adscenter/bulk-actions" "${auth[@]}"

echo "[smoke] GET /api/v1/batchopen/templates (200)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/v1/batchopen/templates" "${auth[@]}"

echo "[smoke] GET /api/v1/billing/tokens/balance (200)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/v1/billing/tokens/balance" "${auth[@]}"

echo "[smoke] GET /api/v1/console/users (200)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/v1/console/users?limit=1" "${auth[@]}"

echo "[done]"
