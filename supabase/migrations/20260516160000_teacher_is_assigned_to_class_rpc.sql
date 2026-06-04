-- Idempotent repair: ensure teacher_is_assigned_to_class exists when
-- 20260516140000_teacher_roster_management.sql was not fully applied.

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
