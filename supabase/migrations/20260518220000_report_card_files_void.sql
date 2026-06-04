-- Void mistaken generated report cards (audit trail; exclude from "final" selection).

alter table public.report_card_files
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id) on delete set null,
  add column if not exists void_reason text;

create index if not exists report_card_files_voided_at_idx
  on public.report_card_files (voided_at)
  where voided_at is not null;

-- Leadership may void generated cards only; registrar may not set void fields.
drop policy if exists "report_card_files_update_policy" on public.report_card_files;
create policy "report_card_files_update_policy"
  on public.report_card_files for update to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    (
      public.is_registrar ()
      and voided_at is null
      and voided_by is null
      and void_reason is null
    )
    or (
      public.is_school_leadership ()
      and (
        voided_at is null
        or source = 'generated'
      )
    )
  );
