-- Allow school leadership to create interventions (e.g. attendance follow-up from admin monitoring).

drop policy if exists "student_interventions_leadership_insert" on public.student_interventions;
create policy "student_interventions_leadership_insert"
  on public.student_interventions for insert to authenticated
  with check (
    public.is_school_leadership ()
    and created_by = auth.uid ()
  );
