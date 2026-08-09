-- Grade levels: allow multiple grades to share the same display/sort order.
-- Parallel programs (e.g. Grade 2 and Experimental Grade 2-1) may use the same
-- sort position. Identity remains name (unique) and optional code (unique when set).
--
-- APPLY: This migration must be applied to every Supabase environment (local + production)
-- before creating grades that share a display order will succeed at the database layer.
-- Example: `supabase db push` (linked project) or run this file in the Supabase SQL editor.

alter table public.grade_levels
  drop constraint if exists grade_levels_sort_order_unique;

-- Non-unique index keeps list ordering efficient when many grades share an order.
create index if not exists grade_levels_sort_order_name_idx
  on public.grade_levels (sort_order, name);
