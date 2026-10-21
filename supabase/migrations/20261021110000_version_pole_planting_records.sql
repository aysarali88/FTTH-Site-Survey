alter table public.column_checks
  add column if not exists planting_reason text,
  add column if not exists form_version smallint;

update public.column_checks
set form_version = 1
where form_version is null;

alter table public.column_checks
  alter column form_version set default 1,
  alter column form_version set not null,
  alter column has_objection drop not null,
  alter column has_objection drop default,
  alter column is_existing drop not null,
  alter column is_existing drop default;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'column_checks_v2_requires_reason'
      and conrelid = 'public.column_checks'::regclass
  ) then
    alter table public.column_checks
      add constraint column_checks_v2_requires_reason
      check (
        form_version < 2
        or (is_planted and planting_reason is null)
        or (not is_planted and nullif(trim(planting_reason), '') is not null and photo_url is null)
      );
  end if;
end;
$$;

create or replace function public.supervisor_report_planned_pole(
  p_id text,
  p_is_planted boolean,
  p_reason text default null,
  p_photo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.planned_poles;
  saved_record public.column_checks;
  actor text;
  actor_role text := public.current_app_role();
  record_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if coalesce(actor_role, '') not in ('admin', 'supervisor', 'tech') then
    raise exception 'Not authorized';
  end if;
  if p_is_planted is null then
    raise exception 'Planting status is required';
  end if;
  if not p_is_planted and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required when the pole is not planted';
  end if;

  select username into actor
  from public.user_profiles
  where id = (select auth.uid());

  select * into plan_row
  from public.planned_poles
  where id = p_id
    and validation_status = 'validated'
    and deleted_at is null
    and (actor_role in ('admin', 'supervisor') or assigned_to = actor);

  if plan_row.id is null then
    raise exception 'Only assigned validated points can be recorded';
  end if;

  record_id := 'COL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into public.column_checks (
    id, latitude, longitude, city, district, tech_name,
    has_objection, is_existing, is_planted, planting_reason, form_version, notes, photo_url
  )
  values (
    record_id, plan_row.latitude, plan_row.longitude, plan_row.city, plan_row.district, actor,
    null, null, p_is_planted,
    case when p_is_planted then null else nullif(trim(p_reason), '') end,
    2, null,
    case when p_is_planted then nullif(trim(coalesce(p_photo_url, '')), '') else null end
  )
  returning * into saved_record;

  if p_is_planted then
    update public.planned_poles
    set validation_status = 'planted',
        is_planted = true,
        planted_record_id = record_id,
        updated_at = now()
    where id = p_id
    returning * into plan_row;
  end if;

  return jsonb_build_object('planned', to_jsonb(plan_row), 'record', to_jsonb(saved_record));
end;
$$;

revoke all on function public.supervisor_report_planned_pole(text, boolean, text, text) from public, anon;
grant execute on function public.supervisor_report_planned_pole(text, boolean, text, text) to authenticated;

create or replace function public.technician_add_legacy_planting_v2(
  p_latitude double precision,
  p_longitude double precision,
  p_city text,
  p_district text,
  p_is_planted boolean,
  p_reason text default null,
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
  if (select auth.uid()) is null or coalesce(public.current_app_role(), '') <> 'tech' then
    raise exception 'Not authorized';
  end if;
  if p_is_planted is null then
    raise exception 'Planting status is required';
  end if;
  if not p_is_planted and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required when the pole is not planted';
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
    has_objection, is_existing, is_planted, planting_reason, form_version, notes, photo_url
  )
  values (
    record_id, p_latitude, p_longitude, area_city, area_district, actor,
    null, null, p_is_planted,
    case when p_is_planted then null else nullif(trim(p_reason), '') end,
    2, null,
    case when p_is_planted then nullif(trim(coalesce(p_photo_url, '')), '') else null end
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.technician_add_legacy_planting_v2(double precision, double precision, text, text, boolean, text, text) from public, anon;
grant execute on function public.technician_add_legacy_planting_v2(double precision, double precision, text, text, boolean, text, text) to authenticated;

notify pgrst, 'reload schema';
