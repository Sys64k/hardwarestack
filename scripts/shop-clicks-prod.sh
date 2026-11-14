#!/usr/bin/env bash
# Read-only report of shop link clicks in production, via the Fly proxy.
#
# Prerequisites: flyctl and psql in PATH, and PROD_DB_PASSWORD (see db-push-to-prod.sh).
#
# Usage:
#   PROD_DB_PASSWORD=<password> ./scripts/shop-clicks-prod.sh [days]   # default 30

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.local"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DAYS="${1:-30}"
if ! [[ "$DAYS" =~ ^[0-9]+$ ]]; then
  echo "Error: days must be a whole number."
  exit 1
fi
if [[ -z "${PROD_DB_PASSWORD:-}" ]]; then
  echo "Error: PROD_DB_PASSWORD is not set."
  echo "  Get it with: flyctl postgres show -a hardwarestack-db"
  exit 1
fi

DB_APP="hardwarestack-db"
PROXY_PORT=15432
PROD_URL="postgresql://postgres:${PROD_DB_PASSWORD}@localhost:${PROXY_PORT}/hardwarestack"
export PATH="$PATH:$HOME/.fly/bin"

flyctl proxy "${PROXY_PORT}:5432" -a "$DB_APP" >/dev/null &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do nc -z localhost "$PROXY_PORT" 2>/dev/null && break; sleep 1; done

SINCE="current_date - ${DAYS}"
# default_transaction_read_only: this script can only read.
export PGOPTIONS="-c default_transaction_read_only=on"

echo "==> Clicks per retailer, last ${DAYS} days"
psql "$PROD_URL" -c "SELECT retailer, SUM(count) AS clicks FROM \"ShopClick\" WHERE day > ${SINCE} GROUP BY retailer ORDER BY clicks DESC;"
echo "==> Clicks per page type"
psql "$PROD_URL" -c "SELECT page, retailer, SUM(count) AS clicks FROM \"ShopClick\" WHERE day > ${SINCE} GROUP BY page, retailer ORDER BY clicks DESC;"
echo "==> Top 25 parts"
psql "$PROD_URL" -c "SELECT part, SUM(count) AS clicks FROM \"ShopClick\" WHERE day > ${SINCE} GROUP BY part ORDER BY clicks DESC LIMIT 25;"
