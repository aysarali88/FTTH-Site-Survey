alter table public.planned_routes add column if not exists style_key text;
alter table public.planned_routes add column if not exists style_data jsonb not null default '{}'::jsonb;
alter table public.planned_routes add column if not exists properties jsonb not null default '{}'::jsonb;

drop policy if exists "authenticated read planned routes" on public.planned_routes;
create policy "authenticated read planned routes" on public.planned_routes
for select to authenticated using (
  public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor', 'management')
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
  or (
    public.current_app_role() = 'tech'
    and exists (
      select 1
      from public.legacy_area_assignments assignment
      where assignment.technician_username = (
        select username from public.user_profiles where id = (select auth.uid())
      )
        and assignment.active
        and assignment.city = planned_routes.city
        and assignment.district = planned_routes.district
    )
  )
);

create table if not exists public.planned_assets (
  id text primary key,
  batch_id text not null,
  city text,
  district text,
  asset_type text not null check (asset_type in ('point', 'line', 'polygon')),
  asset_name text,
  style_key text,
  style_data jsonb not null default '{}'::jsonb,
  properties jsonb not null default '{}'::jsonb,
  coordinates jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planned_assets enable row level security;

drop policy if exists "authenticated read planned assets" on public.planned_assets;
create policy "authenticated read planned assets" on public.planned_assets
for select to authenticated using (
  public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor', 'management')
  or (
    public.current_app_role() = 'tech'
    and exists (
      select 1
      from public.planned_poles pole
      join public.user_profiles technician on technician.username = pole.assigned_to
      where pole.batch_id = planned_assets.batch_id
        and technician.id = (select auth.uid())
    )
  )
  or (
    public.current_app_role() = 'tech'
    and exists (
      select 1
      from public.legacy_area_assignments assignment
      where assignment.technician_username = (
        select username from public.user_profiles where id = (select auth.uid())
      )
        and assignment.active
        and assignment.city = planned_assets.city
        and assignment.district = planned_assets.district
    )
  )
);

drop policy if exists "design insert planned assets" on public.planned_assets;
create policy "design insert planned assets" on public.planned_assets
for insert to authenticated with check (public.current_app_role() in ('admin', 'design'));

drop policy if exists "design delete planned assets" on public.planned_assets;
create policy "design delete planned assets" on public.planned_assets
for delete to authenticated using (public.current_app_role() in ('admin', 'design'));

drop trigger if exists planned_assets_set_updated_at on public.planned_assets;
create trigger planned_assets_set_updated_at
before update on public.planned_assets
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.planned_assets to authenticated;
