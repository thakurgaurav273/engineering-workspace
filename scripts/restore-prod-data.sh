#!/usr/bin/env bash
#
# restore-prod-data.sh — seed a staging database with production BUSINESS DATA
# only, on top of a schema created by Prisma migrations.
#
# Pipeline (idempotent, repeatable):
#   1. prisma migrate deploy   -> creates ONLY the schema on the target
#                                 (and a _prisma_migrations ledger holding the
#                                 baseline record, never production's history).
#   2. truncate-business-data  -> empties business tables, keeps the schema.
#   3. pg_dump --data-only     -> production data, EXCLUDING _prisma_migrations.
#   4. restore-data.sql        -> loads the dump with FK checks disabled.
#   5. verify-restoration.sh   -> asserts source/target row counts match.
#
# It NEVER copies _prisma_migrations and NEVER restores schema objects from prod,
# so the target's schema is always exactly what the committed migrations define.
#
# Required env:
#   SOURCE_DATABASE_URL   Postgres URL to read production data from.
#   TARGET_DATABASE_URL   Postgres URL of the staging DB to seed.
#
# Optional env:
#   SKIP_MIGRATE=1        Skip step 1 (schema already deployed).
#   ALLOW_SAME_DB=1       Bypass the source==target safety guard (never in prod).
#
# Usage:
#   SOURCE_DATABASE_URL=postgres://... TARGET_DATABASE_URL=postgres://... \
#     ./scripts/restore-prod-data.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
GEN_DIR="$SCRIPT_DIR/generated"
DUMP_FILE="$GEN_DIR/prod-data.sql"

log()  { printf '\033[1;34m[restore]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[restore:ERROR]\033[0m %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

# --- preconditions ----------------------------------------------------------
: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL to the production data source}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL to the staging database}"
command -v psql    >/dev/null || die "psql not found on PATH"
command -v pg_dump >/dev/null || die "pg_dump not found on PATH"

# Safety: refuse to restore a database onto itself unless explicitly allowed.
if [[ "$SOURCE_DATABASE_URL" == "$TARGET_DATABASE_URL" && "${ALLOW_SAME_DB:-0}" != "1" ]]; then
  die "SOURCE and TARGET are identical. Refusing to run. Set ALLOW_SAME_DB=1 only if you are certain."
fi

log "Source: $(sed -E 's#(://[^:]+:)[^@]+@#\1****@#' <<<"$SOURCE_DATABASE_URL")"
log "Target: $(sed -E 's#(://[^:]+:)[^@]+@#\1****@#' <<<"$TARGET_DATABASE_URL")"

# --- 1. schema via Prisma migrations ---------------------------------------
if [[ "${SKIP_MIGRATE:-0}" == "1" ]]; then
  log "SKIP_MIGRATE=1 -> assuming schema already deployed"
else
  log "Deploying schema (prisma migrate deploy) - schema only, no data"
  ( cd "$API_DIR" && DATABASE_URL="$TARGET_DATABASE_URL" npx prisma migrate deploy )
fi

# --- 2. truncate business data ---------------------------------------------
log "Truncating business tables on target (schema preserved)"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/truncate-business-data.sql"

# --- 3. dump production data-only, excluding _prisma_migrations -------------
mkdir -p "$GEN_DIR"
log "Dumping production data (data-only, excluding _prisma_migrations)"
# Strip the PG17+ `SET transaction_timeout` line: a dump taken with a newer
# client must still load into an older (e.g. PG16) server under ON_ERROR_STOP.
pg_dump "$SOURCE_DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-table='_prisma_migrations' \
  | grep -v '^SET transaction_timeout' \
  > "$DUMP_FILE"
log "Dump written: $DUMP_FILE ($(wc -l < "$DUMP_FILE") lines)"

# --- 4. load data-only into target -----------------------------------------
log "Restoring data into target (FK checks disabled during load)"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$SCRIPT_DIR/restore-data.sql"

# --- 5. verify --------------------------------------------------------------
log "Verifying row counts (source vs target)"
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" TARGET_DATABASE_URL="$TARGET_DATABASE_URL" \
  "$SCRIPT_DIR/verify-restoration.sh"

log "Done. Staging seeded with production business data."
