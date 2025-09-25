#!/usr/bin/env bash
set -euo pipefail

# Minimal contract test runner:
# 1) Validate specs
# 2) Ensure stubs generation works (schema compile)

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

"$ROOT/scripts/openapi/validate.sh"

# Attempt stub generation for a quick compile-time schema check
"$ROOT/scripts/openapi/gen-go-stubs.sh"

echo "[DONE] Contract checks passed (validation + stubs generation)"

