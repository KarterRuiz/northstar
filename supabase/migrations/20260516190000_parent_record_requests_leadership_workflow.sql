-- Parent record requests: registrar + leadership workflow fields, status vocabulary,
-- and RLS tightened so teachers no longer read these rows (official records handling).

alter table public.parent_record_requests
  add column if not exists requester_relationship text not null default '';

alter table public.parent_record_requests
  add column if not exists requested_documents text[] not null default '{}'::text[];

alter table public.parent_record_requests
  add column if not exists assigned_to_profile_id uuid references public.profiles (id)
    on delete set null;

alter table public.parent_record_requests
  add column if not exists staff_notes text;

comment on column public.parent_record_requests.requester_relationship is
  'Relationship of the requester to the student (e.g. parent, guardian).';

comment on column public.parent_record_requests.requested_documents is
  'Structured document-type tags requested by the family (application-defined vocabulary).';

comment on column public.parent_record_requests.assigned_to_profile_id is
  'Staff profile handling fulfilment (leadership / registrar directory).';

comment on column public.parent_record_requests.staff_notes is
  'Internal handling notes (not shown on parent-facing surfaces).';

-- Migrate legacy statuses before replacing the check constraint.
update public.parent_record_requests
set status = 'received'
where status in ('pending', 'in_review');

update public.parent_record_requests
set status = 'denied'
where status = 'rejected';

alter table public.parent_record_requests
  drop constraint if exists parent_record_requests_status_check;

alter table public.parent_record_requests
  add constraint parent_record_requests_status_check
    check (status in ('received', 'approved', 'completed', 'denied'));

alter table public.parent_record_requests
  alter column status set default 'received';

create index if not exists parent_record_requests_assigned_idx
  on public.parent_record_requests (assigned_to_profile_id);

-- Leadership + registrar only (drop teacher read path).
drop policy if exists "parent_record_requests_select_policy" on public.parent_record_requests;

create policy "parent_record_requests_select_policy"
  on public.parent_record_requests for select to authenticated
  using (
    public.is_school_leadership ()
    or public.is_registrar ()
  );
