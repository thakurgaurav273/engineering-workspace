# Migration Readiness Report

**Scope:** Seed the new NestJS/Prisma backend's staging database from the existing
production database. **Date verified against a live restore of production
(`grovyn_prod_snapshot`).**

| Gate | Status |
| ---- | ------ |
| ✅ Schema compatible | New schema is a strict superset of production. 0 breaking changes. |
| ✅ Deployment safe | Prisma migrations create schema only; `_prisma_migrations` is never imported from prod. |
| ✅ Restore tested | Full `pg_dump --data-only` → restore executed; all 22 tables matched row-for-row. |
| ✅ Verification added | Automated row-count parity check that exits non-zero on any mismatch. |
| ✅ Rollback plan | Documented below; staging is disposable and re-seedable in one command. |

---

## ✅ Schema compatible

Proven, not assumed — see **`docs/SCHEMA-COMPATIBILITY.md`** for the full
column/enum/PK diff. Summary:

- All **22** production tables exist unchanged (no rename/merge/split).
- **20** tables added (Business Operations + authorization), all start empty.
- Only shared-table delta: `User.signatureUrl` (added, **nullable**).
- **0** dropped columns, type changes, PK changes, nullable→required, removed
  enums, or removed enum values.
- No required-without-default column was added to any existing table, so a
  data-only `COPY` cannot fail.

**No ETL/transform is needed.** Correct flow: `prod data → new schema → data-only
restore → done`.

## ✅ Deployment safe

- **Migrations create schema only.** `prisma migrate deploy` applies the squashed,
  idempotent baseline `apps/api/prisma/migrations/0_init`. On a fresh staging DB it
  builds the full schema (42 tables / 31 enums / 66 FKs / 122 indexes); on an
  existing one it is a no-op.
