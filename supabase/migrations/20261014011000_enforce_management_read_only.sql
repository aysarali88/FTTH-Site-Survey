create or replace function public.is_management_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = (select auth.uid()) and role = 'management'
  );
$$;

revoke all on function public.is_management_user() from public;
grant execute on function public.is_management_user() to anon, authenticated;

drop policy if exists "public write buildings" on public.buildings;
create policy "public write buildings" on public.buildings
for insert with check (
  not public.is_management_user()
);

drop policy if exists "public update buildings" on public.buildings;
create policy "public update buildings" on public.buildings
for update using (
  not public.is_management_user()
) with check (
  not public.is_management_user()
);

drop policy if exists "public delete buildings" on public.buildings;
create policy "public delete buildings" on public.buildings
for delete using (
  not public.is_management_user()
);

drop policy if exists "public write poles" on public.poles;
create policy "public write poles" on public.poles
for insert with check (
  not public.is_management_user()
);

drop policy if exists "public update poles" on public.poles;
create policy "public update poles" on public.poles
for update using (
  not public.is_management_user()
) with check (
  not public.is_management_user()
);

drop policy if exists "public delete poles" on public.poles;
create policy "public delete poles" on public.poles
for delete using (
  not public.is_management_user()
);

drop policy if exists "public write column checks" on public.column_checks;
create policy "public write column checks" on public.column_checks
for insert with check (
  not public.is_management_user()
);

drop policy if exists "public update column checks" on public.column_checks;
create policy "public update column checks" on public.column_checks
for update using (
  not public.is_management_user()
) with check (
  not public.is_management_user()
);

drop policy if exists "public delete column checks" on public.column_checks;
create policy "public delete column checks" on public.column_checks
for delete using (
  not public.is_management_user()
);

drop policy if exists "public upload survey photos" on storage.objects;
create policy "public upload survey photos" on storage.objects
for insert with check (
  bucket_id = 'survey-photos'
  and not public.is_management_user()
);

drop policy if exists "public update survey photos" on storage.objects;
create policy "public update survey photos" on storage.objects
for update using (
  bucket_id = 'survey-photos'
  and not public.is_management_user()
) with check (
  bucket_id = 'survey-photos'
  and not public.is_management_user()
);
