# Deploying to staging (Dokploy Compose)

The staging app (`grovyn-one-stage`) is a Dokploy **Compose** service that builds
the root `docker-compose.yml` from a GitHub branch. It brings up three
containers: `postgres`, `api`, and `web`.

## Prerequisites

Dokploy clones the branch and runs:

```
docker compose -p grovyn-one-stage-<id> -f ./docker-compose.yml up -d --build --remove-orphans
```

so the branch must contain a `docker-compose.yml` whose build contexts resolve:

| service | context     | dockerfile           |
| ------- | ----------- | -------------------- |
| `api`   | `./apps/api`| `Dockerfile`         |
| `web`   | `.` (root)  | `apps/web/Dockerfile`|

The `web` image must build from the repo root because it copies the workspace
manifests (`apps/*`, `packages/*`). The `api` image is self-contained — it has no
workspace dependencies — so it builds from `apps/api` alone.

## Environment variables

Set these in Dokploy → the Compose service → **Environment**. Everything below is
required; a blank value is silently interpolated as an empty string.

`NEXT_PUBLIC_*` are consumed as **build args** and inlined into the client bundle.
Changing one requires a rebuild, not just a restart.

```
POSTGRES_PASSWORD=
JWT_SECRET=
JWT_REFRESH_SECRET=
FRONTEND_URL=https://stage.grovyn.in
ENCRYPTION_KEY=
RESEND_API_KEY=
MAIL_FROM=Grovyn One <onboarding@grovyn.in>

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

NEXT_PUBLIC_API_URL=https://stage-api.grovyn.in
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_FLAG_REGISTRY_NAV=true
NEXT_PUBLIC_FLAG_PLATFORM_SHELL=true
```

`POSTGRES_USER` (`postgres`), `POSTGRES_DB` (`grovyn_one`), `JWT_ACCESS_EXPIRES_IN`
(`15m`) and `JWT_REFRESH_EXPIRES_IN` (`7d`) have compose defaults and may be omitted.

## Database

The `api` container runs `npx prisma migrate deploy` before starting. Migration
history is a single squashed baseline, `prisma/migrations/0_init`, generated from
`schema.prisma`.

