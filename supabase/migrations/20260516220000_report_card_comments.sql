-- Narrative report card comments per student, class, school year, and term.
-- Teachers draft/complete; leadership read-only via RLS.

create table if not exists public.report_card_comments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  school_year_id uuid not null references public.school_years (id) on delete restrict,
  term text not null
    constraint report_card_comments_term_check
      check (term in ('T1', 'T2', 'T3', 'T4')),
  narrative_comment text not null default '',
  status text not null default 'draft'
    constraint report_card_comments_status_check
      check (status in ('draft', 'complete')),
  teacher_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_card_comments_student_class_year_term_unique
    unique (student_id, class_id, school_year_id, term)
);

comment on table public.report_card_comments is
  'Teacher narrative comments for report card generation; one row per student/class/year/term.';

create index if not exists report_card_comments_class_id_idx
  on public.report_card_comments (class_id);

create index if not exists report_card_comments_school_year_id_idx
  on public.report_card_comments (school_year_id);

create index if not exists report_card_comments_teacher_profile_id_idx
  on public.report_card_comments (teacher_profile_id);

drop trigger if exists set_updated_at on public.report_card_comments;
create trigger set_updated_at
  before update on public.report_card_comments
  for each row execute function public.set_updated_at();

alter table public.report_card_comments enable row level security;

drop policy if exists "report_card_comments_select_policy" on public.report_card_comments;
create policy "report_card_comments_select_policy"
  on public.report_card_comments for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_is_assigned_to_class (class_id)
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "report_card_comments_insert_policy" on public.report_card_comments;
create policy "report_card_comments_teacher_insert"
  on public.report_card_comments for insert to authenticated
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
    and status = 'draft'
  );

drop policy if exists "report_card_comments_update_policy" on public.report_card_comments;
create policy "report_card_comments_teacher_update"
  on public.report_card_comments for update to authenticated
  using (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
  )
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
    and status in ('draft', 'complete')
  );

grant select, insert, update on public.report_card_comments to authenticated, service_role;
grant all on public.report_card_comments to postgres;
