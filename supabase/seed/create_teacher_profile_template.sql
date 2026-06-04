-- =============================================================================
-- Teacher test profile — idempotent upsert into public.profiles
-- =============================================================================
-- Prerequisites:
--   • The UUID must already exist in auth.users (Supabase Dashboard →
--     Authentication → Users). public.profiles.id references auth.users(id).
--   • Run as a role that can insert/update public.profiles (e.g. postgres /
--     service role in SQL Editor).
--
-- Safe to re-run: ON CONFLICT (id) refreshes role and updated_at.
-- =============================================================================

-- Teacher Auth user UUID (Dashboard → Authentication → Users → User UID):
--   0f644d75-a0cd-4aa1-9949-b17f2e2d4e67

insert into public.profiles (id, role)
values ('0f644d75-a0cd-4aa1-9949-b17f2e2d4e67'::uuid, 'teacher')
on conflict (id) do update
set
  role = excluded.role,
  updated_at = now();
