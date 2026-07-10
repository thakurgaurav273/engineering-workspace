-- truncate-business-data.sql
--
-- Empties every business table WITHOUT touching the schema, so a fresh
-- data-only restore can be loaded into an already-migrated database.
--
-- Deliberately excludes `_prisma_migrations`: the migration ledger is owned by
-- `prisma migrate deploy`, never by the data restore. Truncating it would make
-- Prisma think the schema was never applied.
--
-- Schema-independent: it discovers the current set of public tables at runtime,
-- so tables added by future migrations are covered automatically. CASCADE lets a
-- single statement clear tables regardless of foreign-key ordering; since every
-- business table is in the list, CASCADE never reaches anything unexpected.
--
-- Usage:
--   psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/truncate-business-data.sql

DO $$
DECLARE
  table_list text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO table_list
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';

  IF table_list IS NULL THEN
    RAISE NOTICE 'No business tables found in public schema - nothing to truncate.';
  ELSE
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
    RAISE NOTICE 'Truncated business tables: %', table_list;
  END IF;
END $$;
