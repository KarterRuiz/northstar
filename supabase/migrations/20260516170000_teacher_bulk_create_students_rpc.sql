-- Teacher roster: class-scoped student create + enroll via SECURITY DEFINER RPCs.
-- Product rule: teachers only create students for classes they are assigned to teach.

create or replace function public.teacher_create_student_for_class(
  p_class_id uuid,
  p_first_name text,
  p_last_name text,
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

  if v_first = '' or v_last = '' then
    raise exception 'First name and last name are required';
  end if;

  if char_length(v_first) > 120 or char_length(v_last) > 120 then
    raise exception 'Name must be at most 120 characters';
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

  insert into public.students (first_name, last_name, preferred_name)
  values (v_first, v_last, v_pref)
  returning id into v_student_id;

  insert into public.student_enrollments (student_id, class_id, school_year_id, status)
  values (v_student_id, p_class_id, v_school_year_id, 'active');

  return v_student_id;
end;
$$;

comment on function public.teacher_create_student_for_class(uuid, text, text, text) is
  'Creates a student and active enrollment in p_class_id when caller is a teacher assigned to that class.';

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

    begin
      insert into public.students (first_name, last_name)
      values (v_first, v_last)
      returning id into v_student_id;

      insert into public.student_enrollments (student_id, class_id, school_year_id, status)
      values (v_student_id, p_class_id, v_school_year_id, 'active');

      v_created_ids := array_append(v_created_ids, v_student_id);
    exception
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
  'Bulk-creates students and active enrollments for p_class_id. Input: [{line, first_name, last_name}, ...].';

revoke all on function public.teacher_create_student_for_class(uuid, text, text, text) from public;
grant execute on function public.teacher_create_student_for_class(uuid, text, text, text)
  to authenticated, service_role;

revoke all on function public.teacher_bulk_create_students_for_class(uuid, jsonb) from public;
grant execute on function public.teacher_bulk_create_students_for_class(uuid, jsonb)
  to authenticated, service_role;

-- Teachers must use RPCs for roster creates (not unrestricted INSERT on students).
drop policy if exists "students_insert_teacher" on public.students;
