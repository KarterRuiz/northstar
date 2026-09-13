-- Allow term date ranges to be unset until school policy defines them.
-- Enables creating T1–T4 scaffolding for a school year without inventing dates.
-- Report-card / admin "completed term" logic must treat null ends_on as not ended.

alter table public.terms
  alter column starts_on drop not null;

alter table public.terms
  alter column ends_on drop not null;

-- Keep order check when both bounds are present.
alter table public.terms
  drop constraint if exists terms_date_order_chk;

alter table public.terms
  add constraint terms_date_order_chk
  check (
    starts_on is null
    or ends_on is null
    or starts_on <= ends_on
  );

comment on column public.terms.starts_on is
  'Term start date; null until school sets the calendar range.';

comment on column public.terms.ends_on is
  'Term end date; null until school sets the calendar range. Null means not completed.';
