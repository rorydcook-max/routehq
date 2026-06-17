do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branches'
      and column_name = 'organisation_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'branches'
      and column_name = 'organization_id'
  ) then
    alter table public.branches rename column organisation_id to organization_id;
  end if;
end $$;

drop index if exists public.branches_org_active_idx;
create index if not exists branches_org_active_idx on public.branches(organization_id, is_active);

drop policy if exists "Members can view branches" on public.branches;
drop policy if exists "Managers can manage branches" on public.branches;

create policy "Members can view branches" on public.branches
  for select using (public.is_org_member(organization_id));

create policy "Managers can manage branches" on public.branches
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));
