create table public.vehicle_catalog_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'merged')),
  make_name text not null,
  model_name text,
  trim_name text,
  category_code text,
  year_from integer,
  year_to integer,
  engine_cc integer,
  transmission text,
  fuel_type text,
  seating_capacity integer,
  drivetrain text,
  notes text,
  curator_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehicle_catalog_submissions_org_status_idx
  on public.vehicle_catalog_submissions(organization_id, status, created_at desc);

alter table public.vehicle_catalog_submissions enable row level security;

create policy "Members can view catalog submissions" on public.vehicle_catalog_submissions
  for select using (public.is_org_member(organization_id));

create policy "Members can create catalog submissions" on public.vehicle_catalog_submissions
  for insert with check (
    public.is_org_member(organization_id)
    and submitted_by = auth.uid()
    and status = 'pending_review'
  );

create policy "Owners can manage catalog submissions" on public.vehicle_catalog_submissions
  for update using (public.has_org_role(organization_id, array['owner']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner']::public.organization_role[]));

create trigger vehicle_catalog_submissions_updated_at
  before update on public.vehicle_catalog_submissions
  for each row execute function public.set_updated_at();
