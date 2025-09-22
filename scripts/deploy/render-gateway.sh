#!/usr/bin/env bash
set -euo pipefail

# 将 deployments/api-gateway/gateway.yaml 中的 REPLACE_WITH_RUN_URL 占位符替换为实际 Cloud Run 服务 URL
# 需要 gcloud：通过 gcloud run services describe 获取 URL

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-gen-lang-client-0944935873}}"
REGION="${REGION:-asia-northeast1}"
INPUT="deployments/api-gateway/gateway.yaml"
OUTPUT="deployments/api-gateway/gateway.rendered.yaml"

gcloud config set project "${PROJECT_ID}" >/dev/null

declare -A URLS
for svc in offer workflow billing adscenter identity; do
  url=$(gcloud run services describe "$svc" --region "$REGION" --format 'value(status.url)' || true)
  if [[ -z "$url" ]]; then
    echo "[render] WARN: service $svc not found; keep placeholder"
  else
    URLS[$svc]="$url"
    echo "[render] $svc -> ${url}"
  fi
done

cp "$INPUT" "$OUTPUT"
for svc in "${!URLS[@]}"; do
  sed -i.bak "s#${svc}-REPLACE_WITH_RUN_URL#${URLS[$svc]#https://}#g" "$OUTPUT"
done
rm -f "$OUTPUT.bak"

echo "[render] Rendered -> $OUTPUT"

