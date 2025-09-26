#!/usr/bin/env bash
set -euo pipefail

# Deploy API Gateway v2 with Firebase auth, using gateway.v2.yaml
# 1) Render placeholders to gateway.v2.rendered.yaml
# 2) Create/Update API, config, and gateway

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-northeast1}"
API_NAME="${API_NAME:-autoads-api}"
CONFIG_NAME="${CONFIG_NAME:-autoads-v2}"
GATEWAY_NAME="${GATEWAY_NAME:-autoads-gw}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: PROJECT_ID or GOOGLE_CLOUD_PROJECT required" >&2
  exit 1
fi

"$(dirname "$0")/render-gateway.sh"

SPEC="$(cd "$(dirname "$0")/.." && pwd)/gateway/gateway.v2.rendered.yaml"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "[gw] Ensuring API $API_NAME exists..."
gcloud api-gateway apis create "$API_NAME" --project "$PROJECT_ID" || true

echo "[gw] Creating API config $CONFIG_NAME..."
gcloud api-gateway api-configs create "$CONFIG_NAME" \
  --api="$API_NAME" \
  --openapi-spec="$SPEC" \
  --project="$PROJECT_ID" || true

echo "[gw] Creating gateway $GATEWAY_NAME in $REGION..."
gcloud api-gateway gateways create "$GATEWAY_NAME" \
  --api="$API_NAME" \
  --api-config="$CONFIG_NAME" \
  --location="$REGION" \
  --project="$PROJECT_ID" || true

echo "[DONE] Gateway deployed"

