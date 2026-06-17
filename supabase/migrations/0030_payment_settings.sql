alter table public.organizations
  add column if not exists accepted_payment_methods jsonb default '["cash"]',
  add column if not exists promptpay_id text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name text,
  add column if not exists wise_link text,
  add column if not exists revolut_link text,
  add column if not exists receipt_prefix text default 'REC',
  add column if not exists receipt_footer_text text,
  add column if not exists default_payment_method text default 'cash';

alter table public.booking_links
  add column if not exists preferred_payment_method text,
  add column if not exists payment_timing text check (payment_timing in ('now', 'on_delivery')),
  add column if not exists payment_reported_by_customer boolean default false,
  add column if not exists payment_reported_at timestamptz;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organizations(id),
  rental_id uuid references public.rentals(id),
  transaction_id uuid references public.transactions(id),
  rental_payment_id uuid references public.rental_payments(id),
  receipt_number text not null,
  amount numeric not null,
  payment_method text,
  pdf_url text,
  sent_to_customer boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.receipts enable row level security;

create policy "Members can view receipts" on public.receipts
  for select to authenticated
  using (public.is_org_member(organisation_id));

create policy "Members can create receipts" on public.receipts
  for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy "Members can update receipts" on public.receipts
  for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));
