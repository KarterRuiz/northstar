-- Report card lifecycle + private storage policies for `report-cards` bucket.

-- -----------------------------------------------------------------------------
-- Table: status column + indexes
-- -----------------------------------------------------------------------------
alter table public.report_card_files
  add column if not exists status text not null default 'draft'
    constraint report_card_files_status_check
      check (status in ('draft', 'final', 'archive'));

create index if not exists report_card_files_status_idx
  on public.report_card_files (status);

create index if not exists report_card_files_year_term_idx
  on public.report_card_files (school_year, term);

-- -----------------------------------------------------------------------------
-- RLS: teachers cannot see archived rows; inserts must start as draft
-- -----------------------------------------------------------------------------
drop policy if exists "report_card_files_select_policy" on public.report_card_files;
create policy "report_card_files_select_policy"
  on public.report_card_files for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
    or (
      public.is_role ('teacher')
      and public.teacher_can_access_student (student_id)
      and status <> 'archive'
    )
  );

drop policy if exists "report_card_files_insert_policy" on public.report_card_files;
create policy "report_card_files_insert_policy"
  on public.report_card_files for insert to authenticated
  with check (
    uploaded_by = auth.uid ()
    and status = 'draft'
    and (
      public.is_school_leadership ()
      or public.is_registrar ()
      or (
        public.is_role ('teacher')
        and public.teacher_can_access_student (student_id)
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Storage bucket (private PDFs only)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-cards',
  'report-cards',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {student_uuid}/{school_year}/{term}/{object_id}.pdf
create or replace function public.report_cards_path_student_id(p_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(p_name, '/', 1), '')::uuid;
$$;

revoke all on function public.report_cards_path_student_id(text) from public;
grant execute on function public.report_cards_path_student_id(text) to authenticated, service_role;

drop policy if exists "report_cards_storage_insert" on storage.objects;
create policy "report_cards_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-cards'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    and exists (
      select 1
      from public.students s
      where s.id = public.report_cards_path_student_id (name)
    )
    and (
      public.is_school_leadership ()
      or public.is_registrar ()
      or (
        public.is_role ('teacher')
        and public.report_cards_path_student_id (name) in (
          select public.teacher_assigned_student_ids ()
        )
      )
    )
  );

drop policy if exists "report_cards_storage_select" on storage.objects;
create policy "report_cards_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-cards'
    and exists (
      select 1
      from public.students s
      where s.id = public.report_cards_path_student_id (name)
    )
    and (
      public.is_school_leadership ()
      or public.is_registrar ()
      or (
        public.is_role ('teacher')
        and public.report_cards_path_student_id (name) in (
          select public.teacher_assigned_student_ids ()
        )
      )
    )
  );

drop policy if exists "report_cards_storage_delete" on storage.objects;
create policy "report_cards_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'report-cards'
    and exists (
      select 1
      from public.students s
      where s.id = public.report_cards_path_student_id (name)
    )
    and (
      public.is_school_leadership ()
      or public.is_registrar ()
      or (
        public.is_role ('teacher')
        and public.report_cards_path_student_id (name) in (
          select public.teacher_assigned_student_ids ()
        )
      )
    )
  );
