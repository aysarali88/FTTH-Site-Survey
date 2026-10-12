drop function if exists public.engineer_update_planned_pole(text, double precision, double precision, text, text);

create or replace function public.engineer_update_planned_pole(
  p_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_status text,
  p_notes text default null,
  p_assigned_to text default null
)
returns public.planned_poles
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.planned_poles;
  actor text;
begin
  if public.current_app_role() not in ('admin', 'engineer') then
    raise exception 'Not authorized';
  end if;

  if p_status not in ('validated', 'rejected') then
    raise exception 'Invalid validation status';
  end if;

  select username into actor
  from public.user_profiles
  where id = (select auth.uid());

  update public.planned_poles
  set latitude = p_latitude,
      longitude = p_longitude,
      validation_status = p_status,
      validation_notes = nullif(trim(coalesce(p_notes, '')), ''),
      validated_by = actor,
      validated_at = now(),
      assigned_to = case
        when p_status = 'validated' then nullif(trim(coalesce(p_assigned_to, '')), '')
        else null
      end,
      assigned_at = case
        when p_status = 'validated'
          and nullif(trim(coalesce(p_assigned_to, '')), '') is not null
        then now()
        else null
      end,
      updated_at = now()
  where id = p_id
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Planned pole not found';
  end if;

  return result_row;
end;
$$;

revoke all on function public.engineer_update_planned_pole(text, double precision, double precision, text, text, text) from public;
grant execute on function public.engineer_update_planned_pole(text, double precision, double precision, text, text, text) to authenticated;

notify pgrst, 'reload schema';
