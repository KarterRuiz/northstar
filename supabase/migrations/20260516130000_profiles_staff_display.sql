-- Staff display fields on profiles (name, email, active flag).

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists is_active boolean not null default true;

comment on column public.profiles.full_name is
  'Display name; synced from staff_invitations on accept or manual link.';

comment on column public.profiles.email is
  'Work email for directory labels; synced from invitation or auth on accept.';

comment on column public.profiles.is_active is
  'When false, staff may be hidden from assignment pickers in future UI.';

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
