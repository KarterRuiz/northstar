-- -----------------------------------------------------------------------------
-- Staff attendance (leadership professional record — NOT student attendance)
-- Distinct from public.attendance_records (student_id / class_id scoped).
--
-- Coverage (future): when status is absent / approved_leave / sick / off_campus,
-- a later staff_coverage table can reference staff_attendance.id + covering
-- staff_member_id + class_id. Do not overload this table with coverage rows.
-- -----------------------------------------------------------------------------

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  attendance_date date not null,
  status text not null
    constraint staff_attendance_status_check
      check (
        status in (
          'present',
          'absent',
          'late',
          'approved_leave',
          'sick',
          'professional_development',
          'off_campus',
          'not_recorded'
        )
      ),
  notes text,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_attendance_member_date_uidx
    unique (staff_member_id, attendance_date)
);

comment on table public.staff_attendance is
  'Daily staff presence for leadership; separate from student attendance_records.';

comment on column public.staff_attendance.status is
  'present | absent | late | approved_leave | sick | professional_development | off_campus | not_recorded';

create index if not exists staff_attendance_staff_member_id_idx
  on public.staff_attendance (staff_member_id);

create index if not exists staff_attendance_attendance_date_idx
  on public.staff_attendance (attendance_date);

create index if not exists staff_attendance_date_status_idx
  on public.staff_attendance (attendance_date, status);

drop trigger if exists set_updated_at on public.staff_attendance;
create trigger set_updated_at
  before update on public.staff_attendance
  for each row execute function public.set_updated_at();

alter table public.staff_attendance enable row level security;

-- Private professional data: staff directory managers only (not peer teachers).
drop policy if exists "staff_attendance_select_managers" on public.staff_attendance;
create policy "staff_attendance_select_managers"
  on public.staff_attendance for select to authenticated
  using (public.is_staff_directory_manager ());

drop policy if exists "staff_attendance_write_managers" on public.staff_attendance;
create policy "staff_attendance_write_managers"
  on public.staff_attendance for all to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

grant select, insert, update, delete on public.staff_attendance to authenticated, service_role;
grant all on public.staff_attendance to postgres;
