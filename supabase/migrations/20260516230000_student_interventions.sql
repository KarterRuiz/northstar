-- Teacher-led student interventions tied to class and school year.

create table if not exists public.student_interventions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  school_year_id uuid not null references public.school_years (id) on delete restrict,
  intervention_type text not null
    constraint student_interventions_type_check
      check (
        intervention_type in (
          'academic_support',
          'missing_work',
          'attendance',
          'behavior',
          'enrichment',
          'parent_contact',
          'reteach',
          'SEL_support'
        )
      ),
  status text not null default 'active'
    constraint student_interventions_status_check
      check (status in ('active', 'monitoring', 'resolved', 'escalated')),
  severity text not null default 'medium'
    constraint student_interventions_severity_check
      check (severity in ('low', 'medium', 'high')),
  title text not null,
  description text not null default '',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  follow_up_date date
);

comment on table public.student_interventions is
  'Teacher support interventions for students in assigned classes.';

create index if not exists student_interventions_student_id_idx
  on public.student_interventions (student_id);

create index if not exists student_interventions_class_id_idx
  on public.student_interventions (class_id);

create index if not exists student_interventions_school_year_id_idx
  on public.student_interventions (school_year_id);

create index if not exists student_interventions_status_idx
  on public.student_interventions (status);

drop trigger if exists set_updated_at on public.student_interventions;
create trigger set_updated_at
  before update on public.student_interventions
  for each row execute function public.set_updated_at();

alter table public.student_interventions enable row level security;

drop policy if exists "student_interventions_select_policy" on public.student_interventions;
create policy "student_interventions_select_policy"
  on public.student_interventions for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_is_assigned_to_class (class_id)
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "student_interventions_insert_policy" on public.student_interventions;
create policy "student_interventions_teacher_insert"
  on public.student_interventions for insert to authenticated
  with check (
    public.is_role ('teacher')
    and created_by = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
  );

drop policy if exists "student_interventions_update_policy" on public.student_interventions;
create policy "student_interventions_teacher_update"
  on public.student_interventions for update to authenticated
  using (
    public.is_role ('teacher')
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
  )
  with check (
    public.is_role ('teacher')
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
  );

grant select, insert, update on public.student_interventions to authenticated, service_role;
grant all on public.student_interventions to postgres;
