-- Teacher roster management: scoped INSERT/UPDATE on students and INSERT on enrollments.

create or replace function public.teacher_is_assigned_to_class(p_class_id uuid)
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
      and ct.class_id = p_class_id
  );
$$;

comment on function public.teacher_is_assigned_to_class(uuid) is
  'True when the caller is assigned to teach the given class (class_teachers.teacher_profile_id = auth.uid()).';

revoke all on function public.teacher_is_assigned_to_class(uuid) from public;
grant execute on function public.teacher_is_assigned_to_class(uuid) to authenticated, service_role;

-- ---------------- students (teacher insert / update) ----------------
drop policy if exists "students_insert_teacher" on public.students;
create policy "students_insert_teacher"
  on public.students for insert to authenticated
  with check (public.is_role ('teacher'));

drop policy if exists "students_update_teacher" on public.students;
create policy "students_update_teacher"
  on public.students for update to authenticated
  using (
    public.is_role ('teacher')
    and public.teacher_can_access_student (id)
  )
  with check (
    public.is_role ('teacher')
    and public.teacher_can_access_student (id)
  );

-- ---------------- student_enrollments (teacher insert for assigned classes) ----------------
drop policy if exists "student_enrollments_insert_teacher" on public.student_enrollments;
create policy "student_enrollments_insert_teacher"
  on public.student_enrollments for insert to authenticated
  with check (
    public.is_role ('teacher')
    and public.teacher_is_assigned_to_class (class_id)
    and status = 'active'
  );
