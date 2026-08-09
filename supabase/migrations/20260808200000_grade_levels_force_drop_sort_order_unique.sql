-- Grade levels: force-remove UNIQUE on sort_order (production still has it).
--
-- Context:
--   Foundation (20260514_foundation_schema.sql) created:
--     constraint grade_levels_sort_order_unique unique (sort_order)
--   Follow-up 20260808120000_grade_levels_drop_sort_order_unique.sql only ran:
--     ALTER TABLE ... DROP CONSTRAINT IF EXISTS grade_levels_sort_order_unique
--   That file is incomplete for production repair because:
--     1) It may never have been applied to production (IF EXISTS is a silent no-op
--        when recording history elsewhere, and it does not verify uniqueness is gone).
--     2) It did not also DROP INDEX IF EXISTS for the same name (UNIQUE INDEX form).
--     3) It did not dynamically discover any other UNIQUE constraint/index solely on
--        sort_order, and it had no assertion that sharing sort_order is allowed.
--
-- This migration:
--   - Drops every UNIQUE constraint whose only column is sort_order
--   - Drops every UNIQUE index whose only column is sort_order
--   - Preserves PK, name uniqueness, and code uniqueness (grade_levels_code_lower_uidx)
--   - Creates a normal non-unique index on sort_order for ordering
--   - Asserts no UNIQUE remains on sort_order alone
--
-- Does not modify or delete grade_level rows.
-- APPLY to production (SQL editor or `supabase db push`) — creating this file does not apply it.

-- Explicit known names from foundation schema (constraint + possible index-only form).
alter table public.grade_levels
  drop constraint if exists grade_levels_sort_order_unique;

drop index if exists public.grade_levels_sort_order_unique;

-- Drop any other UNIQUE constraints that apply only to sort_order.
do $$
declare
  rec record;
begin
  for rec in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'grade_levels'
      and c.contype = 'u'
      and (
        select coalesce(array_agg(a.attname::text order by x.ord), '{}'::text[])
        from unnest(c.conkey) with ordinality as x(attnum, ord)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = x.attnum
         and not a.attisdropped
      ) = array['sort_order']::text[]
  loop
    execute format(
      'alter table public.grade_levels drop constraint if exists %I',
      rec.conname
    );
  end loop;
end $$;

-- Drop any remaining UNIQUE indexes that cover only sort_order
-- (after constraints, so we do not fight constraint-backed indexes).
-- Skips primary key; leaves name / code unique indexes untouched.
do $$
declare
  rec record;
begin
  for rec in
    select idx.relname as index_name
    from pg_index i
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    join pg_class idx on idx.oid = i.indexrelid
    where ns.nspname = 'public'
      and tbl.relname = 'grade_levels'
      and i.indisunique
      and not i.indisprimary
      and (
        select coalesce(array_agg(a.attname::text order by x.ord), '{}'::text[])
        from unnest(i.indkey::smallint[]) with ordinality as x(attnum, ord)
        join pg_attribute a
          on a.attrelid = i.indrelid
         and a.attnum = x.attnum
         and not a.attisdropped
        where x.attnum > 0
      ) = array['sort_order']::text[]
  loop
    execute format('drop index if exists public.%I', rec.index_name);
  end loop;
end $$;

-- Non-unique index for list ordering when many grades share a display order.
create index if not exists grade_levels_sort_order_idx
  on public.grade_levels (sort_order);

-- Verification: fail the migration if UNIQUE on sort_order alone still exists.
do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'grade_levels'
      and c.contype = 'u'
      and (
        select coalesce(array_agg(a.attname::text order by x.ord), '{}'::text[])
        from unnest(c.conkey) with ordinality as x(attnum, ord)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = x.attnum
         and not a.attisdropped
      ) = array['sort_order']::text[]
  ) then
    raise exception
      'grade_levels still has a UNIQUE constraint on sort_order only after cleanup';
  end if;

  if exists (
    select 1
    from pg_index i
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    where ns.nspname = 'public'
      and tbl.relname = 'grade_levels'
      and i.indisunique
      and not i.indisprimary
      and (
        select coalesce(array_agg(a.attname::text order by x.ord), '{}'::text[])
        from unnest(i.indkey::smallint[]) with ordinality as x(attnum, ord)
        join pg_attribute a
          on a.attrelid = i.indrelid
         and a.attnum = x.attnum
         and not a.attisdropped
        where x.attnum > 0
      ) = array['sort_order']::text[]
  ) then
    raise exception
      'grade_levels still has a UNIQUE index on sort_order only after cleanup';
  end if;

  -- Sanity: multiple rows sharing sort_order must be allowed by the catalog.
  -- (No data change — this only documents the intended invariant.)
  -- select count(*) ... group by sort_order having count(*) > 1 would be fine
  -- once duplicates exist; here we assert uniqueness is absent so inserts can share.
  raise notice
    'OK: no UNIQUE constraint/index on grade_levels.sort_order; shared sort_order allowed';
end $$;
