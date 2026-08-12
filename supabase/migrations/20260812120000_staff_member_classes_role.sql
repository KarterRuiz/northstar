-- -----------------------------------------------------------------------------
-- Class staffing roles on staff_member_classes (canonical pre-activation source).
-- class_teachers remains the live access mirror keyed by teacher_profile_id once
-- a staff member activates; it is not the roster picker source of truth.
--
-- Idempotent / safe to re-run after a partial apply in Supabase SQL Editor.
-- -----------------------------------------------------------------------------

alter table public.staff_member_classes
  add column if not exists role text not null default 'co_teacher';

alter table public.staff_member_classes
  drop constraint if exists staff_member_classes_role_check;

alter table public.staff_member_classes
  add constraint staff_member_classes_role_check
  check (role in ('homeroom', 'co_teacher', 'subject', 'assistant'));

comment on column public.staff_member_classes.role is
  'Class staffing role (homeroom / co_teacher / subject / assistant). Canonical for scheduling before auth activation; mirrored to class_teachers when profile_id is set.';

comment on table public.staff_member_classes is
  'Canonical class staffing by staff_member_id. Supports pre-activation assignment; syncs to class_teachers on profile link.';

create index if not exists staff_member_classes_class_idx
  on public.staff_member_classes (class_id);

-- Backfill missing junction rows from live class_teachers (linked profiles only).
insert into public.staff_member_classes (staff_member_id, class_id, role)
select sm.id, ct.class_id, ct.role
from public.class_teachers ct
join public.staff_members sm on sm.profile_id = ct.teacher_profile_id
join public.classes c on c.id = ct.class_id
where ct.role in ('homeroom', 'co_teacher', 'subject', 'assistant')
on conflict (staff_member_id, class_id) do nothing;

-- Prefer class_teachers.role when a linked assignment already exists on both sides.
-- NOTE: In PostgreSQL UPDATE ... FROM, the target alias (smc) is NOT visible inside
-- JOIN ON clauses of the FROM list. Put target-table predicates in WHERE instead.
update public.staff_member_classes smc
set role = ct.role
from public.staff_members sm
inner join public.class_teachers ct
  on ct.teacher_profile_id = sm.profile_id
where smc.staff_member_id = sm.id
  and ct.class_id = smc.class_id
  and sm.profile_id is not null
  and ct.role in ('homeroom', 'co_teacher', 'subject', 'assistant')
  and smc.role is distinct from ct.role;

-- If multiple homeroom rows somehow exist for one class, keep the earliest and demote the rest.
with ranked as (
  select
    id,
    row_number() over (partition by class_id order by created_at asc, id asc) as rn
  from public.staff_member_classes
  where role = 'homeroom'
)
update public.staff_member_classes smc
set role = 'co_teacher'
from ranked
where smc.id = ranked.id
  and ranked.rn > 1;

-- At most one homeroom teacher per class in the roster junction.
-- IF NOT EXISTS makes this safe if a prior run already created the index.
create unique index if not exists staff_member_classes_one_homeroom_per_class_uidx
  on public.staff_member_classes (class_id)
  where role = 'homeroom';
