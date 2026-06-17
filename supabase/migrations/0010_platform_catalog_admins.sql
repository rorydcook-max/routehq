create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = auth.uid()
  );
$$;

drop policy if exists "Platform admins can view platform admins" on public.platform_admins;
drop policy if exists "Platform admins can manage platform admins" on public.platform_admins;

create policy "Platform admins can view platform admins" on public.platform_admins
  for select using (public.is_platform_admin());

create policy "Platform admins can manage platform admins" on public.platform_admins
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Owners can manage vehicle makes" on public.vehicle_makes;
drop policy if exists "Owners can manage vehicle models" on public.vehicle_models;
drop policy if exists "Owners can manage vehicle trims" on public.vehicle_trims;

create policy "Platform admins can manage vehicle makes" on public.vehicle_makes
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can manage vehicle models" on public.vehicle_models
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can manage vehicle trims" on public.vehicle_trims
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Members can view catalog submissions" on public.vehicle_catalog_submissions;
drop policy if exists "Owners can manage catalog submissions" on public.vehicle_catalog_submissions;

create policy "Platform admins can view catalog submissions" on public.vehicle_catalog_submissions
  for select using (public.is_platform_admin());

create policy "Platform admins can manage catalog submissions" on public.vehicle_catalog_submissions
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());
