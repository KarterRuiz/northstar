-- Institution profile (singleton) + school logo storage for report cards.

-- -----------------------------------------------------------------------------
-- Table: one row per deployment (single-school tenancy)
-- -----------------------------------------------------------------------------
create table if not exists public.school_settings (
  id uuid primary key default '00000000-0000-4000-8000-000000000001'::uuid,
  school_name text not null default '',
  logo_storage_path text,
  school_address text not null default '',
  school_phone text not null default '',
  school_email text not null default '',
  website text not null default '',
  primary_color text not null default '#1e3a5f',
  secondary_color text not null default '#4a6fa5',
  report_card_footer text not null default '',
  principal_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_settings_singleton_id_chk check (
    id = '00000000-0000-4000-8000-000000000001'::uuid
  ),
  constraint school_settings_primary_color_chk check (
    primary_color = '' or primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint school_settings_secondary_color_chk check (
    secondary_color = '' or secondary_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

comment on table public.school_settings is
  'Singleton institution identity for official documents (report cards, records). Platform branding stays in the app shell.';

insert into public.school_settings (id)
values ('00000000-0000-4000-8000-000000000001'::uuid)
on conflict (id) do nothing;

drop trigger if exists trg_school_settings_updated_at on public.school_settings;
create trigger trg_school_settings_updated_at
  before update on public.school_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: leadership read/write; registrar read-only; teachers denied
-- -----------------------------------------------------------------------------
alter table public.school_settings enable row level security;

drop policy if exists "school_settings_select_policy" on public.school_settings;
create policy "school_settings_select_policy"
  on public.school_settings for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

drop policy if exists "school_settings_insert_policy" on public.school_settings;
create policy "school_settings_insert_policy"
  on public.school_settings for insert to authenticated
  with check (public.is_school_leadership ());

drop policy if exists "school_settings_update_policy" on public.school_settings;
create policy "school_settings_update_policy"
  on public.school_settings for update to authenticated
  using (public.is_school_leadership ())
  with check (public.is_school_leadership ());

grant select, insert, update on public.school_settings to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Report branding RPC (teachers may preview report cards; no direct table access)
-- -----------------------------------------------------------------------------
create or replace function public.school_settings_report_branding()
returns table (
  school_name text,
  logo_storage_path text,
  school_address text,
  school_phone text,
  school_email text,
  website text,
  primary_color text,
  secondary_color text,
  report_card_footer text,
  principal_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.school_name,
    s.logo_storage_path,
    s.school_address,
    s.school_phone,
    s.school_email,
    s.website,
    s.primary_color,
    s.secondary_color,
    s.report_card_footer,
    s.principal_name
  from public.school_settings s
  where s.id = '00000000-0000-4000-8000-000000000001'::uuid
  limit 1;
$$;

comment on function public.school_settings_report_branding() is
  'Branding fields for printable report cards. Callable by any authenticated user; underlying table RLS still blocks direct teacher SELECT.';

revoke all on function public.school_settings_report_branding() from public;
grant execute on function public.school_settings_report_branding() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Storage bucket: school logos (images for report card header)
-- Path convention: logo.{png|jpg|jpeg|webp|svg}
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-logos',
  'school-logos',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "school_logos_storage_insert" on storage.objects;
create policy "school_logos_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school-logos'
    and name ~ '^logo\.(png|jpe?g|webp|svg)$'
    and public.is_school_leadership ()
  );

drop policy if exists "school_logos_storage_update" on storage.objects;
create policy "school_logos_storage_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'school-logos'
    and public.is_school_leadership ()
  )
  with check (
    bucket_id = 'school-logos'
    and name ~ '^logo\.(png|jpe?g|webp|svg)$'
    and public.is_school_leadership ()
  );

drop policy if exists "school_logos_storage_select" on storage.objects;
create policy "school_logos_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'school-logos');

drop policy if exists "school_logos_storage_delete" on storage.objects;
create policy "school_logos_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'school-logos'
    and public.is_school_leadership ()
  );
