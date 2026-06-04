-- =============================================================================
-- Xiwai — initial development seed / setup (SQL)
-- =============================================================================
-- Safe to run in Supabase **SQL Editor** after `20260514_foundation_schema.sql`
-- has been applied. Re-run sections with care: some inserts use ON CONFLICT.
--
-- This file does **not** create auth users. Use the Dashboard for that.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Create the first admin user (Supabase Auth — do this in the Dashboard)
-- -----------------------------------------------------------------------------
-- Steps:
--   a. Open your project: Supabase Dashboard → **Authentication** → **Users**.
--   b. Click **Add user** → **Create new user**.
--   c. Enter email + password (turn off “Auto Confirm User” only if you want
--      email flow; for dev, “Auto Confirm” is convenient).
--   d. After the user is created, open the user row → copy **User UID**
--      (this is `auth.users.id` and must equal `public.profiles.id`).
--
-- You will paste that UUID in **section 2** below.

-- -----------------------------------------------------------------------------
-- 2) Matching profile row for that admin user
-- -----------------------------------------------------------------------------
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- Admin Auth user UUID (matches Dashboard → Authentication → Users):
--   87c8155c-1f0b-4a44-84db-5c567a5f8a18
--
-- We do **not** recommend inserting into `auth.users` from SQL in hosted
-- Supabase; always use Auth / Admin API so passwords and security are handled.
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

-- Idempotent: re-run upserts `role` and refreshes `updated_at` if the row exists.
insert into public.profiles (id, role)
values ('87c8155c-1f0b-4a44-84db-5c567a5f8a18'::uuid, 'admin')
on conflict (id) do update set role = excluded.role, updated_at = now();

-- The rest of this file uses **fixed seed UUIDs** for school data and students.
-- Ensure the Auth user above exists before relying on app login + RLS.

-- -----------------------------------------------------------------------------
-- Fixed IDs for reproducible seed data (safe to keep as-is for local dev)
-- -----------------------------------------------------------------------------
-- school_year
-- '10000000-0000-4000-8000-000000000001'
-- grade_levels (6, 7)
-- '10000000-0000-4000-8000-000000000011'  -- Grade 6
-- '10000000-0000-4000-8000-000000000012'  -- Grade 7
-- class "Homeroom 6A"
-- '10000000-0000-4000-8000-000000000021'
-- students (3)
-- '10000000-0000-4000-8000-000000000031'
-- '10000000-0000-4000-8000-000000000032'
-- '10000000-0000-4000-8000-000000000033'
-- subjects (2)
-- '10000000-0000-4000-8000-000000000041'
-- '10000000-0000-4000-8000-000000000042'
-- terms (2)
-- '10000000-0000-4000-8000-000000000051'  -- T1
-- '10000000-0000-4000-8000-000000000052'  -- T2

-- -----------------------------------------------------------------------------
-- 3) Starter school year
-- -----------------------------------------------------------------------------
insert into public.school_years (id, label, starts_on, ends_on)
values (
  '10000000-0000-4000-8000-000000000001',
  '2025–2026',
  '2025-08-01',
  '2026-06-30'
)
on conflict (label) do nothing;

-- If a row with the same `label` already exists with a different `id`, this
-- insert is skipped (idempotent). Adjust the label if you need a fresh year row.

-- -----------------------------------------------------------------------------
-- 4) Grade levels
-- -----------------------------------------------------------------------------
insert into public.grade_levels (id, name, sort_order, code)
values
  ('10000000-0000-4000-8000-000000000011', 'Grade 6', 6, 'G6'),
  ('10000000-0000-4000-8000-000000000012', 'Grade 7', 7, 'G7')
on conflict (name) do nothing;

-- Conflicts on `sort_order` are avoided by using distinct names; if you
-- re-seed with different IDs but same sort_order, adjust manually.

-- -----------------------------------------------------------------------------
-- 5) One sample class (2025–2026, Grade 6, section A)
-- -----------------------------------------------------------------------------
insert into public.classes (
  id,
  school_year_id,
  grade_level_id,
  name,
  section,
  is_active
)
values (
  '10000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000011',
  'Homeroom',
  '6A',
  true
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 6) Optional sample teacher (profile placeholder)
-- -----------------------------------------------------------------------------
-- Teachers need a real `auth.users` row first (same steps as admin: Auth →
-- Users → Add user). Then paste that UUID here and uncomment:

