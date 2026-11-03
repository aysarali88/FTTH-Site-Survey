alter table public.buildings
  add column if not exists created_by uuid references auth.users (id);
alter table public.poles
  add column if not exists created_by uuid references auth.users (id);
alter table public.column_checks
  add column if not exists created_by uuid references auth.users (id);

alter table public.buildings alter column created_by set default auth.uid();
alter table public.poles alter column created_by set default auth.uid();
alter table public.column_checks alter column created_by set default auth.uid();

with matched_buildings as (
  select b.id, min(p.id::text)::uuid as user_id, count(*) as matches
  from public.buildings b
  join public.user_profiles p
    on p.role = 'tech'
   and (p.display_name = b.tech_name or p.username = b.tech_name)
   and (nullif(p.city, '') is null or p.city = b.city)
   and (nullif(p.district, '') is null or p.district = b.district)
  where b.created_by is null
  group by b.id
)
update public.buildings b
set created_by = m.user_id
from matched_buildings m
where b.id = m.id and m.matches = 1;

with matched_poles as (
  select r.id, min(p.id::text)::uuid as user_id, count(*) as matches
  from public.poles r
  join public.user_profiles p
    on p.role = 'tech'
   and (p.display_name = r.tech_name or p.username = r.tech_name)
   and (nullif(p.city, '') is null or p.city = r.city)
   and (nullif(p.district, '') is null or p.district = r.district)
  where r.created_by is null
  group by r.id
)
update public.poles r
set created_by = m.user_id
from matched_poles m
where r.id = m.id and m.matches = 1;

update public.column_checks record
set created_by = activity.actor_user_id
from (
  select distinct on (entity_id) entity_id, actor_user_id
  from public.management_activity
  where entity_type = 'planting_record'
    and action in ('technician_planting_record', 'technician_field_record')
    and actor_user_id is not null
  order by entity_id, occurred_at asc, id asc
) activity
where record.id = activity.entity_id and record.created_by is null;

with matched_checks as (
  select c.id, min(p.id::text)::uuid as user_id, count(*) as matches
  from public.column_checks c
  join public.user_profiles p
    on p.role = 'tech'
   and (p.display_name = c.tech_name or p.username = c.tech_name)
   and (nullif(p.city, '') is null or p.city = c.city)
   and (nullif(p.district, '') is null or p.district = c.district)
  where c.created_by is null
  group by c.id
)
update public.column_checks c
set created_by = m.user_id
from matched_checks m
where c.id = m.id and m.matches = 1;

create or replace function public.assign_survey_record_creator()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_survey_record_creator() from public, anon, authenticated;

drop trigger if exists assign_buildings_record_creator on public.buildings;
create trigger assign_buildings_record_creator
before insert or update on public.buildings
for each row execute function public.assign_survey_record_creator();

drop trigger if exists assign_poles_record_creator on public.poles;
create trigger assign_poles_record_creator
before insert or update on public.poles
for each row execute function public.assign_survey_record_creator();

drop trigger if exists assign_column_checks_record_creator on public.column_checks;
create trigger assign_column_checks_record_creator
before insert or update on public.column_checks
for each row execute function public.assign_survey_record_creator();

drop policy if exists "public delete buildings" on public.buildings;
create policy "admins and record owners delete buildings" on public.buildings
for delete to authenticated
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'tech' and created_by = (select auth.uid()))
);

drop policy if exists "public delete poles" on public.poles;
create policy "admins and record owners delete poles" on public.poles
for delete to authenticated
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'tech' and created_by = (select auth.uid()))
);

drop policy if exists "public delete column checks" on public.column_checks;
create policy "admins and record owners delete column checks" on public.column_checks
for delete to authenticated
using (
  public.current_app_role() = 'admin'
  or (public.current_app_role() = 'tech' and created_by = (select auth.uid()))
);

notify pgrst, 'reload schema';
