-- Public booking page: a customer picks a vehicle and dates and sends a
-- request. The vehicle is held for a while (hold_until) so two people can't
-- ask for the same dates, and the business approves or declines.

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  start_date date not null,
  end_date date,
  customer_name text not null,
  phone text not null,
  message text,
  estimated_total numeric,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  hold_until timestamptz not null,
  customer_id uuid references public.customers(id) on delete set null,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_requests_org_status_idx on public.booking_requests (organization_id, status, created_at desc);

-- Members can read their own business's requests. Requests are written by
-- server code with the service role (the public page has no signed-in user).
alter table public.booking_requests enable row level security;

create policy booking_requests_member_select on public.booking_requests
  for select using (public.is_org_member(organization_id));
