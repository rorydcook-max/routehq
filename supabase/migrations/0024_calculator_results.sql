create table if not exists public.calculator_results (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_trim text,
  purchase_price numeric,
  inputs jsonb,
  ai_estimates jsonb,
  results jsonb,
  recommendation text,
  confidence_score integer,
  created_at timestamptz default now()
);

alter table public.calculator_results enable row level security;

create policy "Members can view calculator results" on public.calculator_results
  for select using (public.is_org_member(organisation_id));

create policy "Members can insert calculator results" on public.calculator_results
  for insert with check (public.is_org_member(organisation_id));

create policy "Members can delete calculator results" on public.calculator_results
  for delete using (public.is_org_member(organisation_id));
