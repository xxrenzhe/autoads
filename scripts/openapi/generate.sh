#!/usr/bin/env bash
set -euo pipefail

# Generate code/types from OpenAPI specs (Go stubs via oapi-codegen, TS types via openapi-typescript)
# Prerequisites: go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest; npm i -g openapi-typescript

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/.kiro/specs/addictive-ads-management-system/openapi"

gen_go() {
  local svc="$1" outdir="$2"
  mkdir -p "$outdir"
  oapi-codegen -generate types,chi-server -package oapi -o "$outdir/server.gen.go" "$SPEC_DIR/$svc.yaml"
  oapi-codegen -generate types -package oapi -o "$outdir/types.gen.go" "$SPEC_DIR/$svc.yaml"
}

gen_ts() {
  local svc="$1" outdir="$2"
  mkdir -p "$outdir"
  npx --yes openapi-typescript "$SPEC_DIR/$svc.yaml" -o "$outdir/types.d.ts"
}

echo "[OAS] generating Go stubs (selective)"
gen_go offer "$ROOT/services/offer/internal/oapi" || echo "offer go stubs skipped"
gen_go siterank "$ROOT/services/siterank/internal/oapi" || echo "siterank go stubs skipped"
gen_go adscenter "$ROOT/services/adscenter/internal/oapi" || echo "adscenter go stubs skipped"

echo "[OAS] generating TS types (frontend SDK)"
gen_ts offer "$ROOT/apps/frontend/src/sdk/offer" || true
gen_ts siterank "$ROOT/apps/frontend/src/sdk/siterank" || true
gen_ts adscenter "$ROOT/apps/frontend/src/sdk/adscenter" || true
gen_ts console "$ROOT/apps/frontend/src/sdk/console" || true

echo "[DONE] OpenAPI generate"

