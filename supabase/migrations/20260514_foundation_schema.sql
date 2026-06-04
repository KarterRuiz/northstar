-- =============================================================================
-- Xiwai Student Growth & Records — foundation schema (first migration)
-- =============================================================================
-- App-facing roles today: admin | teacher | registrar | principal (TS).
-- DB profiles also allow vice_principal for future UI parity.
--
-- Run in Supabase: Dashboard → SQL Editor → New query → paste this file → Run.
-- Or: supabase db push (linked project).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Bumps updated_at on UPDATE for auditable application tables.';

-- -----------------------------------------------------------------------------
-- Tables (uuid PKs; created_at + updated_at)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null
    constraint profiles_role_check
      check (role in ('admin', 'principal', 'vice_principal', 'registrar', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user; role drives RLS. Provision rows via admin SQL or trigger.';

create table if not exists public.school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_years_date_order_chk check (starts_on <= ends_on),
  constraint school_years_label_unique unique (label)
);

create table if not exists public.grade_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null,
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_levels_name_unique unique (name),
  constraint grade_levels_sort_order_unique unique (sort_order)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete restrict,
  grade_level_id uuid not null references public.grade_levels (id) on delete restrict,
  name text not null,
  section text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_id_school_year_key unique (id, school_year_id)
);

create unique index if not exists classes_school_year_name_section_uidx
  on public.classes (school_year_id, name, coalesce(section, ''));

create index if not exists classes_school_year_id_idx on public.classes (school_year_id);

create table if not exists public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'homeroom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_teachers_class_teacher_unique unique (class_id, teacher_profile_id)
);

create index if not exists class_teachers_teacher_idx on public.class_teachers (teacher_profile_id);
create index if not exists class_teachers_class_idx on public.class_teachers (class_id);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  preferred_name text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_external_id_unique unique (external_id)
);

create index if not exists students_last_first_idx on public.students (last_name, first_name);

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  school_year_id uuid not null references public.school_years (id) on delete restrict,
  status text not null default 'active'
    constraint student_enrollments_status_check
      check (status in ('active', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active enrollment per student per class
create unique index if not exists student_enrollments_active_student_class_uidx
  on public.student_enrollments (student_id, class_id)
  where status = 'active';

create index if not exists student_enrollments_student_idx on public.student_enrollments (student_id);
create index if not exists student_enrollments_class_idx on public.student_enrollments (class_id);
create index if not exists student_enrollments_school_year_idx on public.student_enrollments (school_year_id);

-- PG disallows subqueries in CHECK — validate class.school_year_id = enrollment.school_year_id in a trigger.
create or replace function public.enforce_enrollment_school_year_matches_class()
returns trigger
language plpgsql
as $$
declare
  cy uuid;
begin
  select c.school_year_id into cy from public.classes c where c.id = new.class_id;
  if cy is null then
    raise exception 'class_id % not found', new.class_id;
  end if;
  if new.school_year_id is distinct from cy then
    raise exception 'student_enrollments.school_year_id must match classes.school_year_id for class_id';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_student_enrollments_class_year on public.student_enrollments;
create trigger trg_student_enrollments_class_year
  before insert or update of class_id, school_year_id on public.student_enrollments
  for each row execute function public.enforce_enrollment_school_year_matches_class();

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  name text not null,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_school_year_code_unique unique (school_year_id, code)
);

create index if not exists subjects_school_year_id_idx on public.subjects (school_year_id);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete cascade,
  name text not null,
  code text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_date_order_chk check (starts_on <= ends_on),
  constraint terms_school_year_code_unique unique (school_year_id, code)
);

create index if not exists terms_school_year_id_idx on public.terms (school_year_id);

-- Mirrors app transition note form (snake_case columns).
create table if not exists public.transition_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete restrict,
  school_year_id uuid references public.school_years (id) on delete set null,
  status text not null default 'draft'
    constraint transition_notes_status_check
      check (status in ('draft', 'submitted')),
  academic_strengths text not null default '',
  academic_needs text not null default '',
  reading_notes text not null default '',
  writing_notes text not null default '',
  math_notes text not null default '',
  english_language_notes text not null default '',
  learning_habits text not null default '',
  social_emotional_notes text not null default '',
  successful_strategies text not null default '',
  recommended_next_steps text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transition_notes_student_idx on public.transition_notes (student_id);
