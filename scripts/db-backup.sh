#!/bin/bash
# Ikiss — production database backup
# Usage: NEON_DATABASE_URL=postgres://... ./scripts/db-backup.sh [output_dir]
# Requires: pg_dump 18+ (must match server major version)
# Accepts (in order of precedence): NEON_DATABASE_URL, PROD_DATABASE_URL, PROD_DATABASE

set -euo pipefail

DB_URL="${NEON_DATABASE_URL:-${PROD_DATABASE_URL:-${PROD_DATABASE:-}}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: set NEON_DATABASE_URL (preferred), PROD_DATABASE_URL, or PROD_DATABASE env var"
  exit 1
fi

OUT_DIR="${1:-backups}"
mkdir -p "$OUT_DIR"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$OUT_DIR/ikiss-db-${TIMESTAMP}.sql.gz"

echo "[backup] dumping to $OUT ..."
pg_dump --no-owner --no-acl --clean --if-exists "$DB_URL" | gzip -9 > "$OUT"
SIZE=$(du -h "$OUT" | awk '{print $1}')
echo "[backup] OK — $OUT ($SIZE)"

# Quick stats
TABLES=$(zcat "$OUT" | grep -cE '^CREATE TABLE' || true)
echo "[backup] tables: $TABLES"

# Keep only last 30 backups
cd "$OUT_DIR" && ls -1t ikiss-db-*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
REMAINING=$(ls -1 ikiss-db-*.sql.gz 2>/dev/null | wc -l)
echo "[backup] kept $REMAINING backup(s) in $OUT_DIR/"
