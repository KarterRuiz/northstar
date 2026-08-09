-- -----------------------------------------------------------------------------
-- Staff grade-level access + pending grades on invitations
-- Extends staff onboarding so invites can prepare grade + class access before accept.
-- -----------------------------------------------------------------------------

-- Active grade access for staff (normalized; not comma-separated strings).
create table if not exists public.staff_grade_levels (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  grade_level_id uuid not null references public.grade_levels (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint staff_grade_levels_profile_grade_unique unique (profile_id, grade_level_id)
);

comment on table public.staff_grade_levels is
  'Program/grade scope for staff; distinct from class_teachers class access.';

create index if not exists staff_grade_levels_profile_idx
  on public.staff_grade_levels (profile_id);

create index if not exists staff_grade_levels_grade_idx
  on public.staff_grade_levels (grade_level_id);

alter table public.staff_grade_levels enable row level security;

drop policy if exists "staff_grade_levels_select_authenticated" on public.staff_grade_levels;
create policy "staff_grade_levels_select_authenticated"
  on public.staff_grade_levels for select to authenticated
  using (
    public.is_staff_directory_manager ()
    or profile_id = auth.uid()
  );

drop policy if exists "staff_grade_levels_write_managers" on public.staff_grade_levels;
create policy "staff_grade_levels_write_managers"
  on public.staff_grade_levels for all to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

grant select, insert, update, delete on public.staff_grade_levels to authenticated, service_role;
grant all on public.staff_grade_levels to postgres;

-- Pending grade access on invitations (mirrors pending_class_ids architecture).
alter table public.staff_invitations
  add column if not exists pending_grade_level_ids uuid[] not null default '{}'::uuid[];

comment on column public.staff_invitations.pending_grade_level_ids is
  'Grade levels to attach via staff_grade_levels when the invitee completes first sign-in.';

-- -----------------------------------------------------------------------------
-- Teacher access helpers: class assignments take precedence; grade-only expands
-- access to classes/students within assigned grades when no class_teachers rows.
-- -----------------------------------------------------------------------------

create or replace function public.teacher_has_explicit_class_assignments()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_teachers ct
    where ct.teacher_profile_id = auth.uid()
  );
$$;

comment on function public.teacher_has_explicit_class_assignments() is
  'True when the caller has at least one class_teachers row.';

create or replace function public.teacher_can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.class_teachers ct
      where ct.teacher_profile_id = auth.uid()
        and ct.class_id = p_class_id
    )
    or (
      not public.teacher_has_explicit_class_assignments ()
      and exists (
        select 1
        from public.classes c
        join public.staff_grade_levels sgl
          on sgl.grade_level_id = c.grade_level_id
         and sgl.profile_id = auth.uid()
        where c.id = p_class_id
      )
    );
$$;

comment on function public.teacher_can_access_class(uuid) is
  'True when caller teaches the class, or (grade-only) the class is in an assigned grade.';

create or replace function public.teacher_is_assigned_to_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.teacher_can_access_class (p_class_id);
$$;

comment on function public.teacher_is_assigned_to_class(uuid) is
  'True when the caller may access the class via class_teachers or grade-only scope.';

create or replace function public.teacher_can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.class_teachers ct
      join public.student_enrollments se on se.class_id = ct.class_id
      where ct.teacher_profile_id = auth.uid()
        and se.status = 'active'
        and se.student_id = p_student_id
    )
    or (
      not public.teacher_has_explicit_class_assignments ()
      and exists (
        select 1
        from public.student_enrollments se
        join public.classes c on c.id = se.class_id
        join public.staff_grade_levels sgl
          on sgl.grade_level_id = c.grade_level_id
         and sgl.profile_id = auth.uid()
        where se.student_id = p_student_id
          and se.status = 'active'
      )
    );
$$;

comment on function public.teacher_can_access_student(uuid) is
  'True when caller teaches an active class containing the student, or grade-only scope includes them.';

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
    and se.status = 'active'
  union
  select distinct se.student_id
  from public.student_enrollments se
  join public.classes c on c.id = se.class_id
  join public.staff_grade_levels sgl
    on sgl.grade_level_id = c.grade_level_id
   and sgl.profile_id = auth.uid()
  where se.status = 'active'
    and not public.teacher_has_explicit_class_assignments ();
$$;

comment on function public.teacher_assigned_student_ids() is
  'Students visible to the caller via class_teachers or grade-only staff_grade_levels scope.';

revoke all on function public.teacher_has_explicit_class_assignments() from public;
revoke all on function public.teacher_can_access_class(uuid) from public;
grant execute on function public.teacher_has_explicit_class_assignments() to authenticated, service_role;
grant execute on function public.teacher_can_access_class(uuid) to authenticated, service_role;
grant execute on function public.teacher_is_assigned_to_class(uuid) to authenticated, service_role;
grant execute on function public.teacher_can_access_student(uuid) to authenticated, service_role;
grant execute on function public.teacher_assigned_student_ids() to authenticated, service_role;

-- Teachers only see classes in their assigned class/grade scope; leadership/registrar unchanged.
drop policy if exists "classes_select_authenticated" on public.classes;
drop policy if exists "classes_select_policy" on public.classes;
create policy "classes_select_policy"
  on public.classes for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_can_access_class (id)
    )
  );
