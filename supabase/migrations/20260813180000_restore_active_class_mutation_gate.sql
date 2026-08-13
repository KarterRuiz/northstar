-- -----------------------------------------------------------------------------
-- P0: Restore active-class requirement on teacher operational mutation gate.
--
-- Regression: 20260808210000_staff_grade_level_access.sql redefined
-- teacher_is_assigned_to_class as a thin alias of teacher_can_access_class,
-- dropping the classes.is_active = true check added in
-- 20260516180000_class_archive_safe_delete.sql.
--
-- Separation of concerns (intentional):
--   teacher_can_access_class  → read/SELECT (may include archived historical)
--   teacher_is_assigned_to_class → WRITE/mutation (active classes only)
--
-- Grade-level access still expands mutation rights to active classes in scope;
-- it must not unlock writes against archived classes.
-- Idempotent: CREATE OR REPLACE FUNCTION only; no data changes.
-- -----------------------------------------------------------------------------

create or replace function public.teacher_is_assigned_to_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.teacher_can_access_class (p_class_id)
    and exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.is_active = true
    );
$$;

comment on function public.teacher_is_assigned_to_class(uuid) is
  'True when the caller may access the class via class_teachers or grade-only scope AND the class is active (operational mutation gate for attendance, gradebook, roster writes).';

grant execute on function public.teacher_is_assigned_to_class(uuid) to authenticated, service_role;
