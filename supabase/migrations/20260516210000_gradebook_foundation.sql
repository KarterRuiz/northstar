-- Class gradebook foundation (categories, assignments, scores).
-- Parallel to academic_records; not report-card PDF generation.

create or replace function public.student_is_active_in_class(
  p_student_id uuid,
  p_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_enrollments se
    where se.student_id = p_student_id
      and se.class_id = p_class_id
      and se.status = 'active'
  );
$$;

comment on function public.student_is_active_in_class(uuid, uuid) is
  'True when the student has an active enrollment in the given class.';

revoke all on function public.student_is_active_in_class(uuid, uuid) from public;
grant execute on function public.student_is_active_in_class(uuid, uuid) to authenticated, service_role;

-- ---------------- gradebook_categories ----------------
create table if not exists public.gradebook_categories (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  teacher_profile_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  weight_percent numeric not null
    constraint gradebook_categories_weight_percent_check
      check (weight_percent >= 0 and weight_percent <= 100),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gradebook_categories is
  'Weighted grading categories for a class gradebook (e.g. Tests, Homework).';

create index if not exists gradebook_categories_class_id_idx
  on public.gradebook_categories (class_id);

create index if not exists gradebook_categories_teacher_profile_id_idx
  on public.gradebook_categories (teacher_profile_id);

drop trigger if exists set_updated_at on public.gradebook_categories;
create trigger set_updated_at
  before update on public.gradebook_categories
  for each row execute function public.set_updated_at();

-- ---------------- gradebook_assignments ----------------
create table if not exists public.gradebook_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  category_id uuid not null references public.gradebook_categories (id) on delete restrict,
  teacher_profile_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  description text,
  points_possible numeric not null
    constraint gradebook_assignments_points_possible_check
      check (points_possible > 0),
  due_date date,
  term text
    constraint gradebook_assignments_term_check
      check (term is null or term in ('T1', 'T2', 'T3', 'T4')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gradebook_assignments is
  'Graded items within a category; term aligns with report card terms (T1–T4).';

create index if not exists gradebook_assignments_class_id_idx
  on public.gradebook_assignments (class_id);

create index if not exists gradebook_assignments_category_id_idx
  on public.gradebook_assignments (category_id);

create index if not exists gradebook_assignments_teacher_profile_id_idx
  on public.gradebook_assignments (teacher_profile_id);

drop trigger if exists set_updated_at on public.gradebook_assignments;
create trigger set_updated_at
  before update on public.gradebook_assignments
  for each row execute function public.set_updated_at();

create or replace function public.gradebook_assignment_category_matches_class()
returns trigger
language plpgsql
as $$
declare
  v_category_class_id uuid;
begin
  select gc.class_id into v_category_class_id
  from public.gradebook_categories gc
  where gc.id = new.category_id;

  if v_category_class_id is null then
    raise exception 'gradebook category not found';
  end if;

  if v_category_class_id <> new.class_id then
    raise exception 'gradebook_assignments.class_id must match gradebook_categories.class_id';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gradebook_assignments_category_class on public.gradebook_assignments;
create trigger trg_gradebook_assignments_category_class
  before insert or update of class_id, category_id on public.gradebook_assignments
  for each row execute function public.gradebook_assignment_category_matches_class();

-- ---------------- gradebook_scores ----------------
create table if not exists public.gradebook_scores (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.gradebook_assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  points_earned numeric,
  status text not null default 'scored'
    constraint gradebook_scores_status_check
      check (status in ('scored', 'missing', 'exempt', 'absent')),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gradebook_scores_assignment_student_uidx unique (assignment_id, student_id)
);

comment on table public.gradebook_scores is
  'Per-student score or status for a gradebook assignment.';

create index if not exists gradebook_scores_assignment_id_idx
  on public.gradebook_scores (assignment_id);

create index if not exists gradebook_scores_student_id_idx
  on public.gradebook_scores (student_id);

drop trigger if exists set_updated_at on public.gradebook_scores;
create trigger set_updated_at
  before update on public.gradebook_scores
  for each row execute function public.set_updated_at();

-- ---------------- RLS ----------------
alter table public.gradebook_categories enable row level security;
alter table public.gradebook_assignments enable row level security;
alter table public.gradebook_scores enable row level security;

-- gradebook_categories SELECT
drop policy if exists "gradebook_categories_select" on public.gradebook_categories;
create policy "gradebook_categories_select"
  on public.gradebook_categories for select to authenticated
  using (
    public.is_school_leadership ()
    or (
      public.is_role ('teacher')
      and teacher_profile_id = auth.uid ()
      and public.teacher_is_assigned_to_class (class_id)
    )
  );

-- gradebook_categories INSERT/UPDATE/DELETE (teachers)
drop policy if exists "gradebook_categories_teacher_insert" on public.gradebook_categories;
create policy "gradebook_categories_teacher_insert"
  on public.gradebook_categories for insert to authenticated
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  );

drop policy if exists "gradebook_categories_teacher_update" on public.gradebook_categories;
create policy "gradebook_categories_teacher_update"
  on public.gradebook_categories for update to authenticated
  using (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  )
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  );

