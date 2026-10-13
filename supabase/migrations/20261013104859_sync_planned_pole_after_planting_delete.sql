create or replace function public.reset_planned_pole_after_column_check_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.planned_poles
  set validation_status = 'validated',
      is_planted = false,
      planted_record_id = null,
      updated_at = now()
  where planted_record_id = old.id
    and validation_status = 'planted';
  return old;
end;
$$;

revoke all on function public.reset_planned_pole_after_column_check_delete() from public;

drop trigger if exists reset_planned_pole_after_column_check_delete on public.column_checks;
create trigger reset_planned_pole_after_column_check_delete
after delete on public.column_checks
for each row execute function public.reset_planned_pole_after_column_check_delete();

notify pgrst, 'reload schema';