- **`_prisma_migrations` is never imported from production.** Every dump step uses
  `--exclude-table=_prisma_migrations`. Staging keeps its own clean `0_init`
  ledger (verified: 1 baseline row, never prod's 10). This avoids reintroducing the
  three phantom foundation migrations that live in prod's ledger but not the repo.
- **Business tables are truncated, not dropped**, before restore
  (`scripts/truncate-business-data.sql`), so the schema and its `0_init` ledger
  row survive re-seeds.

## ✅ Restore tested

Executed end-to-end against the restored production database, twice (proving
idempotency):

1. `prisma migrate deploy` on an empty DB → schema + baseline ledger row.
2. Truncate business tables.
3. `pg_dump --data-only --exclude-table=_prisma_migrations` of production.
4. Load with `session_replication_role = replica` (FK checks off), one transaction.
5. Verify.

**Result:** all 22 production tables restored with exact row-count parity
(e.g. `Notification` 230, `OrganizationSwitchLog` 74, `Session` 63, `User` 21,
`LinearIssue` 61 …). The 20 new tables remained correctly empty. Second run
(truncate + reload) produced identical parity.

## ✅ Verification added

`scripts/verify-restoration.sh` compares `verify-counts.sql` output between source
and target and **exits non-zero unless every production table's count matches**.
It also asserts the target's `_prisma_migrations` was not seeded from prod. It runs
automatically at the end of `restore-prod-data.sh` and can be re-run anytime.

## ✅ Rollback plan

Staging is disposable — nothing here touches production (the scripts read prod as
`SOURCE` and only ever write to `TARGET`, and refuse to run if the two URLs are
equal unless `ALLOW_SAME_DB=1`).

- **Bad restore / partial load:** the load runs in a single transaction, so a
  failure rolls the whole dataset back automatically. Re-run
  `./scripts/restore-prod-data.sh` — step 2 truncates first, giving a clean reload.
- **Wrong data / start over:** re-run the script; it is idempotent.
- **Reset staging entirely:** drop and recreate the staging database, then run the
  script (it will `migrate deploy` the schema fresh).
- **Production impact:** none by construction. No script writes to `SOURCE`.

## Migration / schema drift audit (Step 7)

- **Drift check:** `prisma migrate diff --from-migrations --to-schema-datamodel` →
  **"No difference detected."** The committed migration matches `schema.prisma`.
- **Fixed — missing `migration_lock.toml`:** the migrations directory lacked the
  provider lock file, which broke `prisma migrate diff`/`deploy` tooling
  (`Could not determine the connector from the migrations directory`). Added
  `apps/api/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).
- **Indexes/constraints:** covered by the drift check (it compares the full
  datamodel including indexes and FKs); the restored schema carries all 122
  indexes and 66 foreign keys.
- **Migration ordering:** single squashed baseline; no ordering hazard.

## Dangerous staging behavior audit (Step 6)

A staging box seeded with prod data holds real emails, push tokens, and per-org
Linear API keys. Findings and mitigation (all gated by one env flag,
`STAGING_SAFE_MODE=true`, wired through `docker-compose.yml`; enforced in
`apps/api/src/common/safe-mode.ts`):

| Surface | Location | Risk after restore | Mitigation |
| ------- | -------- | ------------------ | ---------- |
| Emails (Resend) | `platform/mail/mail.service.ts` | Emails real users | Blocked in safe mode (logs instead) |
| Push (Firebase) | `platform/notifications/push/firebase-push.provider.ts` | Pushes to real devices | Blocked in safe mode |
| Cron: check-in/review reminders | `engineering/reminders/reminders.service.ts` (`*/5m`) | Fires reminders/notifications | Skipped in safe mode |
| Cron: weekly digest | `engineering/reminders/reminders.service.ts` (`*/15m`) | Fires digests | Skipped in safe mode |
| Cron: workspace due-date reminders | `workspace/workspace-reminders.service.ts` (daily 9am) | Fires reminders | Skipped in safe mode |
| Cron: Linear sync | `platform/integrations/linear/linear-sync.service.ts` (`*/15m`) | **Hits real Linear workspaces using restored prod API keys** — not stopped by omitting our own creds | Skipped in safe mode |

Not applicable to this stack (searched, none present): SMS/Twilio, outbound
webhooks, BullMQ/queue workers. R2 storage and Firebase/Resend remain shareable —
using separate staging credentials is recommended defense-in-depth, but
`STAGING_SAFE_MODE` blocks all scheduled/outbound activity regardless.

---

## Files changed

### New
- `apps/api/prisma/migrations/migration_lock.toml` — fixes Prisma tooling drift.
- `apps/api/src/common/safe-mode.ts` — `isStagingSafeMode()` kill-switch helper.
- `scripts/restore-prod-data.sh` — orchestrates schema deploy → truncate → dump →
  restore → verify.
- `scripts/verify-restoration.sh` — asserts source/target row-count parity.
- `scripts/truncate-business-data.sql` — empties business tables, keeps schema and
  `_prisma_migrations`.
- `scripts/restore-data.sql` — pure-SQL data-only load (FK checks disabled).
- `scripts/verify-counts.sql` — per-table row counts (diff-friendly).
- `docs/SCHEMA-COMPATIBILITY.md` — the evidence-backed compatibility report.
- `docs/MIGRATION-READINESS.md` — this report.

### Modified
- `apps/api/src/platform/mail/mail.service.ts` — gate `send()` on safe mode.
- `apps/api/src/platform/notifications/push/firebase-push.provider.ts` — gate
  `sendToTokens()` on safe mode.
- `apps/api/src/engineering/reminders/reminders.service.ts` — gate 2 crons.
- `apps/api/src/workspace/workspace-reminders.service.ts` — gate cron.
- `apps/api/src/platform/integrations/linear/linear-sync.service.ts` — gate cron.
- `docker-compose.yml` — pass `STAGING_SAFE_MODE` to the `api` service.
- `.env.example`, `apps/api/.env.example` — document `STAGING_SAFE_MODE`.
- `.gitignore` — ignore `scripts/generated/` (dumps contain real prod data).
- `docs/DEPLOY-STAGING.md` — scripted seed procedure + mandatory `STAGING_SAFE_MODE`.

> Note: `apps/api/prisma/schema.prisma` was already modified in the working tree
> before this task (the superset restructure) and was **not** changed here.