Every statement in that baseline is idempotent (`CREATE TABLE IF NOT EXISTS`,
enum and constraint creation wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object`).
That means:

- **Fresh database** (staging): the baseline creates the full schema — 42 tables,
  31 enums, 66 foreign keys.
- **Database that already has the schema** (an existing deployment adopting this
  branch): the baseline is a no-op. `migrate deploy` records it and touches no data,
  so no manual `migrate resolve` step is needed.

### Why the history was squashed

Three original foundation migrations (`20260630225640_foundation`,
`20260701125516_engineering_foundation`, `20260701134240_engineering_vision_correction`)
were never committed to git. Migration history therefore began mid-story, at
`add_task_updates`, which `ALTER`s tables and enums that nothing in the repo creates.
A fresh `migrate deploy` failed immediately with:

```
Error: type "NotificationType" does not exist
```

Prisma stores only a checksum of each applied migration, not its SQL, so the lost
migrations could not be recovered. Squashing to a baseline generated from
`schema.prisma` is Prisma's documented remedy. The 26 superseded migration files
remain in git history at commit `b544f00`.

### Never run `migrate dev` against a database you care about

`npm run api:db:migrate` maps to `prisma migrate dev`, which offers to **reset the
database** when it detects history divergence. Use `prisma migrate deploy` for any
database holding real data.

## Seeding staging from production

Staging starts with the full `dev` schema and only bootstrap rows (permissions,
roles). To load real production data into it, use a **data-only** copy — NOT a
full `pg_dump | pg_restore --clean`.

Two reasons the data-only path is required:

1. **Keep staging's migration history clean.** Prod's `_prisma_migrations` table
   still contains the three phantom foundation migrations that don't exist in the
   repo. Importing those rows would reintroduce the "migration in DB, not in repo"
   problem that `0_init` was created to fix, and could make the api container fail
   its next `migrate deploy`. Excluding `_prisma_migrations` keeps staging on its
   clean `0_init` baseline.
2. **Schema is a superset, not a match.** `dev` (staging) has **20 tables** that
   `main` (prod) does not — the Business Operations / authorization tables. `dev`
   adds only new tables and columns and alters none of prod's, so prod rows load
   into staging's schema with no column conflicts, and the extra tables simply
   stay empty. A `--clean` restore would instead drop and reshape staging's schema
   to prod's.

   This superset claim is not assumed — it is verified against a live restore of
   the production database. See `docs/SCHEMA-COMPATIBILITY.md` for the
   column-by-column, enum, and primary-key comparison (result: **0 breaking
   changes**; the only shared-table delta is the nullable `User.signatureUrl`).

### Automated path (recommended)

Use the committed, idempotent scripts under `scripts/`. They do exactly the
data-only flow — deploy schema, truncate business tables, dump prod data
excluding `_prisma_migrations`, restore with FK checks disabled, then verify
row-count parity — and refuse to finish if any production table's count doesn't
match.

```sh
# Point at the two databases. On the Dokploy host these are the prod and stage
# postgres containers; locally they can be any two Postgres URLs.
export SOURCE_DATABASE_URL="postgresql://postgres:<pw>@<prod-host>:5432/grovyn_one"
export TARGET_DATABASE_URL="postgresql://postgres:<pw>@<stage-host>:5432/grovyn_one"

./scripts/restore-prod-data.sh
```

What it runs, in order:

| step | file | effect |
| ---- | ---- | ------ |
| 1 | `prisma migrate deploy` | creates ONLY the schema + a baseline `_prisma_migrations` row (never prod's history). Skip with `SKIP_MIGRATE=1` if already deployed. |
| 2 | `scripts/truncate-business-data.sql` | empties every business table, keeps the schema, leaves `_prisma_migrations` alone. |
| 3 | `pg_dump --data-only --exclude-table=_prisma_migrations` | production business data only. |
| 4 | `scripts/restore-data.sql` | loads the dump in one transaction with `session_replication_role = replica` (FK checks off). |
| 5 | `scripts/verify-restoration.sh` | asserts source and target row counts match for all 22 production tables; exits non-zero on any mismatch. |

Re-runnable: step 2 truncates first, so running it again reloads cleanly.
`scripts/verify-restoration.sh` can also be run on its own at any time to
re-check parity.

### Manual path (equivalent, run on the Dokploy host)

If you'd rather run it by hand inside the containers — match `-U` to each
project's `POSTGRES_USER`:

```sh
PROD_PG=$(docker ps --format '{{.Names}}' | grep postgres | grep -vi stage | head -1)
STAGE_PG=$(docker ps --format '{{.Names}}' | grep postgres | grep -i stage | head -1)
echo "prod=$PROD_PG  stage=$STAGE_PG"   # sanity-check before continuing

# 1. Dump prod DATA only, excluding the migration bookkeeping table
docker exec "$PROD_PG" pg_dump -U postgres -d grovyn_one \
  --data-only --no-owner --disable-triggers \
  --exclude-table=_prisma_migrations -Fc > /tmp/prod_data.dump

# 2. Clear staging's bootstrap rows (keep schema + the 0_init row)
docker exec -i "$STAGE_PG" psql -U postgres -d grovyn_one <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  SET session_replication_role = replica;   -- suspend FK checks during truncate
  FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname='public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE 'TRUNCATE TABLE public."' || r.tablename || '" RESTART IDENTITY CASCADE';
  END LOOP;
END $$;
SQL

# 3. Load prod data into staging
docker exec -i "$STAGE_PG" pg_restore -U postgres -d grovyn_one \
  --data-only --disable-triggers --no-owner < /tmp/prod_data.dump
```

No migration step is needed afterward — staging's schema already covers every
prod table, and `_prisma_migrations` is untouched.

### Required: turn on `STAGING_SAFE_MODE` before restoring prod data

A staging box seeded with production data holds **real** user emails, push
tokens, and per-org Linear API keys. Left unguarded, its scheduled jobs would
email real users, push to real devices, and pull real Linear workspaces using the
restored keys — the last of which is **not** prevented by simply omitting your own
Resend/Firebase credentials, because those keys live in the restored data.

Set `STAGING_SAFE_MODE=true` in the staging Compose environment. It is a single
kill switch, wired through `docker-compose.yml`, that:

- short-circuits **every** `@Cron` job — the check-in/review reminders
  (`*/5m`), the weekly digest (`*/15m`), the workspace due-date reminders
  (daily 9am), and the Linear sync (`*/15m`); and
- blocks the **mail** (Resend) and **push** (Firebase) providers from making any
  outbound call — they log and return instead.

This is automatic and code-enforced (`apps/api/src/common/safe-mode.ts`), so it
cannot be forgotten per-action. Using a separate R2 bucket / Firebase project /
Resend key for staging is still good defense-in-depth, but with `STAGING_SAFE_MODE`
on, nothing schedules or sends regardless.

Leave `STAGING_SAFE_MODE` unset (or `false`) in production.
