-- -----------------------------------------------------------------------------
-- Staff invitations (admin onboarding MVP; no Auth Admin API)
-- -----------------------------------------------------------------------------
create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null
    constraint staff_invitations_role_check
      check (role in ('admin', 'principal', 'vice_principal', 'registrar', 'teacher')),
  status text not null default 'pending'
    constraint staff_invitations_status_check
      check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by uuid not null references public.profiles (id) on delete restrict,
  accepted_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_invitations is
  'Admin-created staff onboarding records; link to auth.users after manual user creation in Supabase.';

create index if not exists staff_invitations_status_idx on public.staff_invitations (status);
create index if not exists staff_invitations_email_idx on public.staff_invitations (lower(trim(email)));
create index if not exists staff_invitations_invited_by_idx on public.staff_invitations (invited_by);

-- At most one pending invite per normalized email.
create unique index if not exists staff_invitations_one_pending_email_uidx
  on public.staff_invitations (lower(trim(email)))
  where status = 'pending';

create or replace function public.staff_invitations_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  new.full_name := trim(new.full_name);
  return new;
end;
$$;

drop trigger if exists trg_staff_invitations_normalize on public.staff_invitations;
create trigger trg_staff_invitations_normalize
  before insert or update of email, full_name on public.staff_invitations
  for each row execute function public.staff_invitations_normalize();

drop trigger if exists set_updated_at on public.staff_invitations;
create trigger set_updated_at
  before update on public.staff_invitations
  for each row execute function public.set_updated_at();

revoke all on function public.staff_invitations_normalize() from public;
grant execute on function public.staff_invitations_normalize() to postgres, authenticated, service_role;

alter table public.staff_invitations enable row level security;

drop policy if exists "staff_invitations_select_admin" on public.staff_invitations;
create policy "staff_invitations_select_admin"
  on public.staff_invitations for select to authenticated
  using (public.is_role ('admin'));

drop policy if exists "staff_invitations_insert_admin" on public.staff_invitations;
create policy "staff_invitations_insert_admin"
  on public.staff_invitations for insert to authenticated
  with check (
    public.is_role ('admin')
    and invited_by = auth.uid()
  );

drop policy if exists "staff_invitations_update_admin" on public.staff_invitations;
create policy "staff_invitations_update_admin"
  on public.staff_invitations for update to authenticated
  using (public.is_role ('admin'))
  with check (public.is_role ('admin'));

grant select, insert, update, delete on public.staff_invitations to authenticated, service_role;
grant all on public.staff_invitations to postgres;
