#!/usr/bin/env bash
set -euo pipefail

# Quick smoke for API Gateway endpoints.
# Usage:
#   HOST=autoads-gw-xxxxx.an.gateway.dev ./deployments/scripts/gateway-smoke.sh

HOST=${HOST:?HOST required}

echo "[smoke] GET /api/health/adscenter"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/health/adscenter"

echo "[smoke] GET /api/v1/adscenter/bulk-actions (expect 401)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/v1/adscenter/bulk-actions" || true

echo "[smoke] GET /api/v1/batchopen/templates (expect 401)"
curl -sS -o /dev/null -w "%{http_code}\n" "https://${HOST}/api/v1/batchopen/templates" || true

echo "[done]"

