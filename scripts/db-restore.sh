#!/bin/bash
# Ikiss — restore production-style database from gzipped pg_dump output
# Usage: TARGET_DATABASE_URL=postgres://... ./scripts/db-restore.sh backups/ikiss-db-XXXX.sql.gz
# WARNING: --clean --if-exists in the dump will DROP existing tables before restore.

set -euo pipefail

TARGET="${TARGET_DATABASE_URL:-}"
DUMP="${1:-}"

if [ -z "$TARGET" ] || [ -z "$DUMP" ]; then
  echo "Usage: TARGET_DATABASE_URL=postgres://... $0 path/to/backup.sql.gz"
  exit 1
fi

if [ ! -f "$DUMP" ]; then
  echo "ERROR: backup file not found: $DUMP"
  exit 1
fi

# Safety prompt unless FORCE=1
if [ "${FORCE:-}" != "1" ]; then
  HOST=$(echo "$TARGET" | sed -E 's|postgres(ql)?://[^@]+@([^/]+).*|\2|')
  echo ""
  echo "About to RESTORE: $DUMP"
  echo "       INTO host: $HOST"
  echo "       (DROPs all tables in the target database first)"
  read -p "Type YES to continue: " ans
  [ "$ans" = "YES" ] || { echo "aborted"; exit 1; }
fi

echo "[restore] applying $DUMP ..."
zcat "$DUMP" | psql "$TARGET" -v ON_ERROR_STOP=1
echo "[restore] OK"
