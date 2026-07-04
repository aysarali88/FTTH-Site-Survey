create extension if not exists "pgcrypto";

create table if not exists public.buildings (
  id text primary key,
  latitude double precision not null,
  longitude double precision not null,
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
