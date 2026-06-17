create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.vehicles
  add column home_branch_id uuid references public.branches(id) on delete set null,
  add column service_area text not null default 'home_branch' check (service_area in ('home_branch', 'all_branches')),
  add column partner_network_enabled boolean not null default false;

create index branches_org_active_idx on public.branches(organization_id, is_active);
create index vehicles_home_branch_idx on public.vehicles(organization_id, home_branch_id) where deleted_at is null;

alter table public.branches enable row level security;

create policy "Members can view branches" on public.branches
  for select using (public.is_org_member(organization_id));

create policy "Managers can manage branches" on public.branches
  for all using (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','manager']::public.organization_role[]));