-- insert into public.profiles (id, role)
-- values ('PASTE_TEACHER_USER_UUID_HERE'::uuid, 'teacher')
-- on conflict (id) do update set role = excluded.role, updated_at = now();

-- Optional: assign that teacher to the sample class (uncomment both blocks):

-- insert into public.class_teachers (id, class_id, teacher_profile_id, role)
-- values (
--   '10000000-0000-4000-8000-000000000061',
--   '10000000-0000-4000-8000-000000000021',
--   'PASTE_TEACHER_USER_UUID_HERE'::uuid,
--   'homeroom'
-- )
-- on conflict (id) do nothing;

-- If you use `on conflict (class_id, teacher_profile_id)` from the schema,
-- prefer that unique constraint instead of conflict on `id`.

-- -----------------------------------------------------------------------------
-- 7) Three sample students
-- -----------------------------------------------------------------------------
insert into public.students (id, first_name, last_name, preferred_name, external_id)
values
  (
    '10000000-0000-4000-8000-000000000031',
    'Maya',
    'Chen',
    'Maya',
    'EXT-STU-0001'
  ),
  (
    '10000000-0000-4000-8000-000000000032',
    'Jordan',
    'Patel',
    null,
    'EXT-STU-0002'
  ),
  (
    '10000000-0000-4000-8000-000000000033',
    'Sam',
    'Rivera',
    'Sammy',
    'EXT-STU-0003'
  )
on conflict (external_id) do nothing;

-- Uses `external_id` for idempotent re-runs; change those codes if you need new
-- rows alongside existing ones.

-- -----------------------------------------------------------------------------
-- 8) Student enrollments (all three in Homeroom 6A for 2025–2026)
-- -----------------------------------------------------------------------------
insert into public.student_enrollments (
  id,
  student_id,
  class_id,
  school_year_id,
  status
)
values
  (
    '10000000-0000-4000-8000-000000000071',
    '10000000-0000-4000-8000-000000000031',
    '10000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000072',
    '10000000-0000-4000-8000-000000000032',
    '10000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000073',
    '10000000-0000-4000-8000-000000000033',
    '10000000-0000-4000-8000-000000000021',
    '10000000-0000-4000-8000-000000000001',
    'active'
  )
on conflict (student_id, class_id) where (status = 'active') do nothing;

-- Matches partial unique index `student_enrollments_active_student_class_uidx`.

-- -----------------------------------------------------------------------------
-- 9) Basic subjects (per school year) and terms
-- -----------------------------------------------------------------------------
insert into public.subjects (id, school_year_id, name, code)
values
  (
    '10000000-0000-4000-8000-000000000041',
    '10000000-0000-4000-8000-000000000001',
    'English Language Arts',
    'ELA'
  ),
  (
    '10000000-0000-4000-8000-000000000042',
    '10000000-0000-4000-8000-000000000001',
    'Mathematics',
    'MATH'
  )
on conflict (school_year_id, code) do nothing;

insert into public.terms (id, school_year_id, name, code, starts_on, ends_on)
values
  (
    '10000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000001',
    'Term 1',
    'T1',
    '2025-08-01',
    '2025-12-20'
  ),
  (
    '10000000-0000-4000-8000-000000000052',
    '10000000-0000-4000-8000-000000000001',
    'Term 2',
    'T2',
    '2026-01-06',
    '2026-06-15'
  )
on conflict (school_year_id, code) do nothing;

-- -----------------------------------------------------------------------------
-- Sanity check (optional): uncomment to list seeded rows
-- -----------------------------------------------------------------------------
-- select * from public.school_years where id = '10000000-0000-4000-8000-000000000001';
-- select * from public.students where id in (
--   '10000000-0000-4000-8000-000000000031',
--   '10000000-0000-4000-8000-000000000032',
--   '10000000-0000-4000-8000-000000000033'
-- );
