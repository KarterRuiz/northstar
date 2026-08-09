-- Grade levels: soft-archive support + optional unique code (when safe).
-- Classes keep ON DELETE RESTRICT on grade_level_id; archive preserves history.
--
-- APPLY: This migration must be applied to every Supabase environment (local + production)
-- before app code that selects/filters on grade_levels.is_archived will work.
-- Admin → Classes and School settings → Academic structure both select is_archived.
-- Example: `supabase db push` (linked project) or run this file in the Supabase SQL editor.
-- If you already applied 20260807121000_school_years_current_and_archive.sql manually,
-- still apply THIS file — it is a separate migration and is not included in that one.

alter table public.grade_levels
  add column if not exists is_archived boolean not null default false;

comment on column public.grade_levels.is_archived is
  'When true, grade is hidden from new class setup but kept for historical classes.';

create index if not exists grade_levels_is_archived_idx
  on public.grade_levels (is_archived);

-- Unique short code among non-empty codes, only when no duplicates already exist.
do $$
begin
  if not exists (
    select 1
    from public.grade_levels
    where code is not null
      and btrim(code) <> ''
    group by lower(btrim(code))
    having count(*) > 1
  ) then
    create unique index if not exists grade_levels_code_lower_uidx
      on public.grade_levels (lower(btrim(code)))
      where code is not null and btrim(code) <> '';
  end if;
end $$;
