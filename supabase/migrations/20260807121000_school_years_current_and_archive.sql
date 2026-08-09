-- School years: current operational year, archive (no hard delete), safer label uniqueness.
--
-- APPLY: This migration must be applied to every Supabase environment (local + production)
-- before app code that selects/filters on school_years.is_current or archived_at will work.
-- Example: `supabase db push` (linked project) or run this file in the Supabase SQL editor.
--
-- Existing exact UNIQUE (label) remains. Visual duplicates often come from dash variants
-- (ASCII hyphen "-" vs en dash "–" used in seed). See diagnosis queries at bottom.
--
-- This migration does NOT merge or delete duplicate rows (would orphan classes / enrollments).

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.school_years
  add column if not exists is_current boolean not null default false;

alter table public.school_years
  add column if not exists archived_at timestamptz;

comment on column public.school_years.is_current is
  'Exactly one active (non-archived) year should be current; enforced by partial unique index.';

comment on column public.school_years.archived_at is
  'When set, year is archived for history; rows and dependent records are retained.';

-- Archived years cannot remain Current.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.school_years'::regclass
      and conname = 'school_years_archived_not_current_chk'
  ) then
    alter table public.school_years
      add constraint school_years_archived_not_current_chk
      check (archived_at is null or is_current = false);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- At most one Current school year
-- -----------------------------------------------------------------------------
create unique index if not exists school_years_one_current_uidx
  on public.school_years (is_current)
  where is_current = true;

-- Bootstrap: if nothing is current, pick one non-archived year safely.
-- Prefer the year whose date range contains today; among ties / alternatives,
-- prefer the year with the most dependent operational rows (classes + enrollments)
-- so we do not arbitrarily favor a near-empty duplicate of e.g. 2025–2026.
-- Final tie-break: latest starts_on, then created_at.
update public.school_years sy
set is_current = true
where sy.id = (
  select candidate.id
  from public.school_years candidate
  left join lateral (
    select
      (select count(*)::bigint from public.classes c where c.school_year_id = candidate.id)
      + (select count(*)::bigint from public.student_enrollments e where e.school_year_id = candidate.id)
      as dep_count
  ) deps on true
  where candidate.archived_at is null
  order by
    case
      when candidate.starts_on <= current_date and current_date <= candidate.ends_on then 0
      else 1
    end,
    deps.dep_count desc,
    candidate.starts_on desc,
    candidate.created_at desc
  limit 1
)
and not exists (
  select 1 from public.school_years where is_current = true
);

-- -----------------------------------------------------------------------------
-- Normalized label uniqueness (dash / whitespace tolerant)
-- Only created when no conflicting groups exist — never fails the migration.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_school_year_label(raw text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    lower(btrim(coalesce(raw, ''))),
    E'[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\\-–—]+',
    '-',
    'g'
  );
$$;

comment on function public.normalize_school_year_label(text) is
  'Collapse hyphen/dash variants and trim for school year label uniqueness checks.';

do $$
declare
  conflict_count int;
begin
  select count(*)::int into conflict_count
  from (
    select public.normalize_school_year_label(label) as norm
    from public.school_years
    group by 1
    having count(*) > 1
  ) d;

  if conflict_count = 0 then
    execute $idx$
      create unique index if not exists school_years_label_normalized_uidx
        on public.school_years (public.normalize_school_year_label(label))
    $idx$;
  else
    raise notice
      'school_years: skipped school_years_label_normalized_uidx (% conflicting normalized label group(s)). Clean up duplicates, then create the index manually.',
      conflict_count;
  end if;
end $$;

-- Ensure the original exact unique constraint exists (idempotent for older DBs).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.school_years'::regclass
      and conname = 'school_years_label_unique'
  ) then
    begin
      alter table public.school_years
        add constraint school_years_label_unique unique (label);
    exception
      when unique_violation then
        raise notice
          'school_years: could not add school_years_label_unique (exact duplicate labels exist). Resolve duplicates first.';
    end;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- DIAGNOSIS (run in SQL editor; do not auto-merge)
-- -----------------------------------------------------------------------------
-- Seed canonical id (if seed applied): 10000000-0000-4000-8000-000000000001
-- Label in seed uses Unicode en dash: '2025–2026' (U+2013), not ASCII '-'.
--
-- List all years:
--   select id, label, starts_on, ends_on, is_current, archived_at,
--          public.normalize_school_year_label(label) as label_norm,
--          encode(convert_to(label, 'UTF8'), 'hex') as label_hex
--   from public.school_years
--   order by starts_on desc;
--
-- Find normalized duplicate groups:
--   select public.normalize_school_year_label(label) as label_norm,
--          count(*) as row_count,
--          array_agg(id order by created_at) as ids,
--          array_agg(label order by created_at) as labels
--   from public.school_years
--   group by 1
--   having count(*) > 1;
--
-- Dependency counts per year id (replace :id):
--   select
--     (select count(*) from public.classes c where c.school_year_id = :id) as classes,
--     (select count(*) from public.student_enrollments e where e.school_year_id = :id) as enrollments,
--     (select count(*) from public.subjects s where s.school_year_id = :id) as subjects,
--     (select count(*) from public.terms t where t.school_year_id = :id) as terms,
--     (select count(*) from public.transition_notes n where n.school_year_id = :id) as transition_notes,
--     (select count(*) from public.academic_records a where a.school_year_id = :id) as academic_records,
--     (select count(*) from public.report_card_comments r where r.school_year_id = :id) as report_card_comments,
--     (select count(*) from public.student_interventions i where i.school_year_id = :id) as interventions;