create index if not exists transition_notes_author_idx on public.transition_notes (author_profile_id);

-- Matches src/types/database.types.ts + upload-report-card-action (school_year + term as text slugs).
create table if not exists public.report_card_files (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  school_year text not null,
  term text not null,
  storage_path text not null,
  title text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_card_files_storage_path_unique unique (storage_path)
);

create index if not exists report_card_files_student_id_idx on public.report_card_files (student_id);
create index if not exists report_card_files_uploaded_by_idx on public.report_card_files (uploaded_by);

create table if not exists public.parent_record_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  status text not null default 'pending'
    constraint parent_record_requests_status_check
      check (status in ('pending', 'in_review', 'approved', 'rejected')),
  details text,
  submitted_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parent_record_requests_student_idx on public.parent_record_requests (student_id);
create index if not exists parent_record_requests_status_idx on public.parent_record_requests (status);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_action_idx on public.audit_events (action);
create index if not exists audit_events_actor_idx on public.audit_events (actor_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $tr$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'school_years',
    'grade_levels',
    'classes',
    'class_teachers',
    'students',
    'student_enrollments',
    'subjects',
    'terms',
    'transition_notes',
    'report_card_files',
    'parent_record_requests',
    'audit_events'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$tr$;

-- -----------------------------------------------------------------------------
-- Role / access helpers (SECURITY DEFINER; fixed search_path)
-- -----------------------------------------------------------------------------
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() limit 1;
$$;

comment on function public.current_profile_role() is
  'Returns profiles.role for the JWT subject, or NULL if no profile row.';

create or replace function public.has_any_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (required_roles)
  );
$$;

create or replace function public.is_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = required_role
  );
$$;

create or replace function public.is_registrar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_role('registrar');
$$;

create or replace function public.is_school_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role (array['admin', 'principal', 'vice_principal']);
$$;

create or replace function public.teacher_assigned_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct se.student_id
  from public.class_teachers ct
  join public.student_enrollments se on se.class_id = ct.class_id
  where ct.teacher_profile_id = auth.uid()
    and se.status = 'active';
$$;

comment on function public.teacher_assigned_student_ids() is
  'Students appearing in active enrollments for classes the caller teaches (class_teachers.teacher_profile_id = auth.uid()).';

create or replace function public.teacher_can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_teachers ct
    join public.student_enrollments se on se.class_id = ct.class_id
    where ct.teacher_profile_id = auth.uid()
      and se.status = 'active'
      and se.student_id = p_student_id
  );
$$;

comment on function public.teacher_can_access_student(uuid) is
  'True when caller is a teacher assigned to any active class containing the student.';

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles p where p.id = auth.uid() limit 1;
$$;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to postgres;

revoke all on function public.current_profile_role() from public;
revoke all on function public.has_any_role(text[]) from public;
revoke all on function public.is_role(text) from public;
revoke all on function public.is_school_leadership() from public;
revoke all on function public.is_registrar() from public;
revoke all on function public.teacher_assigned_student_ids() from public;
revoke all on function public.teacher_can_access_student(uuid) from public;
revoke all on function public.current_profile() from public;
revoke all on function public.enforce_enrollment_school_year_matches_class() from public;

grant execute on function public.current_profile_role() to authenticated, service_role;
grant execute on function public.has_any_role(text[]) to authenticated, service_role;
grant execute on function public.is_role(text) to authenticated, service_role;
grant execute on function public.is_school_leadership() to authenticated, service_role;
grant execute on function public.is_registrar() to authenticated, service_role;
grant execute on function public.teacher_assigned_student_ids() to authenticated, service_role;
grant execute on function public.teacher_can_access_student(uuid) to authenticated, service_role;
grant execute on function public.current_profile() to authenticated, service_role;
grant execute on function public.enforce_enrollment_school_year_matches_class() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.school_years enable row level security;
alter table public.grade_levels enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.subjects enable row level security;
alter table public.terms enable row level security;
alter table public.transition_notes enable row level security;
alter table public.report_card_files enable row level security;
alter table public.parent_record_requests enable row level security;
alter table public.audit_events enable row level security;

