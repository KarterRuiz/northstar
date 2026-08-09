-- -----------------------------------------------------------------------------
-- Staff members roster (Build the School → Invite the People)
-- profiles.id references auth.users, so draft/not-yet-invited staff cannot live
-- on profiles. staff_members is the master roster; invitations activate access.
-- -----------------------------------------------------------------------------

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  full_name text not null,
  email text not null,
  role text not null
    constraint staff_members_role_check
      check (role in ('admin', 'principal', 'vice_principal', 'registrar', 'teacher')),
  -- draft = incomplete; ready = complete, not yet invited; disabled/archived = off roster access
  status text not null default 'ready'
    constraint staff_members_status_check
      check (status in ('draft', 'ready', 'disabled', 'archived')),
  notes text,
  profile_id uuid unique references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_members is
  'School staffing roster independent of auth. Invitations activate accounts; profiles link after accept.';

comment on column public.staff_members.status is
  'Membership state: draft | ready | disabled | archived. Invitation lifecycle is on staff_invitations.';

comment on column public.staff_members.profile_id is
  'Set when the staff member accepts an invitation and a profiles/auth row exists.';

create index if not exists staff_members_email_idx
  on public.staff_members (lower(trim(email)));

create index if not exists staff_members_status_idx
  on public.staff_members (status);

create index if not exists staff_members_role_idx
  on public.staff_members (role);

create index if not exists staff_members_profile_id_idx
  on public.staff_members (profile_id)
  where profile_id is not null;

-- One non-archived roster row per normalized email.
create unique index if not exists staff_members_one_active_email_uidx
  on public.staff_members (lower(trim(email)))
  where archived_at is null;

create or replace function public.staff_members_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.full_name := trim(concat_ws(' ', new.first_name, new.last_name));
  if new.notes is not null then
    new.notes := trim(new.notes);
    if new.notes = '' then
      new.notes := null;
    end if;
  end if;
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;
  if new.status is distinct from 'archived' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_staff_members_normalize on public.staff_members;
create trigger trg_staff_members_normalize
  before insert or update of email, first_name, last_name, notes, status
  on public.staff_members
  for each row execute function public.staff_members_normalize();

drop trigger if exists set_updated_at on public.staff_members;
create trigger set_updated_at
  before update on public.staff_members
  for each row execute function public.set_updated_at();

revoke all on function public.staff_members_normalize() from public;
grant execute on function public.staff_members_normalize() to postgres, authenticated, service_role;

alter table public.staff_members enable row level security;

drop policy if exists "staff_members_select_managers" on public.staff_members;
create policy "staff_members_select_managers"
  on public.staff_members for select to authenticated
  using (
    public.is_staff_directory_manager ()
    or profile_id = auth.uid()
  );

drop policy if exists "staff_members_write_managers" on public.staff_members;
create policy "staff_members_write_managers"
  on public.staff_members for all to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

grant select, insert, update, delete on public.staff_members to authenticated, service_role;
grant all on public.staff_members to postgres;

