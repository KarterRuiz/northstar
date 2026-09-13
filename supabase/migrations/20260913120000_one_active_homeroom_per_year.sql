-- Homeroom integrity (Phase A, Option A).
-- Today every class is a Primary homeroom: at most one status=active enrollment
-- per (student_id, school_year_id).
--
-- Live check (2026-09-13): 0 students with multiple active enrollments in the
-- same school year — this index is compatible without cleanup of C conflicts.
--
-- When specialist/subject class memberships are introduced:
--   1. Add minimal classes.class_type (e.g. 'homeroom' | 'subject' | ...)
--   2. Drop this index
--   3. Replace with a homeroom-only uniqueness strategy (partial unique via
--      trigger, or expression/index joined to class_type = 'homeroom')
-- Do NOT keep a global one-active-enrollment rule after non-homeroom types exist.
--
-- Deploy AFTER app guards that surface ACTIVE_HOMEROOM_CONFLICT_MESSAGE.
-- Do not apply blindly if live C-conflicts appear later — clean those first.

create unique index if not exists student_enrollments_one_active_homeroom_per_year_uidx
  on public.student_enrollments (student_id, school_year_id)
  where status = 'active';

comment on index public.student_enrollments_one_active_homeroom_per_year_uidx is
  'Option A homeroom integrity: one active enrollment per student per school year. Narrow when class_type exists.';
