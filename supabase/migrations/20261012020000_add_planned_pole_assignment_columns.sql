alter table public.planned_poles
  add column if not exists assigned_to text,
  add column if not exists assigned_at timestamptz,
  add column if not exists deleted_at timestamptz;

notify pgrst, 'reload schema';
