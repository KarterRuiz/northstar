-- Class archive (is_active) enforcement and safe-delete guardrails.
-- Column public.classes.is_active already exists (foundation schema).

-- Teachers may only use roster workflows for active classes.
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
    join public.classes c on c.id = ct.class_id
    where ct.teacher_profile_id = auth.uid()
      and ct.class_id = p_class_id
      and c.is_active = true
  );
$$;

comment on function public.teacher_is_assigned_to_class(uuid) is
  'True when the caller is assigned to an active class (class_teachers + classes.is_active).';

-- Empty/test classes only: no enrollments and no academic artifacts for enrolled students.
create or replace function public.class_is_deletable(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
      select 1
      from public.student_enrollments e
      where e.class_id = p_class_id
    )
    and not exists (
      select 1
      from public.student_enrollments e
      join public.classes c on c.id = e.class_id
      join public.transition_notes tn
        on tn.student_id = e.student_id
        and tn.school_year_id is not distinct from c.school_year_id
      where e.class_id = p_class_id
    )
    and not exists (
      select 1
      from public.student_enrollments e
      join public.report_card_files rcf on rcf.student_id = e.student_id
      where e.class_id = p_class_id
    );
$$;

comment on function public.class_is_deletable(uuid) is
  'True when the class has no enrollments and no transition notes or report cards tied to its students.';

revoke all on function public.class_is_deletable(uuid) from public;
grant execute on function public.class_is_deletable(uuid) to authenticated, service_role;

-- Block hard delete at the database when academic records exist (defense in depth).
create or replace function public.enforce_class_deletable_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.class_is_deletable(old.id) then
    raise exception 'CLASS_HAS_ACADEMIC_RECORDS'
      using hint = 'Archive the class instead of deleting it.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_classes_deletable_before_delete on public.classes;
create trigger trg_classes_deletable_before_delete
  before delete on public.classes
  for each row execute function public.enforce_class_deletable_before_delete();
