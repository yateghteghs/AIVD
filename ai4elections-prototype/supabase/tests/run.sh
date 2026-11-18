#!/usr/bin/env bash
# Runs both migrations against a throwaway local PostgreSQL that mimics Supabase's
# roles and auth.uid(), then checks the row-level security rules.
# Needs PostgreSQL 14+ client and server binaries (apt-get install postgresql).
#   bash supabase/tests/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d /tmp/aivd-pgtest.XXXXXX)"
chmod 755 "$TMP"
PORT="${PGPORT_TEST:-54329}"
RUNAS=""
if [ "$(id -u)" = "0" ]; then RUNAS="su postgres -c"; chown postgres "$TMP"; fi
run() { if [ -n "$RUNAS" ]; then $RUNAS "$*"; else bash -c "$*"; fi; }
run "$PGBIN/initdb -D $TMP/data -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $TMP/data -o '-p $PORT -k $TMP' -l $TMP/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $TMP/data -m fast stop >/dev/null"' EXIT
P="psql -h $TMP -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database aivd"
P="$P -d aivd"
$P -f "$HERE/supabase_stub.sql"
$P -f "$HERE/../schema.sql" 2>/dev/null
$P -f "$HERE/../002_dashboard.sql" 2>/dev/null
$P -f "$HERE/../002_dashboard.sql" 2>/dev/null   # must be safe to run twice
OUT="$($P -t -f "$HERE/rls_test.sql" 2>&1)"
echo "$OUT" | grep -E "OK |FAIL|sees|is_reviewer|status now|resolved by" | sed 's/^psql:[^ ]* NOTICE:  /  /'
if echo "$OUT" | grep -q "FAIL"; then echo "Database checks FAILED"; exit 1; fi
echo "$OUT" | grep -q "ALL RLS CHECKS DONE" && echo "Database checks: all passed"
