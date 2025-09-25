#!/usr/bin/env bash
set -euo pipefail

# Apply SQL files in schemas/sql in lexical order using psql.
# Requires: DATABASE_URL to be set, psql available.

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SQL_DIR="$ROOT/schemas/sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[error] DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[error] psql not found in PATH" >&2
  exit 1
fi

shopt -s nullglob
files=("$SQL_DIR"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "[warn] no SQL files under $SQL_DIR"
  exit 0
fi

echo "[db] applying ${#files[@]} SQL files to database..."
for f in "${files[@]}"; do
  echo "[db] -> applying $(basename "$f")"
  PGPASSWORD="" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "[DONE] database schema applied"

