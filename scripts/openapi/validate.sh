#!/usr/bin/env bash
set -euo pipefail

# Validate OpenAPI specs using @redocly/cli if available, otherwise try swagger-cli.
# Usage: ./scripts/openapi/validate.sh

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/.kiro/specs/addictive-ads-management-system/openapi"

validate_with_redocly() {
  npx --yes @redocly/cli@latest lint "$1"
}

validate_with_swagger_cli() {
  npx --yes swagger-cli@4.0.4 validate "$1"
}

ok=0
for f in "$SPEC_DIR"/*.yaml; do
  echo "[validate] $f"
  if validate_with_redocly "$f"; then
    echo "[ok] redocly lint passed for $f"
  elif validate_with_swagger_cli "$f"; then
    echo "[ok] swagger-cli validate passed for $f"
  else
    echo "[FAIL] OpenAPI validation failed for $f" >&2
    ok=1
  fi
done

exit $ok

