-- Track how report card PDFs were added; allow teachers to archive generated cards as final.

alter table public.report_card_files
  add column if not exists source text not null default 'uploaded'
    constraint report_card_files_source_check
      check (source in ('uploaded', 'generated'));

create index if not exists report_card_files_source_idx
  on public.report_card_files (source);

drop policy if exists "report_card_files_insert_policy" on public.report_card_files;
create policy "report_card_files_insert_policy"
  on public.report_card_files for insert to authenticated
  with check (
    uploaded_by = auth.uid ()
    and (
      status = 'draft'
      or (status = 'final' and source = 'generated')
    )
    and (
      public.is_school_leadership ()
      or public.is_registrar ()
      or (
        public.is_role ('teacher')
        and public.teacher_can_access_student (student_id)
      )
    )
  );
