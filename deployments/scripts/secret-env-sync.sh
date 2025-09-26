#!/usr/bin/env bash
set -euo pipefail

# Sync selected Secret Manager secrets into Cloud Run service env vars.
# Each mapping is NAME=projects/<proj>/secrets/<name>/versions/<ver>
# Usage:
#  PROJECT_ID=gen-lang-client-0944935873 REGION=asia-northeast1 SERVICE=billing \
#  SECRETS="DATABASE_URL=projects/.../versions/latest,REFRESH_TOKEN_ENC_KEY_B64=projects/.../versions/1" \
#  ./deployments/scripts/secret-env-sync.sh

PROJECT_ID=${PROJECT_ID:?PROJECT_ID required}
REGION=${REGION:?REGION required}
SERVICE=${SERVICE:?SERVICE required}
SECRETS=${SECRETS:?SECRETS required}

tmp=$(mktemp)
echo "[info] resolving secrets for $SERVICE"
IFS=',' read -r -a arr <<< "$SECRETS"
for kv in "${arr[@]}"; do
  name="${kv%%=*}"; ref="${kv#*=}"
  val=$(gcloud secrets versions access "${ref##*/}" --secret "${ref#*/secrets/}" --project "$PROJECT_ID")
  # escape newlines
  val_escaped=$(printf '%s' "$val" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read())[1:-1])')
  echo "$name=$val_escaped" >> "$tmp"
done

echo "[update] applying env vars to $SERVICE"
gcloud run services update "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --update-env-vars "$(paste -sd, "$tmp")"
rm -f "$tmp"
echo "[DONE] env synced for $SERVICE"

