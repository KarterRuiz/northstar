-- Structured academic records: teacher entry, leadership review, registrar read.
-- Align term slugs with REPORT_CARD_TERMS (T1–T4). Apply before using academic record UI.

create table if not exists public.academic_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  subject text not null,
  term text
    constraint academic_records_term_check
      check (term is null or term in ('T1', 'T2', 'T3', 'T4')),
  score_or_grade text,
  performance_level text,
  teacher_comment text,
  work_habits text,
  teacher_profile_id uuid not null references public.profiles (id) on delete restrict,
  school_year_id uuid not null references public.school_years (id) on delete restrict,
  status text not null default 'draft'
    constraint academic_records_status_check
      check (status in ('draft', 'submitted', 'reviewed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academic_records is
  'Teacher-entered structured grades/comments per student, class, and subject; not PDF report cards.';

create index if not exists academic_records_student_id_idx
  on public.academic_records (student_id);

create index if not exists academic_records_class_id_idx
  on public.academic_records (class_id);

create index if not exists academic_records_school_year_id_idx
  on public.academic_records (school_year_id);

create index if not exists academic_records_status_idx
  on public.academic_records (status);

create index if not exists academic_records_teacher_profile_id_idx
  on public.academic_records (teacher_profile_id);

drop trigger if exists set_updated_at on public.academic_records;
create trigger set_updated_at
  before update on public.academic_records
  for each row execute function public.set_updated_at();

alter table public.academic_records enable row level security;

-- ---------------- SELECT ----------------
drop policy if exists "academic_records_select_policy" on public.academic_records;

create policy "academic_records_select_policy"
  on public.academic_records for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and teacher_profile_id = auth.uid ()
      and public.teacher_can_access_student (student_id)
      and public.teacher_is_assigned_to_class (class_id)
    )
  );

-- ---------------- INSERT ----------------
drop policy if exists "academic_records_insert_policy" on public.academic_records;

create policy "academic_records_teacher_insert"
  on public.academic_records for insert to authenticated
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_can_access_student (student_id)
    and public.teacher_is_assigned_to_class (class_id)
    and status = 'draft'
  );

-- ---------------- UPDATE ----------------
drop policy if exists "academic_records_update_policy" on public.academic_records;

create policy "academic_records_teacher_update"
  on public.academic_records for update to authenticated
  using (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_can_access_student (student_id)
    and public.teacher_is_assigned_to_class (class_id)
    and status = 'draft'
  )
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_can_access_student (student_id)
    and public.teacher_is_assigned_to_class (class_id)
    and status in ('draft', 'submitted')
  );

create policy "academic_records_leadership_update"
  on public.academic_records for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

-- ---------------- DELETE (leadership only) ----------------
drop policy if exists "academic_records_delete_leadership" on public.academic_records;

create policy "academic_records_delete_leadership"
  on public.academic_records for delete to authenticated
  using (public.is_school_leadership ());

grant select, insert, update, delete on public.academic_records to authenticated, service_role;
grant all on public.academic_records to postgres;
