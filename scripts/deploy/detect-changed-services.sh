#!/usr/bin/env bash
set -euo pipefail

# Detect changed backend services since a given base commit.
# Output: JSON array of service names to STDOUT (e.g. ["offer","workflow"]) or [] if none.

BASE="${BASE_SHA:-}"
HEAD="${HEAD_SHA:-}"

if [[ -z "$HEAD" ]]; then
  HEAD=$(git rev-parse HEAD)
fi
if [[ -z "$BASE" ]]; then
  # Try to determine base automatically: previous commit
  BASE=$(git rev-parse "${HEAD}^" 2>/dev/null || true)
fi
if [[ -z "$BASE" ]]; then
  echo "[]"
  exit 0
fi

changed=$(git diff --name-only "$BASE" "$HEAD" || true)

# If core/shared changed -> deploy all
if echo "$changed" | grep -Eq '^(pkg/|go\.work|go\.work\.sum|scripts/deploy/|deployments/api-gateway/|.github/workflows/deploy-backend\.yml|.github/workflows/deploy-gateway\.yml|nginx\.conf|flake\.nix|\.idx/)'; then
  echo '["identity","billing","offer","workflow","siterank","adscenter","batchopen","console"]'
  exit 0
fi

services=$(echo "$changed" | awk -F/ '/^services\//{print $2}' | sort -u)

if [[ -z "$services" ]]; then
  echo "[]"
  exit 0
fi

# Build JSON array
out="["
first=1
while IFS= read -r s; do
  [[ -z "$s" ]] && continue
  if [[ $first -eq 0 ]]; then out+="","; else first=0; fi
  out+="\"$s\""
done <<< "$services"
out+="]"
echo "$out"
