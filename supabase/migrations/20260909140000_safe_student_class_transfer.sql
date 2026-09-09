-- Safe same-year (or cross-class) student placement transfer:
-- withdraw source enrollment in place (class_id immutable) + insert new active enrollment.
-- Also block silent class_id rewrites at the database layer.

-- ---------------- immutability: class_id once set ----------------
create or replace function public.enforce_student_enrollment_class_id_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.class_id is distinct from old.class_id then
    raise exception
      'student_enrollments.class_id is immutable; withdraw the enrollment and create a new one to change class placement'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.enforce_student_enrollment_class_id_immutable() is
  'Prevents rewriting historical class placement on student_enrollments. Use transfer_student_class_placement instead.';

drop trigger if exists trg_student_enrollments_class_id_immutable on public.student_enrollments;
create trigger trg_student_enrollments_class_id_immutable
  before update of class_id on public.student_enrollments
  for each row
  execute function public.enforce_student_enrollment_class_id_immutable();

-- ---------------- atomic transfer RPC ----------------
create or replace function public.transfer_student_class_placement(
  p_enrollment_id uuid,
  p_destination_class_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.student_enrollments%rowtype;
  v_dest_year uuid;
  v_dest_active boolean;
  v_existing_dest_id uuid;
  v_new_enrollment_id uuid;
  v_created boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_school_leadership() or public.is_registrar()) then
    raise exception 'Only school leadership or registrar can transfer student class placement';
  end if;

  if p_enrollment_id is null or p_destination_class_id is null then
    raise exception 'Enrollment and destination class are required';
  end if;

  select *
  into v_source
  from public.student_enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment record was not found';
  end if;

  if v_source.status is distinct from 'active' then
    raise exception 'Only an active enrollment can be transferred';
  end if;

  if v_source.class_id = p_destination_class_id then
    raise exception 'Student is already enrolled in that class';
  end if;

  select c.school_year_id, c.is_active
  into v_dest_year, v_dest_active
  from public.classes c
  where c.id = p_destination_class_id;

  if v_dest_year is null then
    raise exception 'Destination class was not found';
  end if;

  if v_dest_active is not true then
    raise exception 'Destination class is inactive; pick an active class';
  end if;

  -- Prefer locking an existing destination enrollment before mutating source.
  select se.id
  into v_existing_dest_id
  from public.student_enrollments se
  where se.student_id = v_source.student_id
    and se.class_id = p_destination_class_id
    and se.status = 'active'
  limit 1
  for update;

  -- Withdraw source (class_id unchanged). Roster # stays on the historical row.
  update public.student_enrollments
  set status = 'withdrawn'
  where id = v_source.id;

  if v_existing_dest_id is not null then
    return jsonb_build_object(
      'ok', true,
      'sourceEnrollmentId', v_source.id,
      'destinationEnrollmentId', v_existing_dest_id,
      'createdDestination', false,
      'withdrawnSource', true,
      'sourceClassId', v_source.class_id,
      'destinationClassId', p_destination_class_id,
      'studentId', v_source.student_id
    );
  end if;

  -- Nested block: unique races roll back only the insert, not the withdraw.
  begin
    insert into public.student_enrollments (
      student_id,
      class_id,
      school_year_id,
      status,
      roster_number
    )
    values (
      v_source.student_id,
      p_destination_class_id,
      v_dest_year,
      'active',
      null
    )
    returning id into v_new_enrollment_id;

    v_created := true;
  exception
    when unique_violation then
      select se.id
      into v_existing_dest_id
      from public.student_enrollments se
      where se.student_id = v_source.student_id
        and se.class_id = p_destination_class_id
        and se.status = 'active'
      limit 1;

      if v_existing_dest_id is null then
        raise;
      end if;

      v_new_enrollment_id := v_existing_dest_id;
      v_created := false;
  end;

  return jsonb_build_object(
    'ok', true,
    'sourceEnrollmentId', v_source.id,
    'destinationEnrollmentId', v_new_enrollment_id,
    'createdDestination', v_created,
    'withdrawnSource', true,
    'sourceClassId', v_source.class_id,
    'destinationClassId', p_destination_class_id,
    'studentId', v_source.student_id
  );
end;
$$;

comment on function public.transfer_student_class_placement(uuid, uuid) is
  'Atomically withdraws an active enrollment (class_id unchanged) and ensures an active enrollment in the destination class. Does not rewrite historical class_id.';

revoke all on function public.transfer_student_class_placement(uuid, uuid) from public;
grant execute on function public.transfer_student_class_placement(uuid, uuid) to authenticated, service_role;
