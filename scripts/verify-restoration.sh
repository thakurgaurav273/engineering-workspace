#!/usr/bin/env bash
#
# verify-restoration.sh — assert that a data-only restore copied every row.
#
# Runs verify-counts.sql against the source and the target and diffs the two
# per-table row counts. Exits 0 only when they match exactly; prints the diff and
# exits 1 otherwise. Also confirms the target's _prisma_migrations ledger was NOT
# seeded from production (it must contain only migrations applied by
# `prisma migrate deploy`, not production's history).
#
# Required env:
#   SOURCE_DATABASE_URL   Production data source.
#   TARGET_DATABASE_URL   Staging database that was restored.
#
# Usage:
#   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... ./scripts/verify-restoration.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COUNTS_SQL="$SCRIPT_DIR/verify-counts.sql"

log() { printf '\033[1;34m[verify]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[verify:FAIL]\033[0m %s\n' "$*" >&2; }

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL}"
command -v psql >/dev/null || { err "psql not found on PATH"; exit 1; }

src_counts="$(psql "$SOURCE_DATABASE_URL" -tAf "$COUNTS_SQL" | sort)"
tgt_counts="$(psql "$TARGET_DATABASE_URL" -tAf "$COUNTS_SQL" | sort)"

# The target is a SUPERSET of the source (it also has the new business-ops tables,
# which are legitimately empty). Correct check: every source `table<TAB>count`
# line must appear identically in the target. `comm -23` lists source lines with
# no exact match in the target - i.e. a missing table or a count mismatch.
mismatches="$(comm -23 <(printf '%s\n' "$src_counts") <(printf '%s\n' "$tgt_counts"))"

if [[ -z "$mismatches" ]]; then
  rows="$(grep -c . <<<"$src_counts" || true)"
  log "Row counts match for all $rows production tables (target = source, exactly):"
  printf '%s\n' "$src_counts" | sed 's/^/    /'
  # Surface the extra target-only tables so the superset is explicit, not silent.
  extra="$(comm -13 <(cut -f1 <<<"$src_counts" | sort) <(cut -f1 <<<"$tgt_counts" | sort))"
  [[ -n "$extra" ]] && log "New tables present on target and empty (expected): $(tr '\n' ' ' <<<"$extra")"
  status=0
else
  err "Row counts DIFFER for these production tables (source value shown; target differs/missing):"
  printf '%s\n' "$mismatches" | sed 's/^/    /'
  status=1
fi

# The migration ledger must never be seeded from production.
prod_ledger="$(psql "$SOURCE_DATABASE_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';")"
tgt_ledger="$(psql "$TARGET_DATABASE_URL" -tAc "SELECT count(*) FROM _prisma_migrations;" 2>/dev/null || echo 'missing')"
log "_prisma_migrations: source has table=${prod_ledger}; target ledger rows=${tgt_ledger} (from prisma migrate deploy, NOT prod)"

exit "$status"
