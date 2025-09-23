#!/usr/bin/env bash
set -euo pipefail

# Deploy Next.js (apps/frontend) to Firebase Hosting with SSR (frameworks)
# Requirements:
#  - secrets/firebase-adminsdk.json: service account for firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com
#  - API_GATEWAY_HOST env: e.g. autoads-gw-885pd7lz.an.gateway.dev
#  - PROJECT_ID env (default: gen-lang-client-0944935873)

PROJECT_ID=${PROJECT_ID:-gen-lang-client-0944935873}
GATEWAY=${API_GATEWAY_HOST:?API_GATEWAY_HOST required, e.g. autoads-gw-xxxx.an.gateway.dev}

export GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-$(pwd)/secrets/firebase-adminsdk.json}
if [[ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
  echo "[err] Service account json not found at $GOOGLE_APPLICATION_CREDENTIALS" >&2
  exit 2
fi

pushd apps/frontend >/dev/null

# Install deps and build environment variables
export NEXT_PUBLIC_DEPLOYMENT_ENV=production
export NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT_ID}
export BACKEND_URL="https://${GATEWAY}"

echo "[info] Installing frontend deps (fallback to npm install if lock mismatch)"
if ! npm ci; then
  npm install --no-audit --no-fund
fi

popd >/dev/null

echo "[info] Enabling Firebase frameworks support"
npx --yes firebase-tools@13.0.2 experiments:enable webframeworks

echo "[info] Deploying to Firebase Hosting (project: ${PROJECT_ID})"
npx --yes firebase-tools@13.0.2 deploy --only hosting --project "${PROJECT_ID}"

echo "[done] Deployed. Visit https://${PROJECT_ID}.web.app (or your custom domain if configured)."