-- Pre-activation grade access (copied to staff_grade_levels on accept).
create table if not exists public.staff_member_grade_levels (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  grade_level_id uuid not null references public.grade_levels (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint staff_member_grade_levels_unique unique (staff_member_id, grade_level_id)
);

create index if not exists staff_member_grade_levels_member_idx
  on public.staff_member_grade_levels (staff_member_id);

alter table public.staff_member_grade_levels enable row level security;

drop policy if exists "staff_member_grade_levels_select" on public.staff_member_grade_levels;
create policy "staff_member_grade_levels_select"
  on public.staff_member_grade_levels for select to authenticated
  using (public.is_staff_directory_manager ());

drop policy if exists "staff_member_grade_levels_write" on public.staff_member_grade_levels;
create policy "staff_member_grade_levels_write"
  on public.staff_member_grade_levels for all to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

grant select, insert, update, delete on public.staff_member_grade_levels to authenticated, service_role;
grant all on public.staff_member_grade_levels to postgres;

-- Pre-activation class access (copied to class_teachers on accept).
create table if not exists public.staff_member_classes (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint staff_member_classes_unique unique (staff_member_id, class_id)
);

create index if not exists staff_member_classes_member_idx
  on public.staff_member_classes (staff_member_id);

alter table public.staff_member_classes enable row level security;

drop policy if exists "staff_member_classes_select" on public.staff_member_classes;
create policy "staff_member_classes_select"
  on public.staff_member_classes for select to authenticated
  using (public.is_staff_directory_manager ());

drop policy if exists "staff_member_classes_write" on public.staff_member_classes;
create policy "staff_member_classes_write"
  on public.staff_member_classes for all to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

grant select, insert, update, delete on public.staff_member_classes to authenticated, service_role;
grant all on public.staff_member_classes to postgres;

-- Link invitations to roster + lifecycle timestamps.
alter table public.staff_invitations
  add column if not exists staff_member_id uuid references public.staff_members (id) on delete set null;

alter table public.staff_invitations
  add column if not exists sent_at timestamptz;

alter table public.staff_invitations
  add column if not exists opened_at timestamptz;

comment on column public.staff_invitations.staff_member_id is
  'Roster row this invitation activates. Null only for legacy invites pending backfill.';

comment on column public.staff_invitations.sent_at is
  'When the invitation email/link was issued (may equal created_at for legacy rows).';

comment on column public.staff_invitations.opened_at is
  'When the invitee first opened the invite link (login page with staff_invite token).';

create index if not exists staff_invitations_staff_member_id_idx
  on public.staff_invitations (staff_member_id)
  where staff_member_id is not null;

-- Backfill: every existing profile becomes a roster row (active staff).
insert into public.staff_members (
  first_name,
  last_name,
  full_name,
  email,
  role,
  status,
  profile_id,
  created_at,
  updated_at
)
select
  coalesce(
    nullif(trim(split_part(coalesce(p.full_name, ''), ' ', 1)), ''),
    'Staff'
  ) as first_name,
  coalesce(
    nullif(
      trim(
        case
          when position(' ' in trim(coalesce(p.full_name, ''))) > 0
            then substring(trim(p.full_name) from position(' ' in trim(p.full_name)) + 1)
          else ''
        end
      ),
      ''
    ),
    'Member'
  ) as last_name,
  coalesce(nullif(trim(p.full_name), ''), coalesce(nullif(trim(p.email), ''), 'Staff Member')) as full_name,
  coalesce(
    nullif(lower(trim(p.email)), ''),
    lower(trim(p.id::text)) || '@profile.local'
  ) as email,
  p.role,
  case when p.is_active then 'ready' else 'disabled' end,
  p.id,
  p.created_at,
  p.updated_at
from public.profiles p
where not exists (
  select 1 from public.staff_members sm where sm.profile_id = p.id
)
on conflict do nothing;

-- Prefer unique email index: if conflict on email, skip (manual cleanup rare).
-- The insert above uses on conflict do nothing but we have no general unique on id path;
-- re-run safe via profile_id unique.

-- Backfill invitations without staff_member_id: create roster rows for pending/accepted emails.
-- accepted_user_id references auth.users and may be set when an auth user is pre-created on
-- invite send — that id is NOT always present in profiles. Only attach profile_id when a real
-- profiles row exists; otherwise leave NULL (email is the pre-activation identity).
insert into public.staff_members (
  first_name,
  last_name,
  full_name,
  email,
  role,
  status,
  notes,
  profile_id,
  created_at,
  updated_at
)
select
  coalesce(nullif(trim(i.first_name), ''), nullif(trim(split_part(i.full_name, ' ', 1)), ''), 'Staff'),
  coalesce(
    nullif(trim(i.last_name), ''),
    nullif(
      trim(
        case
          when position(' ' in trim(i.full_name)) > 0
            then substring(trim(i.full_name) from position(' ' in trim(i.full_name)) + 1)
          else ''
        end
      ),
      ''
    ),
    'Member'
  ),
  trim(i.full_name),
  lower(trim(i.email)),
  i.role,
  case
    when i.status = 'accepted' then 'ready'
    when i.status = 'cancelled' then 'draft'
    else 'ready'
  end,
  i.staff_note,
  p.id,
  i.created_at,
  i.updated_at
from public.staff_invitations i
left join public.profiles p on p.id = i.accepted_user_id
where i.staff_member_id is null
  and not exists (
    select 1
    from public.staff_members sm
    where sm.archived_at is null
      and lower(trim(sm.email)) = lower(trim(i.email))
  )
  and not exists (
    select 1
    from public.staff_members sm
    where p.id is not null
      and sm.profile_id = p.id
  )
on conflict do nothing;

-- Link invitations to roster by profile_id or email.
update public.staff_invitations i
set staff_member_id = sm.id
from public.staff_members sm
where i.staff_member_id is null
  and i.accepted_user_id is not null
  and sm.profile_id = i.accepted_user_id;

update public.staff_invitations i
set staff_member_id = sm.id
from public.staff_members sm
where i.staff_member_id is null
  and sm.archived_at is null
  and lower(trim(sm.email)) = lower(trim(i.email));

-- Legacy sent_at: treat created_at as send time for existing invites.
update public.staff_invitations
set sent_at = created_at
where sent_at is null
  and status in ('pending', 'accepted', 'expired');

-- Copy pending grade/class ids onto staff_member junction tables for linked invites.
-- Only copy ids that still exist (pending_* arrays are not FK-enforced).
insert into public.staff_member_grade_levels (staff_member_id, grade_level_id)
select i.staff_member_id, gl.id
from public.staff_invitations i
cross join lateral unnest(i.pending_grade_level_ids) as pending_grade_level_id
join public.grade_levels gl on gl.id = pending_grade_level_id
where i.staff_member_id is not null
  and coalesce(cardinality(i.pending_grade_level_ids), 0) > 0
on conflict do nothing;

insert into public.staff_member_classes (staff_member_id, class_id)
select i.staff_member_id, c.id
from public.staff_invitations i
cross join lateral unnest(i.pending_class_ids) as pending_class_id
join public.classes c on c.id = pending_class_id
where i.staff_member_id is not null
  and coalesce(cardinality(i.pending_class_ids), 0) > 0
on conflict do nothing;

-- Active teachers: mirror live profile access onto roster junctions when linked.
-- Join parent tables so orphaned assignment rows cannot violate junction FKs.
insert into public.staff_member_grade_levels (staff_member_id, grade_level_id)
select sm.id, gl.id
from public.staff_members sm
join public.staff_grade_levels sgl on sgl.profile_id = sm.profile_id
join public.grade_levels gl on gl.id = sgl.grade_level_id
where sm.profile_id is not null
on conflict do nothing;

insert into public.staff_member_classes (staff_member_id, class_id)
select sm.id, c.id
from public.staff_members sm
join public.class_teachers ct on ct.teacher_profile_id = sm.profile_id
join public.classes c on c.id = ct.class_id
where sm.profile_id is not null
on conflict do nothing;
