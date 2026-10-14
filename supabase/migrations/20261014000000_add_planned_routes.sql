create table if not exists public.planned_routes (
  id text primary key,
  batch_id text not null,
  city text,
  district text,
  path_name text,
  path_part integer,
  coordinates jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planned_routes enable row level security;

drop policy if exists "authenticated read planned routes" on public.planned_routes;
create policy "authenticated read planned routes" on public.planned_routes
for select to authenticated using (
  public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor')
  or (
    public.current_app_role() = 'tech'
    and exists (
      select 1
      from public.planned_poles pole
      join public.user_profiles technician on technician.username = pole.assigned_to
      where pole.batch_id = planned_routes.batch_id
        and technician.id = (select auth.uid())
    )
  )
);

drop policy if exists "design insert planned routes" on public.planned_routes;
create policy "design insert planned routes" on public.planned_routes
for insert to authenticated with check (public.current_app_role() in ('admin', 'design'));

drop policy if exists "design delete planned routes" on public.planned_routes;
create policy "design delete planned routes" on public.planned_routes
for delete to authenticated using (public.current_app_role() in ('admin', 'design'));

drop trigger if exists planned_routes_set_updated_at on public.planned_routes;
create trigger planned_routes_set_updated_at
before update on public.planned_routes
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.planned_routes to authenticated;
