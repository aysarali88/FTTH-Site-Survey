alter table public.planned_poles
  add column if not exists batch_id text;

notify pgrst, 'reload schema';