drop policy if exists "gradebook_categories_teacher_delete" on public.gradebook_categories;
create policy "gradebook_categories_teacher_delete"
  on public.gradebook_categories for delete to authenticated
  using (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  );

-- gradebook_assignments SELECT
drop policy if exists "gradebook_assignments_select" on public.gradebook_assignments;
create policy "gradebook_assignments_select"
  on public.gradebook_assignments for select to authenticated
  using (
    public.is_school_leadership ()
    or (
      public.is_role ('teacher')
      and teacher_profile_id = auth.uid ()
      and public.teacher_is_assigned_to_class (class_id)
    )
  );

drop policy if exists "gradebook_assignments_teacher_insert" on public.gradebook_assignments;
create policy "gradebook_assignments_teacher_insert"
  on public.gradebook_assignments for insert to authenticated
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  );

drop policy if exists "gradebook_assignments_teacher_update" on public.gradebook_assignments;
create policy "gradebook_assignments_teacher_update"
  on public.gradebook_assignments for update to authenticated
  using (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  )
  with check (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  );

drop policy if exists "gradebook_assignments_teacher_delete" on public.gradebook_assignments;
create policy "gradebook_assignments_teacher_delete"
  on public.gradebook_assignments for delete to authenticated
  using (
    public.is_role ('teacher')
    and teacher_profile_id = auth.uid ()
    and public.teacher_is_assigned_to_class (class_id)
  );

-- gradebook_scores SELECT
drop policy if exists "gradebook_scores_select" on public.gradebook_scores;
create policy "gradebook_scores_select"
  on public.gradebook_scores for select to authenticated
  using (
    public.is_school_leadership ()
    or (
      public.is_role ('teacher')
      and exists (
        select 1
        from public.gradebook_assignments ga
        where ga.id = gradebook_scores.assignment_id
          and ga.teacher_profile_id = auth.uid ()
          and public.teacher_is_assigned_to_class (ga.class_id)
      )
      and public.teacher_can_access_student (student_id)
    )
  );

drop policy if exists "gradebook_scores_teacher_insert" on public.gradebook_scores;
create policy "gradebook_scores_teacher_insert"
  on public.gradebook_scores for insert to authenticated
  with check (
    public.is_role ('teacher')
    and exists (
      select 1
      from public.gradebook_assignments ga
      where ga.id = gradebook_scores.assignment_id
        and ga.teacher_profile_id = auth.uid ()
        and public.teacher_is_assigned_to_class (ga.class_id)
        and public.student_is_active_in_class (gradebook_scores.student_id, ga.class_id)
    )
    and public.teacher_can_access_student (student_id)
  );

drop policy if exists "gradebook_scores_teacher_update" on public.gradebook_scores;
create policy "gradebook_scores_teacher_update"
  on public.gradebook_scores for update to authenticated
  using (
    public.is_role ('teacher')
    and exists (
      select 1
      from public.gradebook_assignments ga
      where ga.id = gradebook_scores.assignment_id
        and ga.teacher_profile_id = auth.uid ()
        and public.teacher_is_assigned_to_class (ga.class_id)
    )
    and public.teacher_can_access_student (student_id)
  )
  with check (
    public.is_role ('teacher')
    and exists (
      select 1
      from public.gradebook_assignments ga
      where ga.id = gradebook_scores.assignment_id
        and ga.teacher_profile_id = auth.uid ()
        and public.teacher_is_assigned_to_class (ga.class_id)
        and public.student_is_active_in_class (gradebook_scores.student_id, ga.class_id)
    )
    and public.teacher_can_access_student (student_id)
  );

drop policy if exists "gradebook_scores_teacher_delete" on public.gradebook_scores;
create policy "gradebook_scores_teacher_delete"
  on public.gradebook_scores for delete to authenticated
  using (
    public.is_role ('teacher')
    and exists (
      select 1
      from public.gradebook_assignments ga
      where ga.id = gradebook_scores.assignment_id
        and ga.teacher_profile_id = auth.uid ()
        and public.teacher_is_assigned_to_class (ga.class_id)
    )
    and public.teacher_can_access_student (student_id)
  );

grant select, insert, update, delete on public.gradebook_categories to authenticated, service_role;
grant select, insert, update, delete on public.gradebook_assignments to authenticated, service_role;
grant select, insert, update, delete on public.gradebook_scores to authenticated, service_role;
grant all on public.gradebook_categories to postgres;
grant all on public.gradebook_assignments to postgres;
grant all on public.gradebook_scores to postgres;
