create table if not exists public.legacy_area_assignments (
  id uuid primary key default gen_random_uuid(),
  technician_username text not null,
  city text not null check (city in ('Misrata', 'Tripoli')),
  district text not null,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (technician_username, city, district)
);

alter table public.legacy_area_assignments enable row level security;

drop trigger if exists legacy_area_assignments_set_updated_at on public.legacy_area_assignments;
create trigger legacy_area_assignments_set_updated_at
before update on public.legacy_area_assignments
for each row execute function public.set_updated_at();

drop policy if exists "workflow roles read legacy assignments" on public.legacy_area_assignments;
create policy "workflow roles read legacy assignments"
on public.legacy_area_assignments
for select to authenticated
using (
  public.current_app_role() in ('admin', 'design', 'engineer')
  or (
    public.current_app_role() = 'tech'
    and technician_username = (
      select username from public.user_profiles where id = (select auth.uid())
    )
  )
);

grant select on public.legacy_area_assignments to authenticated;

create or replace function public.admin_assign_legacy_area(
  p_technician_username text,
  p_city text,
  p_district text
)
returns public.legacy_area_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.legacy_area_assignments;
  actor text;
  technician text := nullif(trim(coalesce(p_technician_username, '')), '');
  area_city text := nullif(trim(coalesce(p_city, '')), '');
  area_district text := nullif(trim(coalesce(p_district, '')), '');
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  if technician is null or area_city is null or area_district is null then
    raise exception 'Technician, city, and district are required';
  end if;

  if not (
    (area_city = 'Misrata' and area_district in ('راس عمار', 'راس علي'))
    or (area_city = 'Tripoli' and area_district in ('شارع الظل', 'حي الاندلس 2', 'المنصوره'))
  ) then
    raise exception 'This district is not available in Legacy Mode';
  end if;

  if not exists (
    select 1 from public.user_profiles
    where username = technician and role = 'tech' and active = true
  ) then
    raise exception 'Active technician not found';
  end if;

  select username into actor from public.user_profiles where id = (select auth.uid());

  insert into public.legacy_area_assignments (technician_username, city, district, active, created_by)
  values (technician, area_city, area_district, true, actor)
  on conflict (technician_username, city, district)
  do update set active = true, created_by = excluded.created_by, updated_at = now()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.admin_assign_legacy_area(text, text, text) from public;
revoke execute on function public.admin_assign_legacy_area(text, text, text) from anon;
grant execute on function public.admin_assign_legacy_area(text, text, text) to authenticated;

create or replace function public.admin_remove_legacy_area(p_id uuid)
returns public.legacy_area_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.legacy_area_assignments;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  update public.legacy_area_assignments
  set active = false, updated_at = now()
  where id = p_id
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Legacy assignment not found';
  end if;

  return result_row;
end;
$$;

revoke all on function public.admin_remove_legacy_area(uuid) from public;
revoke execute on function public.admin_remove_legacy_area(uuid) from anon;
grant execute on function public.admin_remove_legacy_area(uuid) to authenticated;

create or replace function public.technician_add_legacy_planting(
  p_latitude double precision,
  p_longitude double precision,
  p_city text,
  p_district text,
  p_has_objection boolean default false,
  p_is_existing boolean default false,
  p_notes text default null,
  p_photo_url text default null
)
returns public.column_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.column_checks;
  actor text;
  area_city text := nullif(trim(coalesce(p_city, '')), '');
  area_district text := nullif(trim(coalesce(p_district, '')), '');
  record_id text;
begin
  if public.current_app_role() <> 'tech' then
    raise exception 'Not authorized';
  end if;

  select username into actor from public.user_profiles where id = (select auth.uid());

  if not exists (
    select 1 from public.legacy_area_assignments
    where technician_username = actor
      and city = area_city
      and district = area_district
      and active = true
  ) then
    raise exception 'This Legacy area is not assigned to the technician';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'A valid location is required';
  end if;

  record_id := 'COL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into public.column_checks (
    id, latitude, longitude, city, district, tech_name,
    has_objection, is_existing, is_planted, notes, photo_url
  )
  values (
    record_id, p_latitude, p_longitude, area_city, area_district, actor,
    coalesce(p_has_objection, false), coalesce(p_is_existing, false), true,
    nullif(trim(coalesce(p_notes, '')), ''), nullif(trim(coalesce(p_photo_url, '')), '')
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.technician_add_legacy_planting(double precision, double precision, text, text, boolean, boolean, text, text) from public;
revoke execute on function public.technician_add_legacy_planting(double precision, double precision, text, text, boolean, boolean, text, text) from anon;
grant execute on function public.technician_add_legacy_planting(double precision, double precision, text, text, boolean, boolean, text, text) to authenticated;

notify pgrst, 'reload schema';
