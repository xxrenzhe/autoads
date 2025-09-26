#!/usr/bin/env bash
set -euo pipefail

# 将 deployments/api-gateway/gateway.yaml 中的 REPLACE_WITH_RUN_URL 占位符替换为实际 Cloud Run 服务 URL
# 需要 gcloud：通过 gcloud run services describe 获取 URL

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-gen-lang-client-0944935873}}"
REGION="${REGION:-asia-northeast1}"
INPUT="deployments/api-gateway/gateway.yaml"
OUTPUT="deployments/api-gateway/gateway.rendered.yaml"

gcloud config set project "${PROJECT_ID}" >/dev/null

cp "$INPUT" "$OUTPUT"
for svc in offer billing adscenter console siterank batchopen notifications; do
  url=$(gcloud run services describe "$svc" --region "$REGION" --format 'value(status.url)' 2>/dev/null || true)
  if [[ -z "$url" ]]; then
    echo "[render] WARN: service $svc not found; keep placeholder"
    continue
  fi
  host=${url#https://}
  echo "[render] $svc -> $url"
  # Replace placeholders like adscenter-REPLACE_WITH_RUN_URL with actual host
  sed -i.bak "s#${svc}-REPLACE_WITH_RUN_URL#${host}#g" "$OUTPUT" || true
done
rm -f "$OUTPUT.bak" || true

echo "[render] Rendered -> $OUTPUT"
