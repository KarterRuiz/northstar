-- Attendance and behavior records for teacher workflows and rule-based support flags.

-- ---------------- attendance_records ----------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  school_year text not null,
  attendance_date date not null,
  status text not null
    constraint attendance_records_status_check
      check (
        status in ('present', 'absent', 'tardy', 'excused', 'partial')
      ),
  notes text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_student_class_date_uidx
    unique (student_id, class_id, attendance_date)
);

comment on table public.attendance_records is
  'Daily class attendance; one row per student, class, and date.';

create index if not exists attendance_records_student_id_idx
  on public.attendance_records (student_id);

create index if not exists attendance_records_class_id_idx
  on public.attendance_records (class_id);

create index if not exists attendance_records_attendance_date_idx
  on public.attendance_records (attendance_date);

create index if not exists attendance_records_school_year_idx
  on public.attendance_records (school_year);

drop trigger if exists set_updated_at on public.attendance_records;
create trigger set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------------- behavior_records ----------------
create table if not exists public.behavior_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  school_year text not null,
  behavior_date date not null,
  behavior_type text not null
    constraint behavior_records_type_check
      check (
        behavior_type in (
          'positive_recognition',
          'classroom_concern',
          'behavior_incident',
          'participation',
          'social_emotional',
          'parent_contact'
        )
      ),
  severity text not null
    constraint behavior_records_severity_check
      check (severity in ('positive', 'low', 'medium', 'high')),
  title text not null,
  description text not null default '',
  action_taken text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.behavior_records is
  'Teacher behavior log entries including positive recognition and concerns.';

create index if not exists behavior_records_student_id_idx
  on public.behavior_records (student_id);

create index if not exists behavior_records_class_id_idx
  on public.behavior_records (class_id);

create index if not exists behavior_records_behavior_date_idx
  on public.behavior_records (behavior_date);

create index if not exists behavior_records_school_year_idx
  on public.behavior_records (school_year);

create index if not exists behavior_records_behavior_type_idx
  on public.behavior_records (behavior_type);

drop trigger if exists set_updated_at on public.behavior_records;
create trigger set_updated_at
  before update on public.behavior_records
  for each row execute function public.set_updated_at();

-- ---------------- RLS ----------------
alter table public.attendance_records enable row level security;
alter table public.behavior_records enable row level security;

-- attendance_records SELECT
drop policy if exists "attendance_records_select" on public.attendance_records;
create policy "attendance_records_select"
  on public.attendance_records for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_is_assigned_to_class (class_id)
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "attendance_records_teacher_insert" on public.attendance_records;
create policy "attendance_records_teacher_insert"
  on public.attendance_records for insert to authenticated
  with check (
    public.is_role ('teacher')
    and recorded_by = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
    and public.student_is_active_in_class (student_id, class_id)
  );

drop policy if exists "attendance_records_teacher_update" on public.attendance_records;
create policy "attendance_records_teacher_update"
  on public.attendance_records for update to authenticated
  using (
    public.is_role ('teacher')
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
  )
  with check (
    public.is_role ('teacher')
    and recorded_by = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
    and public.student_is_active_in_class (student_id, class_id)
  );

-- behavior_records SELECT
drop policy if exists "behavior_records_select" on public.behavior_records;
create policy "behavior_records_select"
  on public.behavior_records for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_is_assigned_to_class (class_id)
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "behavior_records_teacher_insert" on public.behavior_records;
create policy "behavior_records_teacher_insert"
  on public.behavior_records for insert to authenticated
  with check (
    public.is_role ('teacher')
    and recorded_by = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
    and public.student_is_active_in_class (student_id, class_id)
  );

drop policy if exists "behavior_records_teacher_update" on public.behavior_records;
create policy "behavior_records_teacher_update"
  on public.behavior_records for update to authenticated
  using (
    public.is_role ('teacher')
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
  )
  with check (
    public.is_role ('teacher')
    and recorded_by = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
    and public.teacher_can_access_student (student_id)
    and public.student_is_active_in_class (student_id, class_id)
  );

grant select, insert, update on public.attendance_records to authenticated, service_role;
grant select, insert, update on public.behavior_records to authenticated, service_role;
grant all on public.attendance_records to postgres;
grant all on public.behavior_records to postgres;
