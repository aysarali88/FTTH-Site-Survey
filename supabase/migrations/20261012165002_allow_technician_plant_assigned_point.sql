create or replace function public.supervisor_plant_planned_pole(
  p_id text,
  p_has_objection boolean,
  p_is_existing boolean,
  p_notes text default null,
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
  actor_role text;
  record_id text;
begin
  select username into actor
  from public.user_profiles
  where id = (select auth.uid());

  actor_role := public.current_app_role();

  select * into plan_row
  from public.planned_poles
  where id = p_id
    and validation_status = 'validated';

  if actor_role not in ('admin', 'supervisor')
     and not (actor_role = 'tech' and plan_row.assigned_to = actor) then
    raise exception 'Not authorized';
  end if;

  if plan_row.id is null then
    raise exception 'Only validated points can be planted';
  end if;

  record_id := 'COL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(md5(random()::text), 1, 6));

  insert into public.column_checks (
    id,
    latitude,
    longitude,
    city,
    district,
    tech_name,
    has_objection,
    is_existing,
    is_planted,
    notes,
    photo_url
  )
  values (
    record_id,
    plan_row.latitude,
    plan_row.longitude,
    plan_row.city,
    plan_row.district,
    actor,
    p_has_objection,
    p_is_existing,
    true,
    nullif(trim(coalesce(p_notes, '')), ''),
    nullif(trim(coalesce(p_photo_url, '')), '')
  )
  returning * into saved_record;

  update public.planned_poles
  set validation_status = 'planted',
      is_planted = true,
      planted_record_id = record_id,
      updated_at = now()
  where id = p_id
  returning * into plan_row;

  return jsonb_build_object(
    'planned', to_jsonb(plan_row),
    'record', to_jsonb(saved_record)
  );
end;
$$;

revoke all on function public.supervisor_plant_planned_pole(text, boolean, boolean, text, text) from public, anon;
grant execute on function public.supervisor_plant_planned_pole(text, boolean, boolean, text, text) to authenticated;

notify pgrst, 'reload schema';
