-- -----------------------------------------------------------------------------
-- School calendar: public events + private leadership date notes.
-- Events answer “what is happening, and when?”
-- Notes are leadership-only planning context and are NOT events.
-- Follow-ups are a separate workbench and are never created from this schema.
--
-- REQUIRED: Apply this migration in Supabase (SQL editor or `supabase db push`)
-- before using /dashboard/[role]/calendar or the Home Calendar card.
-- -----------------------------------------------------------------------------

create or replace function public.is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role (
    array['admin', 'principal', 'vice_principal', 'teacher', 'registrar']
  );
$$;

comment on function public.is_school_staff() is
  'Any authenticated school staff profile. Used for staff-visible calendar reads.';

revoke all on function public.is_school_staff() from public;
grant execute on function public.is_school_staff() to authenticated, service_role;

create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default true,
  category text not null default 'school'
    constraint school_events_category_check
      check (
        category in (
          'school',
          'meeting',
          'academic',
          'reporting',
          'pd',
          'event',
          'deadline'
        )
      ),
  audience text not null default 'all_staff'
    constraint school_events_audience_check
      check (audience in ('leadership', 'all_staff', 'whole_school')),
  location text,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint school_events_title_not_blank check (char_length(trim(title)) > 0),
  constraint school_events_range_ok check (ends_at >= starts_at)
);

comment on table public.school_events is
  'School calendar events. All-day rows use Asia/Shanghai midnight–end-of-day instants so the intended school date does not shift.';

comment on column public.school_events.category is
  'school | meeting | academic | reporting | pd | event | deadline';

comment on column public.school_events.audience is
  'leadership (leadership only) | all_staff | whole_school. Grade/program targeting is future work.';

comment on column public.school_events.starts_at is
  'Inclusive start. All-day: YYYY-MM-DDT00:00:00+08:00. Timed: school-local wall time as +08:00.';

comment on column public.school_events.ends_at is
  'Inclusive end. All-day: YYYY-MM-DDT23:59:59.999+08:00 of the last school date.';

create index if not exists school_events_range_idx
  on public.school_events (starts_at, ends_at)
  where archived_at is null;

create index if not exists school_events_audience_idx
  on public.school_events (audience)
  where archived_at is null;

create index if not exists school_events_created_by_idx
  on public.school_events (created_by_profile_id);

drop trigger if exists set_updated_at on public.school_events;
create trigger set_updated_at
  before update on public.school_events
  for each row execute function public.set_updated_at();

create table if not exists public.calendar_notes (
  id uuid primary key default gen_random_uuid(),
  note text not null,
  note_date date not null,
  created_by_profile_id uuid not null references public.profiles (id) on delete restrict,
  related_staff_member_id uuid references public.staff_members (id) on delete set null,
  related_student_id uuid references public.students (id) on delete set null,
  related_class_id uuid references public.classes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_notes_note_not_blank check (char_length(trim(note)) > 0)
);

comment on table public.calendar_notes is
  'Private leadership date notes. Not calendar events. Teachers, families, and students must never read these.';

create index if not exists calendar_notes_note_date_idx
  on public.calendar_notes (note_date);

create index if not exists calendar_notes_created_by_idx
  on public.calendar_notes (created_by_profile_id);

create index if not exists calendar_notes_staff_idx
  on public.calendar_notes (related_staff_member_id)
  where related_staff_member_id is not null;

create index if not exists calendar_notes_student_idx
  on public.calendar_notes (related_student_id)
  where related_student_id is not null;

create index if not exists calendar_notes_class_idx
  on public.calendar_notes (related_class_id)
  where related_class_id is not null;

drop trigger if exists set_updated_at on public.calendar_notes;
create trigger set_updated_at
  before update on public.calendar_notes
  for each row execute function public.set_updated_at();

alter table public.school_events enable row level security;
alter table public.calendar_notes enable row level security;

-- Leadership sees every active event, including leadership-only.
-- Other staff may later read All Staff / Whole School — never Leadership.
drop policy if exists "school_events_select_visible" on public.school_events;
create policy "school_events_select_visible"
  on public.school_events for select to authenticated
  using (
    archived_at is null
    and (
      public.is_school_leadership ()
      or (
        public.is_school_staff ()
        and audience in ('all_staff', 'whole_school')
      )
    )
  );

drop policy if exists "school_events_insert_leadership" on public.school_events;
create policy "school_events_insert_leadership"
  on public.school_events for insert to authenticated
  with check (
    public.is_school_leadership ()
    and created_by_profile_id = auth.uid ()
  );

drop policy if exists "school_events_update_leadership" on public.school_events;
create policy "school_events_update_leadership"
  on public.school_events for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "school_events_delete_leadership" on public.school_events;
create policy "school_events_delete_leadership"
  on public.school_events for delete to authenticated
  using (public.is_school_leadership ());

-- Notes are leadership-only. No staff-visible read path.
drop policy if exists "calendar_notes_select_leadership" on public.calendar_notes;
create policy "calendar_notes_select_leadership"
  on public.calendar_notes for select to authenticated
  using (public.is_school_leadership ());

drop policy if exists "calendar_notes_insert_leadership" on public.calendar_notes;
create policy "calendar_notes_insert_leadership"
  on public.calendar_notes for insert to authenticated
  with check (
    public.is_school_leadership ()
    and created_by_profile_id = auth.uid ()
  );

drop policy if exists "calendar_notes_update_leadership" on public.calendar_notes;
create policy "calendar_notes_update_leadership"
  on public.calendar_notes for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

drop policy if exists "calendar_notes_delete_leadership" on public.calendar_notes;
create policy "calendar_notes_delete_leadership"
  on public.calendar_notes for delete to authenticated
  using (public.is_school_leadership ());

grant select, insert, update, delete on public.school_events to authenticated, service_role;
grant all on public.school_events to postgres;

grant select, insert, update, delete on public.calendar_notes to authenticated, service_role;
grant all on public.calendar_notes to postgres;
