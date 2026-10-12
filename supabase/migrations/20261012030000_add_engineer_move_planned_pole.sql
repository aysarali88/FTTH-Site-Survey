create or replace function public.engineer_move_planned_pole(
  p_id text,
  p_latitude double precision,
  p_longitude double precision
)
returns public.planned_poles
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.planned_poles;
begin
  if public.current_app_role() not in ('admin', 'engineer') then
    raise exception 'Not authorized';
  end if;

  update public.planned_poles
  set latitude = p_latitude,
      longitude = p_longitude,
      updated_at = now()
  where id = p_id
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Planned pole not found';
  end if;

  return result_row;
end;
$$;

revoke all on function public.engineer_move_planned_pole(text, double precision, double precision) from public;
revoke execute on function public.engineer_move_planned_pole(text, double precision, double precision) from anon;
grant execute on function public.engineer_move_planned_pole(text, double precision, double precision) to authenticated;

notify pgrst, 'reload schema';
