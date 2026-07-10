-- verify-counts.sql
--
-- Emits one `table_name<TAB>row_count` line per public table (excluding the
-- Prisma migration ledger), ordered by table name. Run it against the source
-- and the target after a restore and diff the two outputs - identical output
-- means the data-only restore copied every row.
--
-- Machine-friendly by design: run with `-tA` so there is no header/padding and
-- the output can be diffed directly.
--
-- Usage:
--   psql "$DATABASE_URL" -tAf scripts/verify-counts.sql

SELECT string_agg(line, E'\n' ORDER BY line)
FROM (
  SELECT format(
           E'%s\t%s',
           tablename,
           (xpath('/row/c/text()',
                  query_to_xml(format('SELECT count(*) AS c FROM %I.%I', schemaname, tablename),
                               false, true, ''))
           )[1]::text
         ) AS line
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations'
) counts;
