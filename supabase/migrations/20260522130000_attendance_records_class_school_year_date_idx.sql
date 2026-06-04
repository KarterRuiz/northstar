-- Speed up teacher attendance summaries that filter by class + school year + date range
-- (e.g. repeated-absence counts, weekly/monthly review queries).

create index if not exists attendance_records_class_school_year_date_idx
  on public.attendance_records (class_id, school_year, attendance_date);
