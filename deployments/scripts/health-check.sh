#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${1:-"http://127.0.0.1:3000"}

echo "[Health] Checking Next (port 3000) and Go via /go proxy..."

function check() {
  local path="$1"; shift
  local url="${BASE_URL}${path}"
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$url" || true)
  echo " - GET ${path} -> ${code}"
  if [[ "$code" = "200" || "$code" = "204" || "$code" = "304" ]]; then return 0; else return 1; fi
}

ok=0
check "/go/health" && ok=$((ok+1)) || true
check "/go/ready" && ok=$((ok+1)) || true
check "/go/live" && ok=$((ok+1)) || true
check "/go/api/health" && ok=$((ok+1)) || true

echo "[Health] Passed ${ok}/4 checks"

if [[ $ok -lt 2 ]]; then
  echo "[Health] Service is not healthy enough" >&2
  exit 1
fi

exit 0

