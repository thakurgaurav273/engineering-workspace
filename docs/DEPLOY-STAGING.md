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

## Restoring or seeding staging from production

Staging starts with an empty database and no users. To copy production data in:

```sh
# on the prod host
pg_dump -U <user> -d grovyn_one -Fc > prod.dump

# into the staging postgres container
pg_restore -U postgres -d grovyn_one --clean --no-owner < prod.dump
```

Both databases share the same schema, so no migration step is needed after a restore.
