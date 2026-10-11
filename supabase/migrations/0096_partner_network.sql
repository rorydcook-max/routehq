-- Partner network (Rory, 11 Oct 2026): an operator with no vehicle free sends
-- the customer to a partner's vehicle. The customer becomes the partner's;
-- the partner owes the referrer a one-time finder's fee, a share of the first
-- rent payment. Settled between them directly and marked paid here.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  from_organization_id uuid not null references public.organizations (id) on delete cascade,
  to_organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  rental_id uuid references public.rentals (id) on delete set null,
  booking_link_id uuid references public.booking_links (id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  start_date date,
  end_date date,
  status text not null default 'sent' check (status in ('sent', 'booked', 'rented', 'cancelled')),
  fee_pct integer not null default 10,
  fee_amount numeric(12,2),
  fee_due_at date,
  fee_paid_at timestamptz,
  fee_paid_method text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists referrals_from_idx on public.referrals (from_organization_id, created_at desc);
create index if not exists referrals_to_idx on public.referrals (to_organization_id, created_at desc);
create index if not exists referrals_rental_idx on public.referrals (rental_id) where rental_id is not null;

alter table public.referrals enable row level security;
-- Both sides can read a referral; writes go through server code.
create policy referrals_member_select on public.referrals
  for select using (public.is_org_member(from_organization_id) or public.is_org_member(to_organization_id));

-- A finder's fee received has no vehicle of the referrer's behind it.
alter table public.transactions alter column vehicle_id drop not null;

-- The fee as money records on both sides.
alter type public.transaction_type add value if not exists 'finders_fee';
alter type public.transaction_type add value if not exists 'finders_fee_income';
