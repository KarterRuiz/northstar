-- -----------------------------------------------------------------------------
-- Year-End Phase 1: draft plans, class maps, and student disposition items.
-- Preview / planning only — no commit RPC, no enrollment mutations.
--
-- APPLY before using /dashboard/[role]/year-end (SQL editor or `supabase db push`).
-- Additive only: does not alter existing student/enrollment/class rows.
-- -----------------------------------------------------------------------------

-- Plans -------------------------------------------------------------------
create table if not exists public.year_end_plans (
  id uuid primary key default gen_random_uuid(),
  from_school_year_id uuid not null references public.school_years (id) on delete restrict,
  to_school_year_id uuid not null references public.school_years (id) on delete restrict,
  status text not null default 'draft'
    constraint year_end_plans_status_check
      check (status in ('draft', 'ready', 'finalized')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  preview_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint year_end_plans_distinct_years_chk
    check (from_school_year_id <> to_school_year_id)
);

comment on table public.year_end_plans is
  'Year-end planning draft. Phase 1: preview only — status finalized is reserved for a later phase.';

comment on column public.year_end_plans.status is
  'draft | ready | finalized. UI must not expose finalize/commit in Phase 1.';

comment on column public.year_end_plans.preview_snapshot is
  'Optional frozen counts / blockers from last readiness check.';

create unique index if not exists year_end_plans_active_pair_uidx
  on public.year_end_plans (from_school_year_id, to_school_year_id)
  where status in ('draft', 'ready');

create index if not exists year_end_plans_from_year_idx
  on public.year_end_plans (from_school_year_id);

create index if not exists year_end_plans_to_year_idx
  on public.year_end_plans (to_school_year_id);

create index if not exists year_end_plans_status_idx
  on public.year_end_plans (status);

drop trigger if exists set_updated_at on public.year_end_plans;
create trigger set_updated_at
  before update on public.year_end_plans
  for each row execute function public.set_updated_at();

-- Class maps (FROM year class → TO year class) ----------------------------
-- Separate from plan items so admins edit structure mapping without
-- touching per-student disposition rows.
create table if not exists public.year_end_class_maps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.year_end_plans (id) on delete cascade,
  from_class_id uuid not null references public.classes (id) on delete restrict,
  to_class_id uuid references public.classes (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint year_end_class_maps_distinct_classes_chk
    check (to_class_id is null or from_class_id <> to_class_id)
);

comment on table public.year_end_class_maps is
  'Suggested FROM→TO class mapping for a year-end plan. Unmapped (null to_class_id) is allowed.';

create unique index if not exists year_end_class_maps_plan_from_uidx
  on public.year_end_class_maps (plan_id, from_class_id);

create index if not exists year_end_class_maps_plan_idx
  on public.year_end_class_maps (plan_id);

create index if not exists year_end_class_maps_to_class_idx
  on public.year_end_class_maps (to_class_id)
  where to_class_id is not null;

drop trigger if exists set_updated_at on public.year_end_class_maps;
create trigger set_updated_at
  before update on public.year_end_class_maps
  for each row execute function public.set_updated_at();

-- Student plan items ------------------------------------------------------
create table if not exists public.year_end_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.year_end_plans (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  source_enrollment_id uuid not null references public.student_enrollments (id) on delete restrict,
  disposition text not null
    constraint year_end_plan_items_disposition_check
      check (
        disposition in (
          'promote',
          'retain',
          'remap',
          'graduate_primary',
          'leave_school',
          'custom'
        )
      ),
  destination_class_id uuid references public.classes (id) on delete restrict,
  destination_grade_level_id uuid references public.grade_levels (id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.year_end_plan_items is
  'Per-student year-end disposition draft. Does not mutate enrollments.';

comment on column public.year_end_plan_items.disposition is
  'promote | retain | remap | graduate_primary | leave_school | custom';

comment on column public.year_end_plan_items.reason is
  'Required for custom; optional notes for other dispositions.';

create unique index if not exists year_end_plan_items_plan_student_uidx
  on public.year_end_plan_items (plan_id, student_id);

create unique index if not exists year_end_plan_items_plan_source_uidx
  on public.year_end_plan_items (plan_id, source_enrollment_id);

create index if not exists year_end_plan_items_plan_idx
  on public.year_end_plan_items (plan_id);

create index if not exists year_end_plan_items_disposition_idx
  on public.year_end_plan_items (plan_id, disposition);

drop trigger if exists set_updated_at on public.year_end_plan_items;
create trigger set_updated_at
  before update on public.year_end_plan_items
  for each row execute function public.set_updated_at();

-- RLS (leadership only — matches canManageSchoolStructure / is_school_leadership)
alter table public.year_end_plans enable row level security;
alter table public.year_end_class_maps enable row level security;
alter table public.year_end_plan_items enable row level security;

drop policy if exists "year_end_plans_select_leadership" on public.year_end_plans;
create policy "year_end_plans_select_leadership"
  on public.year_end_plans for select to authenticated
  using (public.is_school_leadership ());

drop policy if exists "year_end_plans_insert_leadership" on public.year_end_plans;
create policy "year_end_plans_insert_leadership"
  on public.year_end_plans for insert to authenticated
  with check (
    public.is_school_leadership ()
    and created_by = auth.uid ()
  );

drop policy if exists "year_end_plans_update_leadership" on public.year_end_plans;
create policy "year_end_plans_update_leadership"
  on public.year_end_plans for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "year_end_plans_delete_leadership" on public.year_end_plans;
create policy "year_end_plans_delete_leadership"
  on public.year_end_plans for delete to authenticated
  using (public.is_school_leadership ());

drop policy if exists "year_end_class_maps_select_leadership" on public.year_end_class_maps;
create policy "year_end_class_maps_select_leadership"
  on public.year_end_class_maps for select to authenticated
  using (public.is_school_leadership ());

drop policy if exists "year_end_class_maps_insert_leadership" on public.year_end_class_maps;
create policy "year_end_class_maps_insert_leadership"
  on public.year_end_class_maps for insert to authenticated
  with check (public.is_school_leadership ());

drop policy if exists "year_end_class_maps_update_leadership" on public.year_end_class_maps;
create policy "year_end_class_maps_update_leadership"
  on public.year_end_class_maps for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "year_end_class_maps_delete_leadership" on public.year_end_class_maps;
create policy "year_end_class_maps_delete_leadership"
  on public.year_end_class_maps for delete to authenticated
  using (public.is_school_leadership ());

drop policy if exists "year_end_plan_items_select_leadership" on public.year_end_plan_items;
create policy "year_end_plan_items_select_leadership"
  on public.year_end_plan_items for select to authenticated
  using (public.is_school_leadership ());

drop policy if exists "year_end_plan_items_insert_leadership" on public.year_end_plan_items;
create policy "year_end_plan_items_insert_leadership"
  on public.year_end_plan_items for insert to authenticated
  with check (public.is_school_leadership ());

drop policy if exists "year_end_plan_items_update_leadership" on public.year_end_plan_items;
create policy "year_end_plan_items_update_leadership"
  on public.year_end_plan_items for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "year_end_plan_items_delete_leadership" on public.year_end_plan_items;
create policy "year_end_plan_items_delete_leadership"
  on public.year_end_plan_items for delete to authenticated
  using (public.is_school_leadership ());

grant select, insert, update, delete on public.year_end_plans to authenticated, service_role;
grant select, insert, update, delete on public.year_end_class_maps to authenticated, service_role;
grant select, insert, update, delete on public.year_end_plan_items to authenticated, service_role;
grant all on public.year_end_plans to postgres;
grant all on public.year_end_class_maps to postgres;
grant all on public.year_end_plan_items to postgres;
