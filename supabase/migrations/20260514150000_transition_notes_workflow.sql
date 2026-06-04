-- Transition note workflow: extended statuses, review/archive timestamps, tighter teacher RLS.
--
-- REQUIRED: Apply this migration in Supabase (SQL editor or `supabase db push`) before
-- using transition-note moderation or profile loaders that expect reviewed_at/archived_at.

alter table public.transition_notes drop constraint if exists transition_notes_status_check;

alter table public.transition_notes
  add constraint transition_notes_status_check
  check (status in ('draft', 'submitted', 'reviewed', 'archived', 'reopened'));

alter table public.transition_notes
  add column if not exists reviewed_at timestamptz;

alter table public.transition_notes
  add column if not exists archived_at timestamptz;

-- Teacher updates only while drafting or after leadership reopen; leadership/registrar retain full updates.
drop policy if exists "transition_notes_update_policy" on public.transition_notes;

create policy "transition_notes_teacher_update"
  on public.transition_notes for update to authenticated
  using (
    public.is_role ('teacher')
    and author_profile_id = auth.uid ()
    and public.teacher_can_access_student (student_id)
    and status in ('draft', 'reopened')
  )
  with check (
    public.is_role ('teacher')
    and author_profile_id = auth.uid ()
    and public.teacher_can_access_student (student_id)
    and status in ('draft', 'reopened', 'submitted')
  );

create policy "transition_notes_leadership_update"
  on public.transition_notes for update to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  )
  with check (
    public.is_school_leadership ()
    or public.is_registrar ()
  );

-- Teachers may only create drafts; leadership/registrar may seed any valid status.
drop policy if exists "transition_notes_insert_policy" on public.transition_notes;

create policy "transition_notes_insert_policy"
  on public.transition_notes for insert to authenticated
  with check (
    (
      public.is_school_leadership ()
      or public.is_registrar ()
    )
    or (
      public.is_role ('teacher')
      and author_profile_id = auth.uid ()
      and public.teacher_can_access_student (student_id)
      and status = 'draft'
    )
  );
