-- Track vehicle changes on rentals (swaps, replacements, breakdowns)
create table if not exists public.vehicle_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  from_vehicle_id uuid references public.vehicles(id) on delete set null,
  to_vehicle_id uuid references public.vehicles(id) on delete set null,
  reason text not null,
  reason_notes text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  original_vehicle_disposition text not null default 'available',
  repair_notes text,
  repair_expected_end timestamptz,
  rate_before numeric(12,2),
  rate_after numeric(12,2),
  created_at timestamptz not null default now()
);

alter table public.vehicle_changes enable row level security;

create policy "Members can view vehicle changes"
  on public.vehicle_changes for select
  using (public.is_org_member(organization_id));

create policy "Members can create vehicle changes"
  on public.vehicle_changes for insert
  with check (public.is_org_member(organization_id));

create index vehicle_changes_rental_idx on public.vehicle_changes(rental_id);
create index vehicle_changes_org_idx on public.vehicle_changes(organization_id);

-- Add original_vehicle_id to rentals for quick reference to first assigned vehicle
alter table public.rentals
  add column if not exists original_vehicle_id uuid references public.vehicles(id) on delete set null;
