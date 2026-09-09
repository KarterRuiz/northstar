-- Class-scoped roster position (not the school-wide students.external_id).
-- Additive only: does not overwrite external_id / student_number data.

alter table public.student_enrollments
  add column if not exists roster_number integer;

alter table public.student_enrollments
  drop constraint if exists student_enrollments_roster_number_positive;

alter table public.student_enrollments
  add constraint student_enrollments_roster_number_positive
  check (roster_number is null or roster_number >= 1);

comment on column public.student_enrollments.roster_number is
  'Class roster order for this enrollment (student + class + school year). Distinct from students.external_id (school-wide student number).';

-- One active roster slot per class. Same number may be reused in other classes.
create unique index if not exists student_enrollments_active_class_roster_uidx
  on public.student_enrollments (class_id, roster_number)
  where status = 'active' and roster_number is not null;

create index if not exists student_enrollments_class_roster_idx
  on public.student_enrollments (class_id, roster_number)
  where roster_number is not null;
