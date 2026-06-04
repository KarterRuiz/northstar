-- -----------------------------------------------------------------------------
-- Staff onboarding: directory managers (RLS), invitation metadata, class hints
-- -----------------------------------------------------------------------------
create or replace function public.is_staff_directory_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role (
    array['admin', 'principal', 'vice_principal', 'registrar']::text[]
  );
$$;

comment on function public.is_staff_directory_manager() is
  'True when the caller may manage staff directory, invitations, and profile roles.';

revoke all on function public.is_staff_directory_manager() from public;
grant execute on function public.is_staff_directory_manager() to authenticated, service_role;

-- profiles: allow school leadership + registrar to provision / update staff (not delete).
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_staff_directory_managers"
  on public.profiles for insert to authenticated
  with check (public.is_staff_directory_manager ());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_staff_directory_managers"
  on public.profiles for update to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

-- staff_invitations: same manager group (insert still ties invited_by to auth.uid()).
drop policy if exists "staff_invitations_select_admin" on public.staff_invitations;
drop policy if exists "staff_invitations_insert_admin" on public.staff_invitations;
drop policy if exists "staff_invitations_update_admin" on public.staff_invitations;

create policy "staff_invitations_select_staff_directory_managers"
  on public.staff_invitations for select to authenticated
  using (public.is_staff_directory_manager ());

create policy "staff_invitations_insert_staff_directory_managers"
  on public.staff_invitations for insert to authenticated
  with check (
    public.is_staff_directory_manager ()
    and invited_by = auth.uid()
  );

create policy "staff_invitations_update_staff_directory_managers"
  on public.staff_invitations for update to authenticated
  using (public.is_staff_directory_manager ())
  with check (public.is_staff_directory_manager ());

-- Extend invitation rows (idempotent column adds).
alter table public.staff_invitations
  add column if not exists first_name text;

alter table public.staff_invitations
  add column if not exists last_name text;

alter table public.staff_invitations
  add column if not exists invite_token text;

alter table public.staff_invitations
  alter column invite_token set default encode(gen_random_bytes (24), 'hex');

alter table public.staff_invitations
  add column if not exists expires_at timestamptz;

alter table public.staff_invitations
  add column if not exists accepted_at timestamptz;

alter table public.staff_invitations
  add column if not exists staff_note text;

alter table public.staff_invitations
  add column if not exists pending_class_ids uuid[] not null default '{}'::uuid[];

update public.staff_invitations
set
  invite_token = encode(gen_random_bytes (24), 'hex')
where invite_token is null;

update public.staff_invitations
set expires_at = created_at + interval '14 days'
where expires_at is null;

alter table public.staff_invitations
  alter column invite_token set not null;

alter table public.staff_invitations
  alter column expires_at set not null;

alter table public.staff_invitations
  alter column expires_at set default (now() + interval '14 days');

create unique index if not exists staff_invitations_invite_token_uidx
  on public.staff_invitations (invite_token);

comment on column public.staff_invitations.invite_token is
  'Opaque token for recovery / sign-in links; not a password.';

comment on column public.staff_invitations.pending_class_ids is
  'Classes to attach as co_teacher when the invitee completes first sign-in (teachers only).';

-- Normalize optional name parts with email / full_name.
create or replace function public.staff_invitations_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  new.full_name := trim(new.full_name);
  if new.first_name is not null then
    new.first_name := trim(new.first_name);
  end if;
  if new.last_name is not null then
    new.last_name := trim(new.last_name);
  end if;
  if new.staff_note is not null then
    new.staff_note := trim(new.staff_note);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_staff_invitations_normalize on public.staff_invitations;
create trigger trg_staff_invitations_normalize
  before insert or update of email, full_name, first_name, last_name, staff_note on public.staff_invitations
  for each row execute function public.staff_invitations_normalize();

grant execute on function public.staff_invitations_normalize() to postgres, authenticated, service_role;
