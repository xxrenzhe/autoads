#!/usr/bin/env bash
set -euo pipefail

# Build and run Cloud Run Job for DB migrations in preview env.
# Prereqs: gcloud auth configured; Artifact Registry repo exists; VPC Connector exists.

PROJECT_ID=${PROJECT_ID:-gen-lang-client-0944935873}
REGION=${REGION:-asia-northeast1}
REPO=${REPO:-autoads-services}
CONNECTOR_NAME=${CONNECTOR_NAME:-autoads-vpc}
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/db-migrator:preview-latest"
SECRET_NAME=${DATABASE_URL_SECRET_NAME:-projects/${PROJECT_ID}/secrets/DATABASE_URL/versions/latest}
SA=${SERVICE_ACCOUNT:-codex-dev@${PROJECT_ID}.iam.gserviceaccount.com}

echo "[build] building ${IMAGE}"
gcloud builds submit . --project "$PROJECT_ID" --region "$REGION" \
  --config deployments/db-migrator/cloudbuild.yaml \
  --substitutions _IMAGE="$IMAGE" \
  --logging=CLOUD_LOGGING_ONLY

echo "[deploy] deploying job db-migrator-preview"
gcloud run jobs deploy db-migrator-preview \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE" \
  --set-env-vars "DATABASE_URL_SECRET_NAME=${SECRET_NAME}" \
  --service-account "$SA" \
  --vpc-connector "projects/${PROJECT_ID}/locations/${REGION}/connectors/${CONNECTOR_NAME}" \
  --vpc-egress all \
  --max-retries 0 \
  --task-timeout 10m

echo "[execute] running job db-migrator-preview"
gcloud run jobs execute db-migrator-preview --project "$PROJECT_ID" --region "$REGION" --wait

echo "[DONE] db-migrator executed"
