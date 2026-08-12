-- -----------------------------------------------------------------------------
-- Leadership Follow-Up workbench (administrator-created reminders).
-- Derived operational signals are computed in the app and are NOT stored here.
--
-- REQUIRED: Apply this migration in Supabase (SQL editor or `supabase db push`)
-- before using /dashboard/[role]/follow-up or profile "Add Follow-Up" actions.
-- -----------------------------------------------------------------------------

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  note text,
  category text not null
    constraint follow_ups_category_check
      check (category in ('students', 'staff', 'families', 'records', 'classes')),
  status text not null default 'open'
    constraint follow_ups_status_check
      check (status in ('open', 'waiting', 'completed')),
  due_on date,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  completed_by_profile_id uuid references public.profiles (id) on delete set null,
  student_id uuid references public.students (id) on delete set null,
  staff_member_id uuid references public.staff_members (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  parent_request_id uuid references public.parent_record_requests (id) on delete set null,
  transition_note_id uuid references public.transition_notes (id) on delete set null,
  source_type text not null default 'manual',
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint follow_ups_title_not_blank check (char_length(trim(title)) > 0),
  constraint follow_ups_completed_consistency check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

comment on table public.follow_ups is
  'Administrator-created leadership reminders. Automated exceptions stay derived in the app.';

comment on column public.follow_ups.category is
  'students | staff | families | records | classes';

comment on column public.follow_ups.status is
  'open | waiting | completed';

comment on column public.follow_ups.source_type is
  'manual for created rows. Derived signals are not persisted.';

create index if not exists follow_ups_status_due_on_idx
  on public.follow_ups (status, due_on);

create index if not exists follow_ups_created_by_idx
  on public.follow_ups (created_by_profile_id);

create index if not exists follow_ups_student_id_idx
  on public.follow_ups (student_id)
  where student_id is not null;

create index if not exists follow_ups_staff_member_id_idx
  on public.follow_ups (staff_member_id)
  where staff_member_id is not null;

create index if not exists follow_ups_class_id_idx
  on public.follow_ups (class_id)
  where class_id is not null;

create index if not exists follow_ups_parent_request_id_idx
  on public.follow_ups (parent_request_id)
  where parent_request_id is not null;

create index if not exists follow_ups_completed_at_idx
  on public.follow_ups (completed_at desc)
  where completed_at is not null;

drop trigger if exists set_updated_at on public.follow_ups;
create trigger set_updated_at
  before update on public.follow_ups
  for each row execute function public.set_updated_at();

alter table public.follow_ups enable row level security;

-- Leadership only. Teachers and registrars cannot read staff-facing notes.
drop policy if exists "follow_ups_select_leadership" on public.follow_ups;
create policy "follow_ups_select_leadership"
  on public.follow_ups for select to authenticated
  using (public.is_school_leadership ());

drop policy if exists "follow_ups_insert_leadership" on public.follow_ups;
create policy "follow_ups_insert_leadership"
  on public.follow_ups for insert to authenticated
  with check (
    public.is_school_leadership ()
    and created_by_profile_id = auth.uid ()
  );

drop policy if exists "follow_ups_update_leadership" on public.follow_ups;
create policy "follow_ups_update_leadership"
  on public.follow_ups for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "follow_ups_delete_leadership" on public.follow_ups;
create policy "follow_ups_delete_leadership"
  on public.follow_ups for delete to authenticated
  using (public.is_school_leadership ());

grant select, insert, update, delete on public.follow_ups to authenticated, service_role;
grant all on public.follow_ups to postgres;
