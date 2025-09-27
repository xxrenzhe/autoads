#!/usr/bin/env bash
set -euo pipefail

# Label Cloud Run services with autoads-stack=<stack> and optional extra labels.
# Usage:
#   PROJECT_ID=gen-lang-client-0944935873 REGION=asia-northeast1 STACK=preview \
#   SERVICES="offer billing batchopen adscenter siterank notifications" \
#   ./deployments/scripts/label-services.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:?REGION required}
STACK=${STACK:?STACK required}
SERVICES=${SERVICES:-"offer billing batchopen adscenter siterank notifications"}
EXTRA_LABELS=${EXTRA_LABELS:-}

for s in $SERVICES; do
  echo "[label] $s autoads-stack=$STACK $EXTRA_LABELS"
  gcloud run services update "$s" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --update-labels "autoads-stack=$STACK${EXTRA_LABELS:+,$EXTRA_LABELS}"
done
echo "[DONE] labels updated"

