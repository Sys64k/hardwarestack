#!/usr/bin/env bash
# Reset production database: truncate all data, re-run migrations.
#
# Prerequisites:
#   flyctl in PATH
#   psql installed
#   PROD_DB_PASSWORD env var — get it with: flyctl postgres show -a hardwarestack-db
#
# Usage:
#   PROD_DB_PASSWORD=<password> ./scripts/db-reset-prod.sh

set -euo pipefail

DB_APP="hardwarestack-db"
PROXY_PORT=15432

if [[ -z "${PROD_DB_PASSWORD:-}" ]]; then
  echo "Error: PROD_DB_PASSWORD is not set."
  echo "  Get it with: flyctl postgres show -a ${DB_APP}"
  exit 1
fi

PROD_URL="postgresql://postgres:${PROD_DB_PASSWORD}@localhost:${PROXY_PORT}/hardwarestack"

read -r -p "This will DELETE ALL DATA in production. Type 'yes' to confirm: " confirm
[[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }

cleanup() {
  [[ -n "${PROXY_PID:-}" ]] && kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Starting Fly proxy on port ${PROXY_PORT}..."
flyctl proxy "${PROXY_PORT}:5432" -a "$DB_APP" &
PROXY_PID=$!
sleep 3

echo "==> Truncating all tables..."
psql "$PROD_URL" -c 'TRUNCATE "Cpu", "Gpu", "Ram" CASCADE;'

echo "==> Running migrations..."
flyctl ssh console -a hardwarestack -C "node_modules/.bin/prisma migrate deploy" 2>/dev/null \
  || echo "    (SSH unavailable — migrations run automatically on next deploy via release_command)"

echo ""
echo "Done. Production database has been reset."
