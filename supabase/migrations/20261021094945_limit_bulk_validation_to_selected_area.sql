create or replace function public.engineer_validate_pending_poles(
  p_ids text[],
  p_technician text
)
returns setof public.planned_poles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text;
begin
  if public.current_app_role() <> 'design' then
    raise exception 'Not authorized';
  end if;

  select profile.username
    into actor
  from public.user_profiles as profile
  where profile.id = (select auth.uid());

  if lower(coalesce(actor, '')) <> 'ryadh' then
    raise exception 'Not authorized';
  end if;

  raise exception 'Area selection is required. Use design_validate_area_pending_poles.';
end;
$$;

revoke all on function public.engineer_validate_pending_poles(text[], text) from public;
revoke execute on function public.engineer_validate_pending_poles(text[], text) from anon;
grant execute on function public.engineer_validate_pending_poles(text[], text) to authenticated;

create or replace function public.design_validate_area_pending_poles(
  p_ids text[],
  p_city text,
  p_district text,
  p_technician text
)
returns setof public.planned_poles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text;
begin
  if public.current_app_role() <> 'design' then
    raise exception 'Not authorized';
  end if;

  select profile.username
    into actor
  from public.user_profiles as profile
  where profile.id = (select auth.uid());

  if lower(coalesce(actor, '')) <> 'ryadh' then
    raise exception 'Not authorized';
  end if;

  if nullif(trim(coalesce(p_city, '')), '') is null
    or nullif(trim(coalesce(p_district, '')), '') is null then
    raise exception 'City and district are required';
  end if;

  if nullif(trim(coalesce(p_technician, '')), '') is null then
    raise exception 'Technician is required';
  end if;

  return query
  update public.planned_poles as pole
  set validation_status = 'validated',
      validated_by = actor,
      validated_at = now(),
      assigned_to = trim(p_technician),
      assigned_at = now(),
      updated_at = now()
  where pole.id = any(coalesce(p_ids, array[]::text[]))
    and lower(trim(coalesce(pole.city, ''))) = lower(trim(p_city))
    and lower(trim(coalesce(pole.district, ''))) = lower(trim(p_district))
    and pole.validation_status = 'pending'
    and pole.deleted_at is null
  returning pole.*;
end;
$$;

revoke all on function public.design_validate_area_pending_poles(text[], text, text, text) from public;
revoke execute on function public.design_validate_area_pending_poles(text[], text, text, text) from anon;
grant execute on function public.design_validate_area_pending_poles(text[], text, text, text) to authenticated;
