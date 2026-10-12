drop policy if exists "workflow roles can read technician profiles" on public.user_profiles;

create policy "workflow roles can read technician profiles" on public.user_profiles
for select to authenticated
using (
  public.current_app_role() in ('admin', 'design', 'engineer')
  and role = 'tech'
);

notify pgrst, 'reload schema';
