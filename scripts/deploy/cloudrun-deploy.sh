#!/usr/bin/env bash
set -euo pipefail

# Cloud Run 一键部署脚本（基于 Cloud Build 构建 + Artifact Registry + Cloud Run）
# 先决条件：已登录 gcloud，具备 Artifact Registry、Cloud Build、Run 权限

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-gen-lang-client-0944935873}}"
REGION="${REGION:-asia-northeast1}"
REPO="${REPO:-autoads-services}"

# 支持仅部署变更的服务：
# - 如果设置了环境变量 SERVICES（逗号或空格分隔），则按其部署
# - 否则默认部署全量列表
if [[ -n "${SERVICES:-}" ]]; then
  # 兼容逗号或空格
  IFS=', ' read -r -a SERVICES_ARR <<< "${SERVICES}"
else
  SERVICES_ARR=(identity billing offer workflow siterank adscenter)
fi

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud auth configure-docker "${REGION}-docker.pkg.dev" >/dev/null

for name in "${SERVICES_ARR[@]}"; do
  echo "[run-deploy] Building ${name}"
  IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${name}:latest"
  gcloud builds submit "./services/${name}" --tag "${IMAGE_TAG}"

  echo "[run-deploy] Deploy ${name}"
  gcloud run deploy "${name}" \
    --image "${IMAGE_TAG}" \
    --region "${REGION}" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "GIN_MODE=release" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
    --update-env-vars "DATABASE_URL_SECRET_NAME=projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest"
done

echo "[run-deploy] Done"
