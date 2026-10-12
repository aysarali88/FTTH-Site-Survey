drop policy if exists "authenticated read planned poles" on public.planned_poles;

create policy "authenticated read planned poles" on public.planned_poles
for select to authenticated using (
  public.current_app_role() in ('admin', 'design', 'engineer', 'supervisor')
  or (
    public.current_app_role() = 'tech'
    and assigned_to = (select username from public.user_profiles where id = (select auth.uid()))
  )
);

notify pgrst, 'reload schema';
