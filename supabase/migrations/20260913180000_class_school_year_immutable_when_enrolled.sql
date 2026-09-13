-- School-year integrity: do not rewrite classes.school_year_id after enrollments exist.
-- Enrollment ↔ class year match is already enforced on student_enrollments
-- (trg_student_enrollments_class_year). Changing the class year underneath
-- existing enrollments would leave enrollment.school_year_id stale.
--
-- Live check (2026-09-13): 0 enrollment/class year mismatches; safe to add.
-- Deploy AFTER app guard that returns CLASS_SCHOOL_YEAR_LOCKED_MESSAGE
-- (updateClassDetailsAction). Compatible with empty and enrolled classes.
-- Do NOT apply blindly if a deliberate class-year remapping is in progress.

create or replace function public.enforce_class_school_year_immutable_when_enrolled()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.school_year_id is distinct from old.school_year_id then
    if exists (
      select 1
      from public.student_enrollments e
      where e.class_id = old.id
      limit 1
    ) then
      raise exception
        'classes.school_year_id cannot change after enrollments exist for this class'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.enforce_class_school_year_immutable_when_enrolled() is
  'School-year integrity: block rewriting class year once any enrollment history exists.';

drop trigger if exists trg_classes_school_year_immutable_when_enrolled on public.classes;
create trigger trg_classes_school_year_immutable_when_enrolled
  before update of school_year_id on public.classes
  for each row
  execute function public.enforce_class_school_year_immutable_when_enrolled();

revoke all on function public.enforce_class_school_year_immutable_when_enrolled() from public;
grant execute on function public.enforce_class_school_year_immutable_when_enrolled() to authenticated, service_role;
