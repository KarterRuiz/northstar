-- Extend enrollment lifecycle statuses (app + forms).
alter table public.student_enrollments
  drop constraint if exists student_enrollments_status_check;

alter table public.student_enrollments
  add constraint student_enrollments_status_check
  check (status in ('active', 'withdrawn', 'graduated', 'inactive'));
