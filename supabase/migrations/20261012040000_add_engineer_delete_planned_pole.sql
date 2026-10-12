create or replace function public.engineer_delete_planned_pole(p_id text)
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
  set deleted_at = now(),
      updated_at = now()
  where id = p_id
    and deleted_at is null
    and validation_status <> 'planted'
  returning * into result_row;

  if result_row.id is null then
    raise exception 'Point cannot be deleted';
  end if;

  return result_row;
end;
$$;

revoke all on function public.engineer_delete_planned_pole(text) from public;
revoke execute on function public.engineer_delete_planned_pole(text) from anon;
grant execute on function public.engineer_delete_planned_pole(text) to authenticated;

notify pgrst, 'reload schema';
