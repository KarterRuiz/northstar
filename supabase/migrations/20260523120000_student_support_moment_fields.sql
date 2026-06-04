-- Student Support moment fields (extends behavior_records; RLS unchanged).

-- Allow intervention follow-up as a distinct logged type (MTSS-aligned).
alter table public.behavior_records
  drop constraint if exists behavior_records_type_check;

alter table public.behavior_records
  add constraint behavior_records_type_check
    check (
      behavior_type in (
        'positive_recognition',
        'classroom_concern',
        'behavior_incident',
        'participation',
        'social_emotional',
        'parent_contact',
        'intervention_followup'
      )
    );

-- Guided-flow category (UI card), distinct from legacy behavior_type where needed.
alter table public.behavior_records
  drop constraint if exists behavior_records_support_category_check;

alter table public.behavior_records
  add column if not exists support_category text;

alter table public.behavior_records
  add constraint behavior_records_support_category_check
    check (
      support_category is null
      or support_category in (
        'positive_recognition',
        'quick_concern',
        'parent_communication',
        'sel_observation',
        'support_strategy',
        'intervention_followup'
      )
    );

alter table public.behavior_records
  add column if not exists support_tags text[] not null default '{}'::text[];

alter table public.behavior_records
  add column if not exists generated_summary text;

alter table public.behavior_records
  add column if not exists teacher_note text;

alter table public.behavior_records
  add column if not exists follow_up_required boolean not null default false;

alter table public.behavior_records
  add column if not exists parent_contacted boolean;

alter table public.behavior_records
  add column if not exists time_of_day text;

alter table public.behavior_records
  add column if not exists related_subject text;

alter table public.behavior_records
  add column if not exists quick_reason text;

comment on column public.behavior_records.support_category is
  'Guided-flow moment type (UI); pairs with behavior_type for storage and flags.';

comment on column public.behavior_records.generated_summary is
  'Deterministic template summary for timeline and parent-safe sharing.';

comment on column public.behavior_records.teacher_note is
  'Optional private note from teacher; may duplicate legacy description for reads.';

comment on column public.behavior_records.follow_up_required is
  'Whether the team should plan a follow-up touchpoint.';

comment on column public.behavior_records.parent_contacted is
  'Whether a parent/caregiver was reached for this moment (nullable = not specified).';

comment on column public.behavior_records.quick_reason is
  'Structured quick-reason key or label from the guided picker.';
