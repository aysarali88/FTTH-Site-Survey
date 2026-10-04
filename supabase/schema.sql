create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  role text not null check (role in ('admin', 'tech', 'design', 'engineer', 'supervisor')),
  city text,
  district text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "users can read own profile" on public.user_profiles;
create policy "users can read own profile" on public.user_profiles
for select to authenticated using ((select auth.uid()) = id);

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
declare account_username text; account_role text;
begin
  account_username := split_part(new.email, '@', 1);
  account_role := case account_username
    when 'designer1' then 'design'
    when 'engineer1' then 'engineer'
    when 'supervisor1' then 'supervisor'
    else 'tech'
  end;
  insert into public.user_profiles (id, username, display_name, role)
  values (new.id, account_username, account_username, account_role)
  on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, role = excluded.role, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.handle_new_user_profile();

grant select on public.user_profiles to authenticated;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles where id = (select auth.uid());
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create table if not exists public.planned_poles (
  id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  city text,
  district text,
  point_name text,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'validated', 'rejected', 'planted')),
  validation_notes text,
  validated_by text,
  validated_at timestamptz,
  is_planted boolean not null default false,
  planted_record_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planned_poles enable row level security;

drop policy if exists "authenticated read planned poles" on public.planned_poles;
create policy "authenticated read planned poles" on public.planned_poles
for select to authenticated using (public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor'));

drop policy if exists "design insert planned poles" on public.planned_poles;
create policy "design insert planned poles" on public.planned_poles
for insert to authenticated with check (public.current_app_role() in ('admin', 'design'));

drop policy if exists "design delete planned poles" on public.planned_poles;
create policy "design delete planned poles" on public.planned_poles
for delete to authenticated using (public.current_app_role() in ('admin', 'design'));

drop trigger if exists planned_poles_set_updated_at on public.planned_poles;
create trigger planned_poles_set_updated_at
before update on public.planned_poles
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.planned_poles to authenticated;

create or replace function public.engineer_update_planned_pole(
  p_id text, p_latitude double precision, p_longitude double precision,
  p_status text, p_notes text default null
)
returns public.planned_poles language plpgsql security definer set search_path = public
as $$
declare result_row public.planned_poles; actor text;
begin
  if public.current_app_role() not in ('admin', 'engineer') then raise exception 'Not authorized'; end if;
  if p_status not in ('validated', 'rejected') then raise exception 'Invalid validation status'; end if;
  select username into actor from public.user_profiles where id = (select auth.uid());
  update public.planned_poles set latitude = p_latitude, longitude = p_longitude,
    validation_status = p_status, validation_notes = nullif(trim(coalesce(p_notes, '')), ''),
    validated_by = actor, validated_at = now(), updated_at = now()
  where id = p_id returning * into result_row;
  if result_row.id is null then raise exception 'Planned pole not found'; end if;
  return result_row;
end;
$$;

create or replace function public.engineer_add_planned_pole(
  p_latitude double precision, p_longitude double precision, p_city text,
  p_district text default null, p_name text default null
)
returns public.planned_poles language plpgsql security definer set search_path = public
as $$
declare result_row public.planned_poles; actor text; new_id text;
begin
  if public.current_app_role() not in ('admin', 'engineer') then raise exception 'Not authorized'; end if;
  select username into actor from public.user_profiles where id = (select auth.uid());
  new_id := 'PLAN-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(md5(random()::text), 1, 6));
  insert into public.planned_poles (id, latitude, longitude, city, district, point_name, validation_status, created_by)
  values (new_id, p_latitude, p_longitude, p_city, nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_name, '')), ''), 'pending', actor)
  returning * into result_row;
  return result_row;
end;
$$;

revoke all on function public.engineer_update_planned_pole(text, double precision, double precision, text, text) from public;
grant execute on function public.engineer_update_planned_pole(text, double precision, double precision, text, text) to authenticated;
revoke all on function public.engineer_add_planned_pole(double precision, double precision, text, text, text) from public;
grant execute on function public.engineer_add_planned_pole(double precision, double precision, text, text, text) to authenticated;

