-- Mandatory Student Number foundation (Phase A).
-- Identity contract:
--   students.id              = Northstar Record ID (internal UUID)
--   students.external_id     = school Student Number (portable; required for NEW students)
--   student_enrollments.roster_number = class-scoped roster order only
--
-- Live-safe: does NOT add NOT NULL on external_id (legacy nulls remain until cleanup).
-- Uniqueness already enforced by students_external_id_unique (NULLs allowed multiple times).

comment on column public.students.id is
  'Northstar Record ID — internal permanent UUID. Not the school Student Number.';

comment on column public.students.external_id is
  'School Student Number — human/school-facing, unique school-wide, portable. Nullable only for legacy rows; required on all new creates. Distinct from student_enrollments.roster_number.';

-- Reject whitespace-only Student Numbers while still allowing NULL for legacy.
alter table public.students
  drop constraint if exists students_external_id_not_blank;

alter table public.students
  add constraint students_external_id_not_blank
  check (external_id is null or length(btrim(external_id)) > 0);

-- Teacher single create: require Student Number.
drop function if exists public.teacher_create_student_for_class(uuid, text, text, text);

create or replace function public.teacher_create_student_for_class(
  p_class_id uuid,
  p_first_name text,
  p_last_name text,
  p_external_id text,
  p_preferred_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_year_id uuid;
  v_student_id uuid;
  v_first text;
  v_last text;
  v_pref text;
  v_external text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_role('teacher') then
    raise exception 'Only teachers can add students to a class roster';
  end if;

  if not public.teacher_is_assigned_to_class(p_class_id) then
    raise exception 'You are not assigned to this class';
  end if;

  v_first := btrim(p_first_name);
  v_last := btrim(p_last_name);
  v_pref := nullif(btrim(coalesce(p_preferred_name, '')), '');
  v_external := nullif(btrim(coalesce(p_external_id, '')), '');

  if v_first = '' or v_last = '' then
    raise exception 'First name and last name are required';
  end if;

  if v_external is null then
    raise exception 'Student Number is required.';
  end if;

  if char_length(v_first) > 120 or char_length(v_last) > 120 then
    raise exception 'Name must be at most 120 characters';
  end if;

  if char_length(v_external) > 64 then
    raise exception 'Student Number must be at most 64 characters.';
  end if;

  if v_pref is not null and char_length(v_pref) > 120 then
    v_pref := left(v_pref, 120);
  end if;

  select c.school_year_id
  into v_school_year_id
  from public.classes c
  where c.id = p_class_id
    and c.is_active = true;

  if v_school_year_id is null then
    raise exception 'Selected class was not found or is inactive';
  end if;

  begin
    insert into public.students (first_name, last_name, preferred_name, external_id)
    values (v_first, v_last, v_pref, v_external)
    returning id into v_student_id;
  exception
    when unique_violation then
      raise exception 'A student with this Student Number already exists.';
  end;

  insert into public.student_enrollments (student_id, class_id, school_year_id, status)
  values (v_student_id, p_class_id, v_school_year_id, 'active');

  return v_student_id;
end;
$$;

comment on function public.teacher_create_student_for_class(uuid, text, text, text, text) is
  'Creates a student with required Student Number and active enrollment in p_class_id when caller is a teacher assigned to that class.';

revoke all on function public.teacher_create_student_for_class(uuid, text, text, text, text) from public;
grant execute on function public.teacher_create_student_for_class(uuid, text, text, text, text)
  to authenticated, service_role;

-- Teacher bulk create: require Student Number per row.
create or replace function public.teacher_bulk_create_students_for_class(
  p_class_id uuid,
  p_students jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_year_id uuid;
  v_row jsonb;
  v_line int;
  v_first text;
  v_last text;
  v_external text;
  v_student_id uuid;
  v_created_ids uuid[] := '{}';
  v_failed jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_role('teacher') then
    raise exception 'Only teachers can add students to a class roster';
  end if;

  if not public.teacher_is_assigned_to_class(p_class_id) then
    raise exception 'You are not assigned to this class';
  end if;

  if p_students is null or jsonb_typeof(p_students) <> 'array' then
    raise exception 'p_students must be a JSON array';
  end if;

  select c.school_year_id
  into v_school_year_id
  from public.classes c
  where c.id = p_class_id
    and c.is_active = true;

  if v_school_year_id is null then
    raise exception 'Selected class was not found or is inactive';
  end if;

  for v_row in select value from jsonb_array_elements(p_students) as t(value)
  loop
    v_line := coalesce((v_row ->> 'line')::int, 0);
    v_first := btrim(coalesce(v_row ->> 'first_name', ''));
    v_last := btrim(coalesce(v_row ->> 'last_name', ''));
    v_external := nullif(btrim(coalesce(v_row ->> 'external_id', '')), '');

    if v_first = '' then
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('line', v_line, 'message', 'First name is required.')
      );
      continue;
    end if;

    if v_last = '' then
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('line', v_line, 'message', 'Last name is required.')
      );
      continue;
    end if;

    if v_external is null then
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('line', v_line, 'message', 'Student Number is required.')
      );
      continue;
    end if;

    if char_length(v_first) > 120 then
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('line', v_line, 'message', 'First name must be at most 120 characters.')
      );
      continue;
    end if;

    if char_length(v_last) > 120 then
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('line', v_line, 'message', 'Last name must be at most 120 characters.')
      );
      continue;
    end if;

    if char_length(v_external) > 64 then
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('line', v_line, 'message', 'Student Number must be at most 64 characters.')
      );
      continue;
    end if;

    begin
      insert into public.students (first_name, last_name, external_id)
      values (v_first, v_last, v_external)
      returning id into v_student_id;

      insert into public.student_enrollments (student_id, class_id, school_year_id, status)
      values (v_student_id, p_class_id, v_school_year_id, 'active');

      v_created_ids := array_append(v_created_ids, v_student_id);
    exception
      when unique_violation then
        v_failed := v_failed || jsonb_build_array(
          jsonb_build_object(
            'line', v_line,
            'message', 'A student with this Student Number already exists.'
          )
        );
      when others then
        v_failed := v_failed || jsonb_build_array(
          jsonb_build_object('line', v_line, 'message', sqlerrm)
        );
    end;
  end loop;

  return jsonb_build_object(
    'created_count', coalesce(array_length(v_created_ids, 1), 0),
    'created_ids', to_jsonb(v_created_ids),
    'failed', v_failed
  );
end;
$$;

comment on function public.teacher_bulk_create_students_for_class(uuid, jsonb) is
  'Bulk-creates students with required Student Number and active enrollments for p_class_id. Input: [{line, first_name, last_name, external_id}, ...].';
