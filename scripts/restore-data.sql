-- restore-data.sql
--
-- Pure-SQL data-only load. Applies a plain-format `--data-only` dump into the
-- CURRENT database with foreign-key enforcement disabled for the duration, which
-- is the in-session equivalent of `pg_restore --disable-triggers` and lets rows
-- load in any order without tripping FK checks.
--
-- `session_replication_role = replica` requires a superuser / rds_superuser role.
-- Everything runs in one transaction: either the whole dataset lands or none of
-- it does.
--
-- The dump file is expected at scripts/generated/prod-data.sql (created by
-- restore-prod-data.sh). `\ir` resolves it relative to THIS file, so the restore
-- works no matter what directory psql is invoked from.
--
-- Usage (normally called by restore-prod-data.sh):
--   psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/restore-data.sql

\set ON_ERROR_STOP on

BEGIN;

-- Disable FK/trigger enforcement so out-of-order COPY blocks load cleanly.
SET session_replication_role = replica;

\echo 'Loading data-only dump (scripts/generated/prod-data.sql)...'
\ir generated/prod-data.sql

-- Restore normal enforcement before commit so the data is validated on write
-- from here on.
SET session_replication_role = origin;

COMMIT;

\echo 'Data-only restore committed.'
