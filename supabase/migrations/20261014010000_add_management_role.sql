alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin', 'tech', 'design', 'engineer', 'supervisor', 'management'));

drop policy if exists "authenticated read planned poles" on public.planned_poles;
create policy "authenticated read planned poles" on public.planned_poles
for select to authenticated using (
  public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor', 'management')
  or (
    public.current_app_role() = 'tech'
    and assigned_to = (select username from public.user_profiles where id = (select auth.uid()))
  )
);

drop policy if exists "authenticated read planned routes" on public.planned_routes;
create policy "authenticated read planned routes" on public.planned_routes
for select to authenticated using (
  public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor', 'management')
  or (
    public.current_app_role() = 'tech'
    and exists (
      select 1
      from public.planned_poles pole
      join public.user_profiles technician on technician.username = pole.assigned_to
      where pole.batch_id = planned_routes.batch_id
        and technician.id = (select auth.uid())
    )
  )
);
