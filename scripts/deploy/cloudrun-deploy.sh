#!/usr/bin/env bash
set -euo pipefail

# Cloud Run 一键部署脚本（基于 Cloud Build 构建 + Artifact Registry + Cloud Run）
# 先决条件：已登录 gcloud，具备 Artifact Registry、Cloud Build、Run 权限

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${PROJECT_ID:-gen-lang-client-0944935873}}"
REGION="${REGION:-asia-northeast1}"
REPO="${REPO:-autoads-services}"
BUILD_LOG_BUCKET="${BUILD_LOG_BUCKET:-gs://autoads-build-logs-asia-northeast1}"
STACK="${STACK:-prod}"
RUN_SA="${RUN_SA:-codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com}"

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
  echo "[run-deploy] Building ${name} (root context, service Dockerfile)"
  IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${name}:latest"
  TMP_DIR="scripts/deploy/_tmp"
  mkdir -p "${TMP_DIR}"
  CB_FILE="${TMP_DIR}/cloudbuild-${name}.yaml"
  cat > "${CB_FILE}" <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build','-f','services/${name}/Dockerfile','-t','${IMAGE_TAG}','.']
images: ['${IMAGE_TAG}']
EOF
  gcloud builds submit . --config "${CB_FILE}" --gcs-log-dir "${BUILD_LOG_BUCKET}" --region=global

  echo "[run-deploy] Deploy ${name}"
  gcloud run deploy "${name}" \
    --image "${IMAGE_TAG}" \
    --region "${REGION}" \
    --platform managed \
    --service-account "${RUN_SA}" \
    --allow-unauthenticated \
    --set-env-vars "ENV=production,STACK=${STACK},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GIN_MODE=release,PUBSUB_TOPIC_ID=domain-events-${STACK},PUBSUB_SUBSCRIPTION_ID=${name}-sub-${STACK}" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
    --vpc-connector cr-conn-default-ane1 \
    --vpc-egress private-ranges-only \
    --timeout=300s \
    
done

echo "[run-deploy] Done"
