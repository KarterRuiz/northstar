-- Speeds leadership academic review queries that filter by school year label, term, and student.
create index if not exists report_card_files_school_year_term_student_idx
  on public.report_card_files (school_year, term, student_id);