-- ---------------- profiles ----------------
drop policy if exists "profiles_select_self_or_staff" on public.profiles;
-- Policy: users read their own profile; leadership/registrar may read all for roster tooling.
create policy "profiles_select_self_or_staff"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.has_any_role (array['admin', 'principal', 'vice_principal', 'registrar'])
  );

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert to authenticated
  with check (public.is_role ('admin'));

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using (public.is_role ('admin'))
  with check (public.is_role ('admin'));

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (public.is_role ('admin'));

-- ---------------- school_years & grade_levels (leadership full; registrar read) ----------------
drop policy if exists "school_years_select_authenticated" on public.school_years;
create policy "school_years_select_authenticated"
  on public.school_years for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "school_years_write_leadership" on public.school_years;
create policy "school_years_write_leadership"
  on public.school_years for all to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "grade_levels_select_authenticated" on public.grade_levels;
create policy "grade_levels_select_authenticated"
  on public.grade_levels for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "grade_levels_write_leadership" on public.grade_levels;
create policy "grade_levels_write_leadership"
  on public.grade_levels for all to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

-- ---------------- classes & class_teachers (leadership full; registrar operational) ----------------
drop policy if exists "classes_select_authenticated" on public.classes;
create policy "classes_select_authenticated"
  on public.classes for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "classes_write_leadership_registrar" on public.classes;
create policy "classes_write_leadership_registrar"
  on public.classes for all to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

drop policy if exists "class_teachers_select_authenticated" on public.class_teachers;
create policy "class_teachers_select_authenticated"
  on public.class_teachers for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "class_teachers_write_leadership_registrar" on public.class_teachers;
create policy "class_teachers_write_leadership_registrar"
  on public.class_teachers for all to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

-- ---------------- students ----------------
drop policy if exists "students_select_policy" on public.students;
create policy "students_select_policy"
  on public.students for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (public.is_role ('teacher') and public.teacher_can_access_student (id))
  );

drop policy if exists "students_write_leadership_registrar" on public.students;
create policy "students_write_leadership_registrar"
  on public.students for all to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

-- ---------------- student_enrollments ----------------
drop policy if exists "student_enrollments_select_policy" on public.student_enrollments;
create policy "student_enrollments_select_policy"
  on public.student_enrollments for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "student_enrollments_write_leadership_registrar" on public.student_enrollments;
create policy "student_enrollments_write_leadership_registrar"
  on public.student_enrollments for all to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

-- ---------------- subjects & terms (read all; leadership+registrar write) ----------------
drop policy if exists "subjects_select_authenticated" on public.subjects;
create policy "subjects_select_authenticated"
  on public.subjects for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "subjects_write_leadership_registrar" on public.subjects;
create policy "subjects_write_leadership_registrar"
  on public.subjects for all to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

drop policy if exists "terms_select_authenticated" on public.terms;
create policy "terms_select_authenticated"
  on public.terms for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "terms_write_leadership_registrar" on public.terms;
create policy "terms_write_leadership_registrar"
  on public.terms for all to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

-- ---------------- transition_notes ----------------
drop policy if exists "transition_notes_select_policy" on public.transition_notes;
create policy "transition_notes_select_policy"
  on public.transition_notes for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and (
        public.teacher_can_access_student (student_id)
        or author_profile_id = auth.uid()
      )
    )
  );

drop policy if exists "transition_notes_insert_policy" on public.transition_notes;
create policy "transition_notes_insert_policy"
  on public.transition_notes for insert to authenticated
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and author_profile_id = auth.uid()
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "transition_notes_update_policy" on public.transition_notes;
create policy "transition_notes_update_policy"
  on public.transition_notes for update to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and author_profile_id = auth.uid()
      and public.teacher_can_access_student (student_id)
    )
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and author_profile_id = auth.uid()
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "transition_notes_delete_leadership" on public.transition_notes;
create policy "transition_notes_delete_leadership"
  on public.transition_notes for delete to authenticated
  using (public.is_school_leadership ());

