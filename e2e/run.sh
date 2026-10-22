#!/usr/bin/env bash
# End-to-end gate: run this before every release.
#   1. restores the newest full backup into a THROWAWAY local database (never prod),
#   2. starts the backend on it (applying every migration, as a deploy would),
#   3. fills the Test Shop tenant with a copy of Sipra's data,
#   4. starts the frontend and runs the Playwright suite in a real browser.
# Screenshots land in e2e/screenshots. Usage: ./e2e/run.sh [playwright args]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG=/opt/homebrew/opt/postgresql@17/bin
PORT_DB=5433
DB=retailos_e2e
LOCAL_URL="postgres://$(whoami)@localhost:$PORT_DB/$DB?sslmode=disable"
LOG="${TMPDIR:-/tmp}/retailos-e2e"; mkdir -p "$LOG"

case "$LOCAL_URL" in *localhost*) ;; *) echo "refusing: not a local database"; exit 1;; esac

$PG/pg_isready -p $PORT_DB >/dev/null || {
  echo "starting local postgres"; LC_ALL=en_US.UTF-8 $PG/pg_ctl -D /opt/homebrew/var/postgresql@17 -o "-p $PORT_DB" -l "$LOG/pg.log" start >/dev/null; sleep 3; }

# Stop anything left over from an earlier run (the subshells below hide the real PIDs).
stop_stack() { pkill -f "$LOG/retailos" 2>/dev/null || true; pkill -f "$ROOT/frontend/node_modules/.bin/next" 2>/dev/null || true; pkill -f next-server 2>/dev/null || true; }
stop_stack; sleep 1
trap stop_stack EXIT

DUMP="$(ls -d "$ROOT"/backups/full/*/ | sort | tail -1)retailos.dump"
echo "restoring $DUMP into $DB"
$PG/dropdb -p $PORT_DB --if-exists $DB
$PG/createdb -p $PORT_DB $DB
$PG/pg_restore -p $PORT_DB -d $DB --no-owner --exit-on-error "$DUMP"


echo "starting backend"
( cd "$ROOT/backend" && go build -o "$LOG/retailos" ./cmd/server )
( cd "$ROOT/backend" && DATABASE_URL="$LOCAL_URL" "$LOG/retailos" >"$LOG/backend.log" 2>&1 ) &
for i in $(seq 1 30); do curl -sf localhost:8080/health >/dev/null && break; sleep 1; done
curl -sf localhost:8080/health >/dev/null || { echo "backend did not start"; tail "$LOG/backend.log"; exit 1; }
grep -q "000014.*OK" "$LOG/backend.log" || { echo "migration 000014 did not run"; exit 1; }

echo "seeding Test Shop with Sipra's data"
$PG/psql -p $PORT_DB -d $DB -v ON_ERROR_STOP=1 -q -f "$ROOT/e2e/seed_testshop.sql"

echo "starting frontend"
( cd "$ROOT/frontend" && NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev >"$LOG/frontend.log" 2>&1 ) &
for i in $(seq 1 60); do curl -sf localhost:3000/login >/dev/null && break; sleep 1; done

if [ "${KEEP_UP:-}" = 1 ]; then echo "stack up (KEEP_UP=1); Ctrl-C to stop"; wait; fi

cd "$ROOT/e2e"
rm -rf screenshots; mkdir -p screenshots
npx playwright test "$@"
