-- -----------------------------------------------------------------------------
-- Staff roster: email optional until invitation time
-- Build the School (roster) → Invite the People (email required only then)
-- -----------------------------------------------------------------------------

alter table public.staff_members
  alter column email drop not null;

comment on column public.staff_members.email is
  'Optional until invitation. Null = draft / not invited. Required when sending an invitation.';

-- Normalize empty strings to null; leave true nulls alone.
create or replace function public.staff_members_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is not null then
    new.email := nullif(lower(trim(new.email)), '');
  end if;
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.full_name := trim(concat_ws(' ', new.first_name, new.last_name));
  if new.notes is not null then
    new.notes := trim(new.notes);
    if new.notes = '' then
      new.notes := null;
    end if;
  end if;
  if new.status = 'archived' and new.archived_at is null then
    new.archived_at := now();
  end if;
  if new.status is distinct from 'archived' then
    new.archived_at := null;
  end if;
  return new;
end;
$$;

-- Unique active email only when email is present (many nulls allowed).
drop index if exists public.staff_members_one_active_email_uidx;
create unique index staff_members_one_active_email_uidx
  on public.staff_members (lower(trim(email)))
  where archived_at is null and email is not null;

drop index if exists public.staff_members_email_idx;
create index staff_members_email_idx
  on public.staff_members (lower(trim(email)))
  where email is not null;