-- ---------------- report_card_files (registrar + leadership + assigned teachers) ----------------
drop policy if exists "report_card_files_select_policy" on public.report_card_files;
create policy "report_card_files_select_policy"
  on public.report_card_files for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "report_card_files_insert_policy" on public.report_card_files;
create policy "report_card_files_insert_policy"
  on public.report_card_files for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_school_leadership ()
      or public.is_registrar ()
      or (
        public.is_role ('teacher')
        and public.teacher_can_access_student (student_id)
      )
    )
  );

drop policy if exists "report_card_files_update_policy" on public.report_card_files;
create policy "report_card_files_update_policy"
  on public.report_card_files for update to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

drop policy if exists "report_card_files_delete_leadership" on public.report_card_files;
create policy "report_card_files_delete_leadership"
  on public.report_card_files for delete to authenticated
  using (public.is_school_leadership ());

-- ---------------- parent_record_requests (registrar + leadership; teachers read assigned) ----------------
drop policy if exists "parent_record_requests_select_policy" on public.parent_record_requests;
create policy "parent_record_requests_select_policy"
  on public.parent_record_requests for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "parent_record_requests_insert_policy" on public.parent_record_requests;
create policy "parent_record_requests_insert_policy"
  on public.parent_record_requests for insert to authenticated
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

drop policy if exists "parent_record_requests_update_policy" on public.parent_record_requests;
create policy "parent_record_requests_update_policy"
  on public.parent_record_requests for update to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

drop policy if exists "parent_record_requests_delete_leadership" on public.parent_record_requests;
create policy "parent_record_requests_delete_leadership"
  on public.parent_record_requests for delete to authenticated
  using (public.is_school_leadership ());

-- ---------------- audit_events (staff read; any authenticated insert with honest actor) ----------------
drop policy if exists "audit_events_insert_authenticated" on public.audit_events;
create policy "audit_events_insert_authenticated"
  on public.audit_events for insert to authenticated
  with check (
    actor_id is null
    or actor_id = auth.uid()
  );

drop policy if exists "audit_events_select_staff" on public.audit_events;
-- Policy: audit stream is readable by school leadership (admin / principal / vice_principal) only.
create policy "audit_events_select_staff"
  on public.audit_events for select to authenticated
  using (
    public.has_any_role (array['admin', 'principal', 'vice_principal'])
  );

-- Immutable audit stream for JWT roles (no update/delete policies).

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.school_years to authenticated, service_role;
grant select, insert, update, delete on public.grade_levels to authenticated, service_role;
grant select, insert, update, delete on public.classes to authenticated, service_role;
grant select, insert, update, delete on public.class_teachers to authenticated, service_role;
grant select, insert, update, delete on public.students to authenticated, service_role;
grant select, insert, update, delete on public.student_enrollments to authenticated, service_role;
grant select, insert, update, delete on public.subjects to authenticated, service_role;
grant select, insert, update, delete on public.terms to authenticated, service_role;
grant select, insert, update, delete on public.transition_notes to authenticated, service_role;
grant select, insert, update, delete on public.report_card_files to authenticated, service_role;
grant select, insert, update, delete on public.parent_record_requests to authenticated, service_role;
grant select, insert on public.audit_events to authenticated, service_role;

grant all on public.profiles to postgres;
grant all on public.school_years to postgres;
grant all on public.grade_levels to postgres;
grant all on public.classes to postgres;
grant all on public.class_teachers to postgres;
grant all on public.students to postgres;
grant all on public.student_enrollments to postgres;
grant all on public.subjects to postgres;
grant all on public.terms to postgres;
grant all on public.transition_notes to postgres;
grant all on public.report_card_files to postgres;
grant all on public.parent_record_requests to postgres;
grant all on public.audit_events to postgres;