create table if not exists public.buildings (
  id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  city text,
  building_type text,
  floor_number integer,
  users_number integer,
  building_status text,
  district text,
  tech_name text,
  survey_date date,
  record_status text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poles (
  id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  city text,
  pole_owner text,
  pole_type text,
  pole_length numeric,
  pole_status text,
  district text,
  tech_name text,
  survey_date date,
  record_status text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.column_checks (
  id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  city text,
  district text,
  tech_name text,
  has_objection boolean not null default false,
  is_existing boolean not null default false,
  is_planted boolean not null default false,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.column_checks
add column if not exists district text;

alter table public.buildings
add column if not exists city text;

alter table public.poles
add column if not exists city text;

alter table public.column_checks
add column if not exists city text;

alter table public.column_checks
add column if not exists tech_name text;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists buildings_set_updated_at on public.buildings;
create trigger buildings_set_updated_at
before update on public.buildings
for each row execute function public.set_updated_at();

drop trigger if exists poles_set_updated_at on public.poles;
create trigger poles_set_updated_at
before update on public.poles
for each row execute function public.set_updated_at();

drop trigger if exists column_checks_set_updated_at on public.column_checks;
create trigger column_checks_set_updated_at
before update on public.column_checks
for each row execute function public.set_updated_at();

alter table public.buildings enable row level security;
alter table public.poles enable row level security;
alter table public.column_checks enable row level security;

drop policy if exists "public read buildings" on public.buildings;
create policy "public read buildings" on public.buildings
for select using (true);

drop policy if exists "public write buildings" on public.buildings;
create policy "public write buildings" on public.buildings
for insert with check (true);

drop policy if exists "public update buildings" on public.buildings;
create policy "public update buildings" on public.buildings
for update using (true) with check (true);

drop policy if exists "public delete buildings" on public.buildings;
create policy "public delete buildings" on public.buildings
for delete using (true);

drop policy if exists "public read poles" on public.poles;
create policy "public read poles" on public.poles
for select using (true);

drop policy if exists "public write poles" on public.poles;
create policy "public write poles" on public.poles
for insert with check (true);

drop policy if exists "public update poles" on public.poles;
create policy "public update poles" on public.poles
for update using (true) with check (true);

drop policy if exists "public delete poles" on public.poles;
create policy "public delete poles" on public.poles
for delete using (true);

drop policy if exists "public read column checks" on public.column_checks;
create policy "public read column checks" on public.column_checks
for select using (true);

drop policy if exists "public write column checks" on public.column_checks;
create policy "public write column checks" on public.column_checks
for insert with check (true);

drop policy if exists "public update column checks" on public.column_checks;
create policy "public update column checks" on public.column_checks
for update using (true) with check (true);

drop policy if exists "public delete column checks" on public.column_checks;
create policy "public delete column checks" on public.column_checks
for delete using (true);

grant select, insert, update, delete on public.buildings to anon;
grant select, insert, update, delete on public.poles to anon;
grant select, insert, update, delete on public.column_checks to anon;
grant select, insert, update, delete on public.buildings to authenticated;
grant select, insert, update, delete on public.poles to authenticated;
grant select, insert, update, delete on public.column_checks to authenticated;

insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public read survey photos" on storage.objects;
create policy "public read survey photos" on storage.objects
for select using (bucket_id = 'survey-photos');

drop policy if exists "public upload survey photos" on storage.objects;
create policy "public upload survey photos" on storage.objects
for insert with check (bucket_id = 'survey-photos');

drop policy if exists "public update survey photos" on storage.objects;
create policy "public update survey photos" on storage.objects
for update using (bucket_id = 'survey-photos') with check (bucket_id = 'survey-photos');
