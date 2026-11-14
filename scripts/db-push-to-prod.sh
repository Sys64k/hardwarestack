#!/usr/bin/env bash
# Push local database to production via Fly proxy.
#
# Prerequisites:
#   flyctl in PATH  (fish: fish_add_path ~/.fly/bin)
#   pg_dump / psql installed
#   PROD_DB_PASSWORD env var — get it once with:
#     flyctl postgres show -a hardwarestack-db
#
# Usage:
#   PROD_DB_PASSWORD=<password> ./scripts/db-push-to-prod.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

APP="hardwarestack"
DB_APP="hardwarestack-db"
LOCAL_URL="${DATABASE_URL:-postgresql://hardwarestack:hardwarestack@localhost:5432/hardwarestack}"
PROXY_PORT=15432
DUMP_FILE="$(mktemp /tmp/hardwarestack-dump-XXXXXX.sql)"

if [[ -z "${PROD_DB_PASSWORD:-}" ]]; then
  echo "Error: PROD_DB_PASSWORD is not set."
  echo "  Get it with: flyctl postgres show -a ${DB_APP}"
  exit 1
fi

PROD_URL="postgresql://postgres:${PROD_DB_PASSWORD}@localhost:${PROXY_PORT}/hardwarestack"

export PATH="$PATH:$HOME/.fly/bin"

cleanup() {
  rm -f "$DUMP_FILE"
  [[ -n "${PROXY_PID:-}" ]] && kill "$PROXY_PID" 2>/dev/null || true
}
trap cleanup EXIT

wait_for_port() {
  local port="$1"
  local max=30
  echo -n "    Waiting for proxy"
  for i in $(seq 1 $max); do
    if nc -z localhost "$port" 2>/dev/null; then
      echo " ready."
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo ""
  echo "Error: proxy did not become ready on port ${port} after ${max}s."
  echo "  Try: flyctl wireguard reset && flyctl wireguard create"
  exit 1
}

echo "==> Dumping local database..."
# Click counts are collected in production; never overwrite them with local test clicks.
pg_dump --no-owner --no-acl --exclude-table-data='"ShopClick"' "$LOCAL_URL" > "$DUMP_FILE"
echo "    $(du -sh "$DUMP_FILE" | cut -f1) written to $DUMP_FILE"

echo "==> Starting Fly proxy on port ${PROXY_PORT}..."
flyctl proxy "${PROXY_PORT}:5432" -a "$DB_APP" &
PROXY_PID=$!
wait_for_port "$PROXY_PORT"

echo "==> Truncating production tables..."
psql "$PROD_URL" -c 'TRUNCATE "RetailLink", "Cpu", "Gpu", "Ram" CASCADE;'

echo "==> Restoring dump..."
psql "$PROD_URL" -f "$DUMP_FILE"

echo "==> Restarting app to clear cache..."
flyctl machine restart -a "$APP"

echo ""
echo "Done. Production database updated and app restarted."
