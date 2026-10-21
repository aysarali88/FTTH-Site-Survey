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
  if public.current_app_role() <> 'engineer' then
    raise exception 'Not authorized';
  end if;

  select profile.username
    into actor
  from public.user_profiles as profile
  where profile.id = (select auth.uid());

  if lower(coalesce(actor, '')) <> 'ryadh' then
    raise exception 'Not authorized';
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
    and pole.validation_status = 'pending'
    and pole.deleted_at is null
  returning pole.*;
end;
$$;

revoke all on function public.engineer_validate_pending_poles(text[], text) from public;
revoke execute on function public.engineer_validate_pending_poles(text[], text) from anon;
grant execute on function public.engineer_validate_pending_poles(text[], text) to authenticated;
